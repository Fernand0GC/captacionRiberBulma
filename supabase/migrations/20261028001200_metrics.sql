-- Captaciones: cantidad por canal (chips) y métricas del panel (dashboard). 2026-10-28.

-- list_prospects: + by_channel. Los chips cuentan con todos los filtros MENOS el de canal, para poder saltar entre canales.
create or replace function public.list_prospects(f jsonb default '{}', p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_branch smallint;
  v_from date;
  v_to date;
  v_q text := nullif(trim(coalesce(f ->> 'q', '')), '');
  v_qdigits text;
  v_created_by uuid := nullif(f ->> 'created_by', '')::uuid;
  v_channel smallint := nullif(f ->> 'channel_id', '')::smallint;
  v_no_channel boolean := coalesce(f ->> 'channel_id', '') = 'none';
  v_assigned text := nullif(f ->> 'assigned', '');
  v_stage text := nullif(f ->> 'stage', '');
  v_by_visit boolean := coalesce(f ->> 'view', '') = 'visits';
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
  v_rows jsonb;
  v_by_channel jsonb;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  if v_no_channel then v_channel := null; end if;

  if public.app_role() = 'branch_manager' then
    v_branch := public.app_branch();
    if nullif(f ->> 'branch_id', '') is not null and (f ->> 'branch_id')::smallint <> v_branch then
      raise exception 'forbidden';
    end if;
  else
    v_branch := nullif(f ->> 'branch_id', '')::smallint;
  end if;

  v_from := coalesce(nullif(f ->> 'from', '')::date, (now() at time zone tz)::date);
  v_to := coalesce(nullif(f ->> 'to', '')::date, v_from);
  if v_to < v_from or v_to - v_from > 366 then raise exception 'invalid_input' using detail = 'to'; end if;

  if v_q is not null then
    v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
    v_qdigits := nullif(public.normalize_phone(v_q), '');
    if v_qdigits is not null and length(v_qdigits) < 3 then v_qdigits := null; end if;
  end if;

  with scope as (               -- todos los filtros menos el canal
    select p.*
    from public.prospects p
    where p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and (case when v_by_visit then p.visit_at else p.client_created_at end) >= (v_from::timestamp at time zone tz)
      and (case when v_by_visit then p.visit_at else p.client_created_at end) < ((v_to + 1)::timestamp at time zone tz)
      and (v_created_by is null or p.created_by = v_created_by)
      and (v_assigned is null or (v_assigned = 'none' and p.assigned_to is null)
           or (v_assigned <> 'none' and p.assigned_to::text = v_assigned))
      and (v_stage is null or p.stage::text = v_stage)
      and (v_q is null or p.full_name ilike '%' || v_q || '%'
           or (v_qdigits is not null and p.phone_norm like '%' || v_qdigits || '%'))
  ),
  base as (
    select * from scope s
    where (v_channel is null and not v_no_channel) or (v_no_channel and s.channel_id is null) or s.channel_id = v_channel
  ),
  page as (
    select p.id, p.full_name, p.phone_raw, p.interest, p.occupation, p.address, p.client_created_at, p.shift, p.stage,
           p.late_after_deactivation, p.branch_id, b.name as branch_name,
           p.created_by, a.full_name as created_by_name, a.role as created_by_role,
           c.name as channel_name, pr.name as product_name, pr.product_group,
           p.assigned_to, s.full_name as assigned_to_name, p.contact_attempts, p.visit_at
    from base p
    join public.branches b on b.id = p.branch_id
    join public.profiles a on a.id = p.created_by
    left join public.channels c on c.id = p.channel_id
    left join public.products pr on pr.id = p.product_id
    left join public.profiles s on s.id = p.assigned_to
    order by case when v_by_visit then p.visit_at end, p.client_created_at desc, p.id
    limit v_limit offset v_offset
  )
  select (select count(*) from base),
         coalesce((select jsonb_agg(jsonb_build_object('channel_id', x.channel_id, 'name', x.name, 'n', x.n) order by x.n desc, x.name)
                   from (select sc.channel_id, coalesce(c.name, 'Sin canal') as name, count(*) as n
                         from scope sc left join public.channels c on c.id = sc.channel_id
                         group by sc.channel_id, c.name) x), '[]'::jsonb),
         coalesce((select jsonb_agg(row_to_json(pg) order by case when v_by_visit then pg.visit_at end, pg.client_created_at desc, pg.id) from page pg), '[]'::jsonb)
  into v_total, v_by_channel, v_rows;

  return jsonb_build_object('total', v_total, 'by_channel', v_by_channel, 'rows', v_rows);
end;
$$;

-- Métricas del panel. Alcance: encargado = su sucursal; gerente/Sistemas = todas o f.branch_id.
-- Bases de cada número (para que se lean sin ambigüedad):
--   captaciones / embudo / por canal / por día / por volantero  → captaciones registradas en el período;
--   contactos y efectivos                                         → contactos hechos en el período (followups);
--   potenciales y ventas                                          → pasos a etapa 4 y 5 ocurridos en el período (stage_events);
--   visitas                                                       → visitas pactadas para el período.
create function public.dashboard_metrics(f jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_branch smallint;
  v_from date;
  v_to date;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  if public.app_role() = 'branch_manager' then
    v_branch := public.app_branch();
  else
    v_branch := nullif(f ->> 'branch_id', '')::smallint;
  end if;
  v_from := coalesce(nullif(f ->> 'from', '')::date, (now() at time zone tz)::date);
  v_to := coalesce(nullif(f ->> 'to', '')::date, v_from);
  if v_to < v_from or v_to - v_from > 366 then raise exception 'invalid_input' using detail = 'to'; end if;
  v_start := v_from::timestamp at time zone tz;
  v_end := (v_to + 1)::timestamp at time zone tz;

  return (
    with caps as (
      select p.* from public.prospects p
      where p.status = 'active' and (v_branch is null or p.branch_id = v_branch)
        and p.client_created_at >= v_start and p.client_created_at < v_end
    ),
    contacts as (
      select fu.*, p.branch_id from public.followups fu join public.prospects p on p.id = fu.prospect_id
      where p.status = 'active' and (v_branch is null or p.branch_id = v_branch)
        and fu.contacted_at >= v_start and fu.contacted_at < v_end
    ),
    moves as (
      select e.*, p.branch_id from public.stage_events e join public.prospects p on p.id = e.prospect_id
      where p.status = 'active' and (v_branch is null or p.branch_id = v_branch)
        and e.created_at >= v_start and e.created_at < v_end
    )
    select jsonb_build_object(
      'kpis', jsonb_build_object(
        'captures', (select count(*) from caps),
        'contacts', (select count(*) from contacts),
        'effective', (select count(*) from contacts where effective),
        'potential', (select count(distinct prospect_id) from moves where to_stage = 'interested'),
        'sales', (select count(distinct prospect_id) from moves where to_stage = 'sale'),
        'visits', (select count(*) from public.prospects p where p.status = 'active' and (v_branch is null or p.branch_id = v_branch)
                     and p.visit_at >= v_start and p.visit_at < v_end),
        'captures_sold', (select count(*) from caps where stage = 'sale'),
        'unassigned', (select count(*) from caps where assigned_to is null and stage not in ('sale', 'lost'))
      ),
      'funnel', (select jsonb_object_agg(s, coalesce((select count(*) from caps c where c.stage::text = s), 0))
                 from unnest(array['capture', 'recapture', 'followup', 'interested', 'sale', 'lost']) s),
      'by_day', coalesce((
        select jsonb_agg(jsonb_build_object('day', d::date, 'n',
               (select count(*) from caps c where (c.client_created_at at time zone tz)::date = d::date)) order by d)
        from generate_series(v_from, v_to, interval '1 day') d
      ), '[]'::jsonb),
      'by_channel', coalesce((
        select jsonb_agg(jsonb_build_object('name', x.name, 'n', x.n) order by x.n desc, x.name)
        from (select coalesce(ch.name, 'Sin canal') as name, count(*) as n
              from caps c left join public.channels ch on ch.id = c.channel_id group by ch.name) x
      ), '[]'::jsonb),
      'by_author', coalesce((
        select jsonb_agg(jsonb_build_object('name', x.full_name, 'role', x.role, 'captures', x.captures,
                                            'contacted', x.contacted, 'sales', x.sales) order by x.captures desc, x.full_name)
        from (select a.full_name, a.role, count(*) as captures,
                     count(*) filter (where c.stage not in ('capture', 'lost') or exists
                        (select 1 from public.followups fu where fu.prospect_id = c.id and fu.effective)) as contacted,
                     count(*) filter (where c.stage = 'sale') as sales
              from caps c join public.profiles a on a.id = c.created_by group by a.full_name, a.role) x
      ), '[]'::jsonb),
      'by_agent', coalesce((
        select jsonb_agg(jsonb_build_object('name', x.full_name, 'role', x.role, 'contacts', x.contacts,
                                            'effective', x.effective, 'visits', x.visits, 'sales', x.sales) order by x.contacts desc, x.full_name)
        from (select a.full_name, a.role, count(*) as contacts,
                     count(*) filter (where k.effective) as effective,
                     count(*) filter (where k.result = 'visit_store') as visits,
                     count(*) filter (where k.result = 'sold') as sales
              from contacts k join public.profiles a on a.id = k.actor_id group by a.full_name, a.role) x
      ), '[]'::jsonb),
      'by_branch', case when v_branch is null then coalesce((
        select jsonb_agg(jsonb_build_object('name', b.name, 'captures',
                 (select count(*) from caps c where c.branch_id = b.id),
                 'sales', (select count(distinct m.prospect_id) from moves m where m.branch_id = b.id and m.to_stage = 'sale'))
               order by b.id)
        from public.branches b where b.active
      ), '[]'::jsonb) else null end
    )
  );
end;
$$;

revoke execute on function public.dashboard_metrics(jsonb) from public, anon;
grant execute on function public.dashboard_metrics(jsonb) to authenticated;
