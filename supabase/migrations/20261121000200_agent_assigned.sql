-- Actividad: clientes asignados del día (spec 012). Solo agrega un índice y reemplaza/crea funciones de lectura:
-- es compatible con la app anterior (los campos nuevos se ignoran).
--  · «Asignado» = el cliente pasó a cargo de la persona en el período (assignment_events: Reparto, asignación manual,
--    «Hacer seguimiento» o captación con interés alto). Si se le asignó dos veces en el período, cuenta la primera.
--  · «Contactado» = la persona registró al menos un contacto con ese cliente desde que se le asignó, hasta hoy
--    (si le repartieron a las 18:00 y llamó al día siguiente, cuenta).
--  · Etapa de origen = la que tenía el cliente justo ANTES de asignarse (último stage_event anterior; si no hay, Captación).
--    Estricto «antes»: «Hacer seguimiento» guarda contacto, cambio de etapa y asignación en el mismo instante, y ese
--    cambio es el resultado del contacto, no el origen. Una captación con interés alto queda con origen Captación.
-- La sucursal es la del cliente, como en el resto de Actividad.

create index if not exists assignment_events_to_user_idx on public.assignment_events (to_user, created_at);

-- agent_activity: igual a 20261120000100 más `assigned` y `assigned_contacted` por persona y por sucursal. -----------
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
  -- Auxiliares y supervisores activos siempre (aunque en cero); cualquier otro solo si tiene contactos o asignados.
  people as (
    select pr.id from public.profiles pr
    where pr.active and pr.role in ('field_assistant', 'field_supervisor')
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
             where pr.active and pr.role in ('field_assistant', 'field_supervisor') and pr.branch_id = b.id) as staff,
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

-- list_agent_assigned: los clientes asignados a una persona en el período, con origen, contactos y etapa de hoy. ------
-- Hasta 500 filas (más que suficiente para un día; en rangos largos `total` dice cuántas hay).
create or replace function public.list_agent_assigned(f jsonb)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_branch smallint;
  v_from date;
  v_to date;
  v_actor uuid := nullif(f ->> 'actor_id', '')::uuid;
  v_total bigint;
  v_rows jsonb;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  v_branch := public.scoped_branch(nullif(f ->> 'branch_id', '')::smallint);
  if v_actor is null then raise exception 'invalid_input' using detail = 'actor_id'; end if;

  v_from := coalesce(nullif(f ->> 'from', '')::date, (now() at time zone tz)::date);
  v_to := coalesce(nullif(f ->> 'to', '')::date, v_from);
  if v_to < v_from or v_to - v_from > 366 then raise exception 'invalid_input' using detail = 'to'; end if;

  with asg as (
    select distinct on (ae.prospect_id) ae.prospect_id, ae.created_at as assigned_at, ae.actor_id as assigned_by_id
    from public.assignment_events ae
    join public.prospects p on p.id = ae.prospect_id
    where ae.to_user = v_actor and p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and ae.created_at >= (v_from::timestamp at time zone tz)
      and ae.created_at < ((v_to + 1)::timestamp at time zone tz)
    order by ae.prospect_id, ae.created_at
  ),
  full_rows as (
    select a.prospect_id, p.full_name, a.assigned_at,
           (a.assigned_by_id = v_actor) as self_assigned,
           by_pr.full_name as assigned_by,
           coalesce((select se.to_stage from public.stage_events se
                     where se.prospect_id = a.prospect_id and se.created_at < a.assigned_at
                     order by se.created_at desc, se.id desc limit 1), 'capture') as stage_at,
           p.stage as stage_now,
           k.contacts, k.first_at, k.last_at, l.method as last_method, l.result as last_result, l.note as last_note,
           -- Ya no está a su cargo: a quién pasó (null = quedó sin responsable) y cuándo.
           (p.assigned_to is distinct from v_actor) as reassigned,
           now_pr.full_name as reassigned_to,
           case when p.assigned_to is distinct from v_actor then
             (select max(ae2.created_at) from public.assignment_events ae2
              where ae2.prospect_id = a.prospect_id and ae2.created_at > a.assigned_at) end as reassigned_at
    from asg a
    join public.prospects p on p.id = a.prospect_id
    left join public.profiles by_pr on by_pr.id = a.assigned_by_id
    left join public.profiles now_pr on now_pr.id = p.assigned_to and p.assigned_to is distinct from v_actor
    cross join lateral (
      select count(*)::int as contacts, min(fu.contacted_at) as first_at, max(fu.contacted_at) as last_at
      from public.followups fu
      where fu.prospect_id = a.prospect_id and fu.actor_id = v_actor and fu.contacted_at >= a.assigned_at
    ) k
    left join lateral (
      select fu.method, fu.result, fu.note from public.followups fu
      where fu.prospect_id = a.prospect_id and fu.actor_id = v_actor and fu.contacted_at >= a.assigned_at
      order by fu.contacted_at desc, fu.id desc limit 1
    ) l on true
  )
  select (select count(*) from full_rows),
         coalesce((select jsonb_agg(row_to_json(x) order by x.assigned_at, x.full_name)
                   from (select * from full_rows order by assigned_at, full_name limit 500) x), '[]'::jsonb)
  into v_total, v_rows;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;
