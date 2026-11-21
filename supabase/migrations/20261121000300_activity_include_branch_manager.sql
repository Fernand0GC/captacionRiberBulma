-- Actividad: el Encargado de la sucursal aparece siempre en «Por persona» (aunque esté en cero) y cuenta en el
-- «x de N personas contactaron» y en «Prom./persona», igual que auxiliares y supervisores.
-- Antes solo aparecía si tenía contactos o asignados en el período (caso Carlos Llanos, Trinidad, 2026-11-21).
-- El Jefe de ventas sigue apareciendo solo con actividad: cubre varias sucursales y no tiene una propia.
-- Solo reemplaza una función de lectura; la app no cambia.

-- agent_activity: igual a 20261121000200 con 'branch_manager' en el personal fijo. ---------------------------
create or replace function public.agent_activity(f jsonb default '{}')
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_branch smallint;
  v_from date;
  v_to date;
  v_rows jsonb;
  v_by_branch jsonb;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  v_branch := public.scoped_branch(nullif(f ->> 'branch_id', '')::smallint);

  v_from := coalesce(nullif(f ->> 'from', '')::date, (now() at time zone tz)::date);
  v_to := coalesce(nullif(f ->> 'to', '')::date, v_from);
  if v_to < v_from or v_to - v_from > 366 then raise exception 'invalid_input' using detail = 'to'; end if;

  with contacts as (
    select fu.id, fu.actor_id, fu.prospect_id, p.branch_id, fu.method, fu.result, fu.effective
    from public.followups fu
    join public.prospects p on p.id = fu.prospect_id
    where p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and fu.contacted_at >= (v_from::timestamp at time zone tz)
      and fu.contacted_at < ((v_to + 1)::timestamp at time zone tz)
  ),
  -- 012: primera asignación de cada cliente a cada persona en el período y si la persona lo contactó después.
  asg as (
    select a.*, exists (
      select 1 from public.followups fu
      where fu.prospect_id = a.prospect_id and fu.actor_id = a.actor_id and fu.contacted_at >= a.assigned_at
    ) as contacted
    from (
      select distinct on (ae.to_user, ae.prospect_id)
             ae.to_user as actor_id, ae.prospect_id, p.branch_id, ae.created_at as assigned_at
      from public.assignment_events ae
      join public.prospects p on p.id = ae.prospect_id
      where ae.to_user is not null and p.status = 'active'
        and (v_branch is null or p.branch_id = v_branch)
        and ae.created_at >= (v_from::timestamp at time zone tz)
        and ae.created_at < ((v_to + 1)::timestamp at time zone tz)
      order by ae.to_user, ae.prospect_id, ae.created_at
    ) a
  ),
  -- Auxiliares, supervisores y encargados activos siempre (aunque en cero); cualquier otro solo si tiene contactos o asignados.
  people as (
    select pr.id from public.profiles pr
    where pr.active and pr.role in ('field_assistant', 'field_supervisor', 'branch_manager')
      and pr.branch_id is not null and (v_branch is null or pr.branch_id = v_branch)
    union
    select c.actor_id from contacts c
    union
    select a.actor_id from asg a
  ),
  agg as (
    select pr.id as actor_id, pr.full_name, pr.role, pr.active,
           count(c.id) filter (where c.method in ('call', 'whatsapp_call')) as calls,
           count(c.id) filter (where c.method = 'message') as messages,
           count(c.id) filter (where c.method = 'store') as store,
           count(c.id) filter (where c.effective) as effective,
           count(c.id) filter (where c.result = 'no_answer') as no_answer,
           count(c.id) filter (where c.result = 'visit_store') as visits,
           count(c.id) filter (where c.result = 'sold') as sales,
           count(distinct c.prospect_id) as clients,
           (select count(*) from asg a where a.actor_id = pr.id) as assigned,
           (select count(*) from asg a where a.actor_id = pr.id and a.contacted) as assigned_contacted,
           count(c.id) as total
    from people pe
    join public.profiles pr on pr.id = pe.id
    left join contacts c on c.actor_id = pe.id
    group by pr.id, pr.full_name, pr.role, pr.active
  ),
  br as (
    select b.id as branch_id, b.name,
           (select count(*) from public.profiles pr
             where pr.active and pr.role in ('field_assistant', 'field_supervisor', 'branch_manager') and pr.branch_id = b.id) as staff,
           count(distinct c.actor_id) as actors,
           count(c.id) filter (where c.method in ('call', 'whatsapp_call')) as calls,
           count(c.id) filter (where c.method = 'message') as messages,
           count(c.id) filter (where c.method = 'store') as store,
           count(c.id) filter (where c.effective) as effective,
           count(c.id) filter (where c.result = 'no_answer') as no_answer,
           count(c.id) filter (where c.result = 'visit_store') as visits,
           count(c.id) filter (where c.result = 'sold') as sales,
           count(distinct c.prospect_id) as clients,
           (select count(*) from asg a where a.branch_id = b.id) as assigned,
           (select count(*) from asg a where a.branch_id = b.id and a.contacted) as assigned_contacted,
           count(c.id) as total
    from public.branches b
    left join contacts c on c.branch_id = b.id
    where b.active and v_branch is null
    group by b.id, b.name
  )
  select
    (select coalesce(jsonb_agg(row_to_json(a) order by a.total desc, a.full_name), '[]'::jsonb) from agg a),
    case when v_branch is null then
      (select coalesce(jsonb_agg(row_to_json(x) order by x.total desc, x.name), '[]'::jsonb) from br x)
    end
  into v_rows, v_by_branch;

  return jsonb_build_object('rows', v_rows, 'by_branch', v_by_branch);
end;
$$;
