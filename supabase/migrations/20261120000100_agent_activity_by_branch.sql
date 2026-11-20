-- Actividad: resumen por sucursal (pestaña «Por sucursal» de /gestion › Actividad).
-- Misma función agent_activity, con el mismo acceso y filas; agrega `by_branch` solo cuando la consulta abarca todas
-- las sucursales (v_branch null = Gerencia/Sistemas sin sucursal elegida). La sucursal de un contacto es la del
-- cliente (igual que el filtro), por eso se calcula aquí: «Clientes» cuenta clientes distintos y no se puede sumar
-- desde las filas por persona.
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
  ),
  -- Una fila por sucursal activa (también en cero), solo cuando se piden todas las sucursales.
  -- staff = auxiliares y supervisores activos de la sucursal; actors = personas distintas que contactaron
  -- a clientes de esa sucursal.
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