revoke execute on function public.list_agent_assigned(jsonb) from public, anon;
grant execute on function public.list_agent_assigned(jsonb) to authenticated;

-- list_agent_contacts: igual a 20261114000200 más `assigned` por fila (el cliente se le asignó en el período, antes o
-- en el momento del contacto) y `assigned_total` (cuántos de los contactos filtrados son a esos clientes). ----------
create or replace function public.list_agent_contacts(f jsonb, p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_branch smallint;
  v_from date;
  v_to date;
  v_actor uuid := nullif(f ->> 'actor_id', '')::uuid;
  v_metric text := coalesce(nullif(f ->> 'metric', ''), 'all');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
  v_assigned bigint;
  v_rows jsonb;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  v_branch := public.scoped_branch(nullif(f ->> 'branch_id', '')::smallint);
  if v_actor is null then raise exception 'invalid_input' using detail = 'actor_id'; end if;
  if v_metric not in ('all', 'calls', 'messages', 'store', 'effective', 'no_answer', 'visits', 'sales') then
    raise exception 'invalid_input' using detail = 'metric';
  end if;

  v_from := coalesce(nullif(f ->> 'from', '')::date, (now() at time zone tz)::date);
  v_to := coalesce(nullif(f ->> 'to', '')::date, v_from);
  if v_to < v_from or v_to - v_from > 366 then raise exception 'invalid_input' using detail = 'to'; end if;

  -- Misma base y mismas condiciones que las columnas de agent_activity: el total coincide con la celda tocada.
  with contacts as (
    select fu.id as followup_id, fu.prospect_id, p.full_name, fu.contacted_at, fu.method, fu.result, fu.effective, fu.note,
           exists (select 1 from public.assignment_events ae
                   where ae.prospect_id = fu.prospect_id and ae.to_user = v_actor
                     and ae.created_at >= (v_from::timestamp at time zone tz)
                     and ae.created_at < ((v_to + 1)::timestamp at time zone tz)
                     and ae.created_at <= fu.contacted_at) as assigned
    from public.followups fu
    join public.prospects p on p.id = fu.prospect_id
    where p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and fu.actor_id = v_actor
      and fu.contacted_at >= (v_from::timestamp at time zone tz)
      and fu.contacted_at < ((v_to + 1)::timestamp at time zone tz)
      and case v_metric
            when 'calls' then fu.method in ('call', 'whatsapp_call')
            when 'messages' then fu.method = 'message'
            when 'store' then fu.method = 'store'
            when 'effective' then fu.effective
            when 'no_answer' then fu.result = 'no_answer'
            when 'visits' then fu.result = 'visit_store'
            when 'sales' then fu.result = 'sold'
            else true
          end
  ),
  page as (
    select * from contacts c order by c.contacted_at desc, c.followup_id limit v_limit offset v_offset
  )
  select (select count(*) from contacts),
         (select count(*) from contacts where assigned),
         coalesce((select jsonb_agg(row_to_json(pg) order by pg.contacted_at desc, pg.followup_id) from page pg), '[]'::jsonb)
  into v_total, v_assigned, v_rows;

  return jsonb_build_object('total', v_total, 'assigned_total', v_assigned, 'rows', v_rows);
end;
$$;

revoke execute on function public.agent_activity(jsonb), public.list_agent_contacts(jsonb, integer, integer) from public, anon;
grant execute on function public.agent_activity(jsonb), public.list_agent_contacts(jsonb, integer, integer) to authenticated;
