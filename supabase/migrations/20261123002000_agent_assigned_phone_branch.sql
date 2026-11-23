-- Spec 020: «Clientes asignados» de Actividad con lupa y reasignación.
-- list_agent_assigned igual a 20261121000200 (spec 012) más phone_raw, phone_norm y branch_id del cliente por fila.
-- Misma firma, mismos permisos (is_manager + scoped_branch) y mismos grants: compatible con la app anterior
-- (los campos nuevos se ignoran). La reasignación usa assign_prospects sin cambios.

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
