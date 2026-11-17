-- Monitoreo de seguimiento (specs/002-monitoreo-seguimiento, US2/US3): vista Actividad de /gestion.
-- Cuántos contactos hizo cada persona en el período (por forma y resultado) y el detalle de cada número.
-- Cada contacto cuenta para quien lo hizo (actor), aunque el cliente se reasigne; el alcance es la sucursal del cliente.

create function public.agent_activity(f jsonb default '{}')
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_branch smallint;
  v_from date;
  v_to date;
  v_rows jsonb;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  v_branch := public.scoped_branch(nullif(f ->> 'branch_id', '')::smallint);

  v_from := coalesce(nullif(f ->> 'from', '')::date, (now() at time zone tz)::date);
  v_to := coalesce(nullif(f ->> 'to', '')::date, v_from);
  if v_to < v_from or v_to - v_from > 366 then raise exception 'invalid_input' using detail = 'to'; end if;

  with contacts as (
    select fu.id, fu.actor_id, fu.prospect_id, fu.method, fu.result, fu.effective
    from public.followups fu
    join public.prospects p on p.id = fu.prospect_id
    where p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and fu.contacted_at >= (v_from::timestamp at time zone tz)
      and fu.contacted_at < ((v_to + 1)::timestamp at time zone tz)
  ),
  -- Auxiliares y supervisores activos siempre (aunque en cero); cualquier otro solo si tiene contactos.
  people as (
    select pr.id from public.profiles pr
    where pr.active and pr.role in ('field_assistant', 'field_supervisor')
      and pr.branch_id is not null and (v_branch is null or pr.branch_id = v_branch)
    union
    select c.actor_id from contacts c
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
           count(c.id) as total
    from people pe
    join public.profiles pr on pr.id = pe.id
    left join contacts c on c.actor_id = pe.id
    group by pr.id, pr.full_name, pr.role, pr.active
  )
  select coalesce(jsonb_agg(row_to_json(a) order by a.total desc, a.full_name), '[]'::jsonb) into v_rows from agg a;

  return jsonb_build_object('rows', v_rows);
end;
$$;

create function public.list_agent_contacts(f jsonb, p_limit integer default 50, p_offset integer default 0)
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
    select fu.id as followup_id, fu.prospect_id, p.full_name, fu.contacted_at, fu.method, fu.result, fu.effective, fu.note
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
         coalesce((select jsonb_agg(row_to_json(pg) order by pg.contacted_at desc, pg.followup_id) from page pg), '[]'::jsonb)
  into v_total, v_rows;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

revoke execute on function public.agent_activity(jsonb), public.list_agent_contacts(jsonb, integer, integer) from public, anon;
grant execute on function public.agent_activity(jsonb), public.list_agent_contacts(jsonb, integer, integer) to authenticated;
