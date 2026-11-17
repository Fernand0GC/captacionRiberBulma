-- Monitoreo de seguimiento (specs/002-monitoreo-seguimiento, US1): vista Seguimientos de /gestion.
-- Solo lectura: un cliente por fila con su último contacto, intentos y vencimiento, y la cantidad por pestaña.
-- Todo se calcula de prospects + followups (principio III); el alcance por rol pasa por scoped_branch.

create function public.list_followup_status(f jsonb default '{}', p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_today date := (now() at time zone tz)::date;
  v_branch smallint;
  v_from date;
  v_to date;
  v_q text := nullif(trim(coalesce(f ->> 'q', '')), '');
  v_qdigits text;
  v_created_by uuid := nullif(f ->> 'created_by', '')::uuid;
  v_no_channel boolean := coalesce(f ->> 'channel_id', '') = 'none';
  v_channel smallint;
  v_assigned text := nullif(f ->> 'assigned', '');
  v_tab text := nullif(f ->> 'tab', '');
  v_stages public.prospect_stage[];
  v_interest text := nullif(f ->> 'interest', '');
  v_attempts text := nullif(f ->> 'attempts', '');
  v_overdue boolean := coalesce(nullif(f ->> 'overdue', '')::boolean, false);
  v_stale integer := nullif(f ->> 'stale_days', '')::integer;
  v_reason smallint := nullif(f ->> 'lost_reason_id', '')::smallint;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
  v_by_tab jsonb;
  v_rows jsonb;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;

  v_branch := public.scoped_branch(nullif(f ->> 'branch_id', '')::smallint);
  if not v_no_channel then v_channel := nullif(f ->> 'channel_id', '')::smallint; end if;

  v_from := coalesce(nullif(f ->> 'from', '')::date, v_today);
  v_to := coalesce(nullif(f ->> 'to', '')::date, v_from);
  if v_to < v_from or v_to - v_from > 366 then raise exception 'invalid_input' using detail = 'to'; end if;

  v_stages := case v_tab
    when 'sin_contactar' then array['capture']::public.prospect_stage[]
    when 'seguimiento' then array['followup', 'recapture']::public.prospect_stage[]
    when 'potencial' then array['interested']::public.prospect_stage[]
    when 'venta' then array['sale']::public.prospect_stage[]
    when 'sin_interes' then array['lost']::public.prospect_stage[]
  end;
  if v_tab is not null and v_stages is null then raise exception 'invalid_input' using detail = 'tab'; end if;
  if v_interest is not null and v_interest not in ('high', 'medium', 'low', 'none') then
    raise exception 'invalid_input' using detail = 'interest';
  end if;
  if v_attempts is not null and v_attempts not in ('0', '1-2', '3+') then
    raise exception 'invalid_input' using detail = 'attempts';
  end if;
  if v_stale is not null and v_stale not in (3, 7, 15, 30) then
    raise exception 'invalid_input' using detail = 'stale_days';
  end if;

  if v_q is not null then
    v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
    v_qdigits := nullif(public.normalize_phone(v_q), '');
    if v_qdigits is not null and length(v_qdigits) < 3 then v_qdigits := null; end if;
  end if;

  with scope as (               -- todos los filtros menos la pestaña
    select p.*,
           lf.contacted_at as last_contacted_at, lf.method as last_method, lf.result as last_result,
           lf.note as last_note, lf.actor_id as last_actor_id,
           (select count(*) from public.followups c where c.prospect_id = p.id) as contacts_total,
           (p.stage not in ('sale', 'lost') and p.next_contact_at is not null and p.next_contact_at < now()) as overdue,
           v_today - (coalesce(lf.contacted_at, p.client_created_at) at time zone tz)::date as days_without_contact
    from public.prospects p
    left join lateral (
      select fu.contacted_at, fu.method, fu.result, fu.note, fu.actor_id
      from public.followups fu
      where fu.prospect_id = p.id
      order by fu.contacted_at desc, fu.created_at desc
      limit 1
    ) lf on true
    where p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and p.client_created_at >= (v_from::timestamp at time zone tz)
      and p.client_created_at < ((v_to + 1)::timestamp at time zone tz)
      and (v_created_by is null or p.created_by = v_created_by)
      and ((v_channel is null and not v_no_channel) or (v_no_channel and p.channel_id is null) or p.channel_id = v_channel)
      and (v_assigned is null or (v_assigned = 'none' and p.assigned_to is null)
           or (v_assigned <> 'none' and p.assigned_to::text = v_assigned))
      and (v_interest is null or (v_interest = 'none' and p.interest is null) or p.interest::text = v_interest)
      and (v_attempts is null
           or (v_attempts = '0' and p.contact_attempts = 0)
           or (v_attempts = '1-2' and p.contact_attempts between 1 and 2)
           or (v_attempts = '3+' and p.contact_attempts >= 3))
      and (v_reason is null or p.lost_reason_id = v_reason)
      and (v_q is null or p.full_name ilike '%' || v_q || '%'
           or (v_qdigits is not null and p.phone_norm like '%' || v_qdigits || '%'))
  ),
  filtered as (
    select * from scope s
    where (not v_overdue or s.overdue) and (v_stale is null or s.days_without_contact > v_stale)
  ),
  base as (
    select * from filtered s where v_stages is null or s.stage = any (v_stages)
  ),
  page as (
    select b.id, b.full_name, b.phone_raw, br.name as branch_name,
           b.assigned_to, asg.full_name as assigned_to_name,
           b.stage, b.interest, b.contact_attempts as no_answer_streak, b.contacts_total,
           b.last_contacted_at, b.last_method, b.last_result, b.last_note, la.full_name as last_actor_name,
           b.next_contact_at, b.overdue, b.days_without_contact,
           lr.name as lost_reason, b.client_created_at, ch.name as channel_name, au.full_name as created_by_name
    from base b
    join public.branches br on br.id = b.branch_id
    join public.profiles au on au.id = b.created_by
    left join public.profiles asg on asg.id = b.assigned_to
    left join public.profiles la on la.id = b.last_actor_id
    left join public.channels ch on ch.id = b.channel_id
    left join public.lost_reasons lr on lr.id = b.lost_reason_id
    order by b.overdue desc, case when b.overdue then b.next_contact_at end, b.days_without_contact desc, b.client_created_at, b.id
    limit v_limit offset v_offset
  )
  select (select count(*) from base),
         (select jsonb_build_object(
            'sin_contactar', count(*) filter (where stage = 'capture'),
            'seguimiento', count(*) filter (where stage in ('followup', 'recapture')),
            'potencial', count(*) filter (where stage = 'interested'),
            'venta', count(*) filter (where stage = 'sale'),
            'sin_interes', count(*) filter (where stage = 'lost'),
            'todos', count(*)) from filtered),
         coalesce((select jsonb_agg(row_to_json(pg)
                     order by pg.overdue desc, case when pg.overdue then pg.next_contact_at end,
                              pg.days_without_contact desc, pg.client_created_at, pg.id)
                   from page pg), '[]'::jsonb)
  into v_total, v_by_tab, v_rows;

  return jsonb_build_object('total', v_total, 'by_tab', v_by_tab, 'rows', v_rows);
end;
$$;

revoke execute on function public.list_followup_status(jsonb, integer, integer) from public, anon;
grant execute on function public.list_followup_status(jsonb, integer, integer) to authenticated;
