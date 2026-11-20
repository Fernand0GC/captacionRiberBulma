-- Reporte del día (spec 009): registros nuevos y clientes con seguimiento de un día (o rango), con sus listas.
-- Una sola función para la vista «Del día» y la tarjeta del Panel, así número y lista salen de la misma regla
-- (research R1). Mismo acceso y alcance que agent_activity (Actividad): is_manager() y scoped_branch().

-- Contactos de un día en todas las sucursales (research R5).
create index if not exists followups_contacted_idx on public.followups (contacted_at);

create or replace function public.daily_report(f jsonb default '{}')
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  max_rows constant integer := 2000;
  v_branch smallint;
  v_from date;
  v_to date;
  v_origin text := coalesce(nullif(f ->> 'origin', ''), 'all');
  v_referrer smallint := nullif(f ->> 'referrer_id', '')::smallint;
  v_lists boolean := coalesce(nullif(f ->> 'lists', '')::boolean, true);
  v_start timestamptz;
  v_end timestamptz;
  v_totals jsonb;
  v_new jsonb := '[]';
  v_followed jsonb := '[]';
  v_truncated boolean := false;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  v_branch := public.scoped_branch(nullif(f ->> 'branch_id', '')::smallint);
  v_from := coalesce(nullif(f ->> 'from', '')::date, (now() at time zone tz)::date);
  v_to := coalesce(nullif(f ->> 'to', '')::date, v_from);
  if v_to < v_from or v_to - v_from > 366 then raise exception 'invalid_input' using detail = 'to'; end if;
  if v_origin not in ('all', 'referred') then raise exception 'invalid_input' using detail = 'origin'; end if;
  -- Ventana en hora de Bolivia (research R3).
  v_start := v_from::timestamp at time zone tz;
  v_end := (v_to + 1)::timestamp at time zone tz;

  -- Clientes que cuentan, en cada consulta: activos, del alcance y del origen elegido (FR-003, FR-004).
  with new_ as (
    select p.id, p.created_by from public.prospects p
    where p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and (v_origin = 'all' or p.referrer_id is not null)
      and (v_referrer is null or p.referrer_id = v_referrer)
      and p.client_created_at >= v_start and p.client_created_at < v_end
  ),
  week as (
    select count(*) as n from public.prospects p
    where p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and (v_origin = 'all' or p.referrer_id is not null)
      and (v_referrer is null or p.referrer_id = v_referrer)
      and p.client_created_at >= ((v_to - 6)::timestamp at time zone tz) and p.client_created_at < v_end
  ),
  contacts as (
    select fu.prospect_id, fu.effective from public.followups fu
    join public.prospects p on p.id = fu.prospect_id
    where p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and (v_origin = 'all' or p.referrer_id is not null)
      and (v_referrer is null or p.referrer_id = v_referrer)
      and fu.contacted_at >= v_start and fu.contacted_at < v_end
  )
  select jsonb_build_object(
    'new', (select count(*) from new_),
    'new_people', (select count(distinct created_by) from new_),
    'week_new', (select n from week),
    'followed', (select count(distinct prospect_id) from contacts),
    'effective', (select count(distinct prospect_id) from contacts where effective),
    'contacts', (select count(*) from contacts)
  ) into v_totals;

  if v_lists then
    -- Registros nuevos, por hora (FR-002).
    select coalesce(jsonb_agg(x.j order by x.at, x.id), '[]'), count(*) > max_rows
      into v_new, v_truncated
    from (
      select p.client_created_at as at, p.id, jsonb_build_object(
        'id', p.id, 'registered_at', p.client_created_at, 'full_name', p.full_name, 'phone', p.phone_raw,
        'channel', ch.name, 'channel_detail', p.channel_detail, 'referrer', r.name,
        'created_by', cb.full_name, 'assigned_to', asg.full_name, 'stage', p.stage, 'branch', b.name) as j
      from public.prospects p
      join public.branches b on b.id = p.branch_id
      join public.profiles cb on cb.id = p.created_by
      left join public.profiles asg on asg.id = p.assigned_to
      left join public.channels ch on ch.id = p.channel_id
      left join public.referrers r on r.id = p.referrer_id
      where p.status = 'active'
        and (v_branch is null or p.branch_id = v_branch)
        and (v_origin = 'all' or p.referrer_id is not null)
        and (v_referrer is null or p.referrer_id = v_referrer)
        and p.client_created_at >= v_start and p.client_created_at < v_end
      order by p.client_created_at, p.id
      limit max_rows + 1
    ) x;
    if v_truncated then v_new := v_new - max_rows; end if;

    -- Clientes con seguimiento: uno por fila, con sus contactos del período y el último (FR-002).
    select coalesce(jsonb_agg(x.j order by x.at desc, x.id), '[]'), v_truncated or count(*) > max_rows
      into v_followed, v_truncated
    from (
      select c.last_at as at, p.id, jsonb_build_object(
        'id', p.id, 'full_name', p.full_name, 'phone', p.phone_raw,
        'contacts', c.contacts, 'effective', c.effective, 'last_at', c.last_at,
        'last_method', c.last_method, 'last_result', c.last_result, 'last_actor', ac.full_name,
        'registered_at', p.client_created_at, 'channel', ch.name, 'referrer', r.name,
        'stage', p.stage, 'branch', b.name) as j
      from (
        select fu.prospect_id, count(*) as contacts, bool_or(fu.effective) as effective,
               max(fu.contacted_at) as last_at,
               (array_agg(fu.method order by fu.contacted_at desc))[1] as last_method,
               (array_agg(fu.result order by fu.contacted_at desc))[1] as last_result,
               (array_agg(fu.actor_id order by fu.contacted_at desc))[1] as last_actor
        from public.followups fu
        where fu.contacted_at >= v_start and fu.contacted_at < v_end
        group by fu.prospect_id
      ) c
      join public.prospects p on p.id = c.prospect_id
      join public.branches b on b.id = p.branch_id
      join public.profiles ac on ac.id = c.last_actor
      left join public.channels ch on ch.id = p.channel_id
      left join public.referrers r on r.id = p.referrer_id
      where p.status = 'active'
        and (v_branch is null or p.branch_id = v_branch)
        and (v_origin = 'all' or p.referrer_id is not null)
        and (v_referrer is null or p.referrer_id = v_referrer)
      order by c.last_at desc, p.id
      limit max_rows + 1
    ) x;
    if jsonb_array_length(v_followed) > max_rows then v_followed := v_followed - max_rows; end if;
  end if;

  return jsonb_build_object('from', v_from, 'to', v_to, 'totals', v_totals,
    'new_rows', v_new, 'followed_rows', v_followed, 'truncated', v_truncated);
end;
$$;

revoke execute on function public.daily_report(jsonb) from public, anon;
grant execute on function public.daily_report(jsonb) to authenticated;
