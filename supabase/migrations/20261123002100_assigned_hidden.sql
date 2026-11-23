-- Spec 021: depurar «Clientes asignados» de Actividad (ocultar sin borrar).
-- 1) Tabla assigned_hidden: marca «oculto» por (cliente, persona del modal), con quién y cuándo. Nada se borra del
--    cliente ni de su historial; «Mostrar» quita la marca. RLS sin políticas: acceso solo por RPC.
-- 2) set_assigned_hidden: ocultar/mostrar a mano. 3) hide_assigned_contacted: el «Ocultar» del aviso (todos los
--    contactados no ocultos del período, sin el límite de 500 filas).
--    Permiso: encargado, jefe de ventas, gerente y admin (is_manager), cada cliente dentro de sus sucursales
--    (manages_branch). Todo o nada.
-- 4) list_agent_assigned: igual a 20261123002000 (spec 020, conserva phone_raw, phone_norm y branch_id) más `hidden`
--    por fila y `hidden_total` / `contacted_visible` del período. Misma firma y grants.
-- Los números de Actividad (agent_activity) salen de assignment_events/followups y no cambian.

create table if not exists public.assigned_hidden (
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  agent_id uuid not null references public.profiles (id),
  hidden_by uuid not null references public.profiles (id),
  hidden_at timestamptz not null default now(),
  primary key (prospect_id, agent_id)
);
create index if not exists assigned_hidden_agent_idx on public.assigned_hidden (agent_id);
alter table public.assigned_hidden enable row level security;
revoke all on public.assigned_hidden from public, anon, authenticated;

-- Verifica que quien llama gestiona la sucursal de cada cliente (todo o nada).
create or replace function public.assigned_hidden_check(p_prospects uuid[]) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  if exists (
    select 1 from unnest(p_prospects) as x(id)
    left join public.prospects p on p.id = x.id
    where p.id is null or not public.manages_branch(p.branch_id)
  ) then raise exception 'forbidden'; end if;
end;
$$;
revoke execute on function public.assigned_hidden_check(uuid[]) from public, anon, authenticated;

create or replace function public.set_assigned_hidden(p_agent uuid, p_prospects uuid[], p_hidden boolean)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  if p_agent is null then raise exception 'invalid_input' using detail = 'p_agent'; end if;
  if coalesce(cardinality(p_prospects), 0) = 0 then raise exception 'invalid_input' using detail = 'p_prospects'; end if;
  if p_hidden is null then raise exception 'invalid_input' using detail = 'p_hidden'; end if;
  perform public.assigned_hidden_check(p_prospects);

  if p_hidden then
    insert into public.assigned_hidden (prospect_id, agent_id, hidden_by)
    select distinct x.id, p_agent, auth.uid() from unnest(p_prospects) as x(id)
    on conflict do nothing;
  else
    delete from public.assigned_hidden h where h.agent_id = p_agent and h.prospect_id = any (p_prospects);
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.set_assigned_hidden(uuid, uuid[], boolean) from public, anon;
grant execute on function public.set_assigned_hidden(uuid, uuid[], boolean) to authenticated;

-- «Ocultar» del aviso: los contactados no ocultos del período de la persona, con la misma definición que
-- list_agent_assigned (primera asignación del período; contacto suyo desde esa asignación; cliente activo).
create or replace function public.hide_assigned_contacted(f jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_branch smallint;
  v_from date;
  v_to date;
  v_actor uuid := nullif(f ->> 'actor_id', '')::uuid;
  v_ids uuid[];
  v_n int;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  v_branch := public.scoped_branch(nullif(f ->> 'branch_id', '')::smallint);
  if v_actor is null then raise exception 'invalid_input' using detail = 'actor_id'; end if;
  v_from := coalesce(nullif(f ->> 'from', '')::date, (now() at time zone tz)::date);
  v_to := coalesce(nullif(f ->> 'to', '')::date, v_from);
  if v_to < v_from or v_to - v_from > 366 then raise exception 'invalid_input' using detail = 'to'; end if;

  with asg as (
    select distinct on (ae.prospect_id) ae.prospect_id, ae.created_at as assigned_at
    from public.assignment_events ae
    join public.prospects p on p.id = ae.prospect_id
    where ae.to_user = v_actor and p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and ae.created_at >= (v_from::timestamp at time zone tz)
      and ae.created_at < ((v_to + 1)::timestamp at time zone tz)
    order by ae.prospect_id, ae.created_at
  )
  select coalesce(array_agg(a.prospect_id), '{}') into v_ids
  from asg a
  where exists (select 1 from public.followups fu
                where fu.prospect_id = a.prospect_id and fu.actor_id = v_actor and fu.contacted_at >= a.assigned_at)
    and not exists (select 1 from public.assigned_hidden h where h.prospect_id = a.prospect_id and h.agent_id = v_actor);

  if cardinality(v_ids) = 0 then return 0; end if;
  perform public.assigned_hidden_check(v_ids);
  insert into public.assigned_hidden (prospect_id, agent_id, hidden_by)
  select x.id, v_actor, auth.uid() from unnest(v_ids) as x(id)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.hide_assigned_contacted(jsonb) from public, anon;
grant execute on function public.hide_assigned_contacted(jsonb) to authenticated;

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
  v_hidden bigint;
  v_contacted_visible bigint;
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
           -- 020: celular (buscar con la lupa) y sucursal del cliente (opciones de «Asignar a…»).
           p.phone_raw, p.phone_norm, p.branch_id,
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
              where ae2.prospect_id = a.prospect_id and ae2.created_at > a.assigned_at) end as reassigned_at,
           -- 021: oculto en la lista de esta persona (solo vista; no cambia nada más).
           exists (select 1 from public.assigned_hidden h
                   where h.prospect_id = a.prospect_id and h.agent_id = v_actor) as hidden
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
         (select count(*) from full_rows where hidden),
         (select count(*) from full_rows where contacts > 0 and not hidden),
         coalesce((select jsonb_agg(row_to_json(x) order by x.assigned_at, x.full_name)
                   from (select * from full_rows order by assigned_at, full_name limit 500) x), '[]'::jsonb)
  into v_total, v_hidden, v_contacted_visible, v_rows;

  return jsonb_build_object('total', v_total, 'hidden_total', v_hidden, 'contacted_visible', v_contacted_visible,
                            'rows', v_rows);
end;
$$;
revoke execute on function public.list_agent_assigned(jsonb) from public, anon;
grant execute on function public.list_agent_assigned(jsonb) to authenticated;
