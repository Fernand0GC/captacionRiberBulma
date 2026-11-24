-- Spec 024 (pedido de ventas, 2026-11-24): que no se le inflen los «Asignados» a quien no llegó a trabajar al cliente.
-- 1) Un cliente que ya pasó a otra persona (o quedó sin responsable) y que la persona NUNCA contactó deja de contar en
--    sus «Asignados», en el modal y en Actividad. El que sí contactó sigue contando: hizo su parte del flujo
--    Captación → Recaptación → Seguimiento → Cliente potencial → Venta, donde pasar al cliente es lo normal.
--    El total de la sucursal sigue siendo la suma de las personas.
-- 2) «A qué proceso pasaron» usa la etapa en que la persona DEJÓ al cliente (stage_left), no la de hoy: la venta que
--    cerró otra persona más adelante no se le cuenta a quien hizo la captación.
-- 3) El resumen del modal lo calcula el servidor sobre todo el período (antes la pantalla sumaba las primeras 500 filas).
-- Solo cambia funciones de lectura; no toca datos. Volver atrás: aplicar de nuevo 20261123002100 (list_agent_assigned)
-- y quitar el filtro «024» de agent_activity (ver el bloque 2).

-- 1) list_agent_assigned ---------------------------------------------------------------------------------------------
create or replace function public.list_agent_assigned(f jsonb)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_branch smallint;
  v_from date;
  v_to date;
  v_actor uuid := nullif(f ->> 'actor_id', '')::uuid;
  v_result jsonb;
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
  base as (
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
           -- 024: cuándo salió de sus manos (el primer traspaso desde ella después de asignársele).
           case when p.assigned_to is distinct from v_actor then
             (select min(ae3.created_at) from public.assignment_events ae3
              where ae3.prospect_id = a.prospect_id and ae3.from_user = v_actor and ae3.created_at > a.assigned_at) end as left_at,
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
  ),
  -- 024: etapa en que lo dejó (si sigue a su cargo, la de hoy) y si cuenta en sus «Asignados».
  staged as (
    select b.*,
           case when b.reassigned and b.left_at is not null then
             coalesce((select se.to_stage from public.stage_events se
                       where se.prospect_id = b.prospect_id and se.created_at <= b.left_at
                       order by se.created_at desc, se.id desc limit 1), b.stage_at)
           else b.stage_now end as stage_left,
           not (b.reassigned and b.contacts = 0) as counted
    from base b
  ),
  full_rows as (
    select s.*,
           -- Grupo de «A qué proceso pasaron»: sin contactar, sin cambio (Captación sigue en Captación) o la etapa en
           -- que lo dejó.
           case when s.contacts = 0 then 'none'
                when s.stage_left = s.stage_at or s.stage_left = 'capture' then 'same'
                else s.stage_left::text end as outcome
    from staged s
  ),
  mine as (select * from full_rows where counted)
  select jsonb_build_object(
    'total', (select count(*) from mine),
    'reassigned_uncontacted', (select count(*) from full_rows where not counted),
    -- «N ocultos» y «Ver ocultos» son de la lista de sus asignados: no cuentan los reasignados sin contactar.
    'hidden_total', (select count(*) from mine where hidden),
    'contacted_visible', (select count(*) from full_rows where contacts > 0 and not hidden),
    'summary', jsonb_build_object(
      'contacted', (select count(*) from mine where contacts > 0),
      'contacted_later', (select count(*) from mine
                          where contacts > 0 and (first_at at time zone tz)::date > (assigned_at at time zone tz)::date),
      'by_origin', (select jsonb_object_agg(st, jsonb_build_object(
                      'n', (select count(*) from mine c where c.stage_at::text = st),
                      'contacted', (select count(*) from mine c where c.stage_at::text = st and c.contacts > 0)))
                    from unnest(enum_range(null::public.prospect_stage)::text[]) st),
      'by_outcome', (select jsonb_object_agg(g, (select count(*) from mine c where c.outcome = g))
                     from unnest(array['sale', 'interested', 'followup', 'recapture', 'lost', 'same', 'none']) g)),
    -- Primero los que cuentan: si el período pasa de 500, los reasignados sin contactar son los que quedan fuera.
    'rows', coalesce((select jsonb_agg(to_jsonb(x) - 'left_at' order by not x.counted, x.assigned_at, x.full_name)
                      from (select * from full_rows order by not counted, assigned_at, full_name limit 500) x), '[]'::jsonb))
  into v_result;

  return v_result;
end;
$$;
revoke execute on function public.list_agent_assigned(jsonb) from public, anon;
grant execute on function public.list_agent_assigned(jsonb) to authenticated;

-- 2) agent_activity: la misma regla en «Asignados» por persona y por sucursal -----------------------------------------
create or replace function pg_temp.patch_function(p_sig text, p_old text, p_new text) returns void language plpgsql as $$
declare
  d text := pg_get_functiondef(p_sig::regprocedure);
begin
  if position(p_old in d) = 0 then
    raise exception 'patch_function: no se encontró el texto en %: %', p_sig, p_old;
  end if;
  execute replace(d, p_old, p_new);
end;
$$;

do $do$
begin
  if position('still_owner' in pg_get_functiondef('public.agent_activity(jsonb)'::regprocedure)) > 0 then
    raise notice 'agent_activity ya descuenta los reasignados sin contactar: no se cambia';
  else
    perform pg_temp.patch_function('public.agent_activity(jsonb)',
      'ae.to_user as actor_id, ae.prospect_id, p.branch_id, ae.created_at as assigned_at',
      'ae.to_user as actor_id, ae.prospect_id, p.branch_id, ae.created_at as assigned_at,
             (p.assigned_to is not distinct from ae.to_user) as still_owner');
    perform pg_temp.patch_function('public.agent_activity(jsonb)',
      E'    ) a\n  ),',
      E'    ) a\n    -- 024: el que ya pasó a otra persona y nunca contactó no le cuenta.\n'
      '    where a.still_owner or exists (
      select 1 from public.followups fu
      where fu.prospect_id = a.prospect_id and fu.actor_id = a.actor_id and fu.contacted_at >= a.assigned_at
    )
  ),');
  end if;
end;
$do$;
