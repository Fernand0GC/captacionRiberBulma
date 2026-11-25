-- Spec 028 · La Agenda de recontacto refleja los asignados del día.
-- Observación de ventas (25/11): «no refleja los clientes asignados del día». Rene tenía 15 «Asignados» en Actividad y
-- 13 en «Le tocaba hoy»: 2 le llegaron hoy con una visita/llamada ya agendada para más adelante y la agenda no los traía.
-- recontact_agenda cambia en dos cosas (solo lectura, sin tablas nuevas):
--   1) Trae también lo que el responsable actual recibió hoy aunque esté agendado más adelante (abierto). La app lo
--      muestra en «Para más adelante», sin sumarlo a Le tocaba hoy / Pendientes / Atrasados.
--   2) Devuelve `assigned`: por persona, «Asignados hoy» con la MISMA regla que «Asignados» de Actividad (012: primera
--      asignación del día a la persona; 024: si ya pasó a otra persona y nunca la contactó, no cuenta) y `passed_on`
--      (de esos, los que contactó y ya pasaron a otra persona). supabase/tests/agenda_assigned_today_test.sql compara
--      los dos números persona por persona.
-- Parches idempotentes sobre la definición vigente (023 + 026): si el texto ya está, no cambian nada; si no encuentran
-- el texto esperado, fallan y no cambian nada.
--
-- Volver atrás: volver a correr el bloque 1 de 20261124000100_recontacto_visible.sql (recrea recontact_agenda) y
-- después el parche 2 de 20261124000400_contact_priority.sql (prioridad de hoy). La app tolera que falte `assigned`.

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
  if position('passed_on' in pg_get_functiondef('public.recontact_agenda(jsonb)'::regprocedure)) > 0 then
    raise notice 'recontact_agenda ya tiene los asignados de hoy (028): no se cambia';
    return;
  end if;

  -- 1) Recibido hoy por el responsable actual, abierto, aunque esté agendado más adelante.
  perform pg_temp.patch_function('public.recontact_agenda(jsonb)',
    'or lf.contacted_at >= v_start',
    'or lf.contacted_at >= v_start
        -- 028: recibido hoy por el responsable actual (la app lo muestra en «Para más adelante» si no le toca hoy).
        or (p.stage not in (''sale'', ''lost'') and exists (
              select 1 from public.assignment_events e
              where e.prospect_id = p.id and e.to_user = p.assigned_to and e.created_at >= v_start))');

  -- 2) «Asignados hoy» por persona, con la regla de agent_activity.
  perform pg_temp.patch_function('public.recontact_agenda(jsonb)',
    'v_truncated boolean;',
    'v_truncated boolean;
  v_assigned jsonb;');
  perform pg_temp.patch_function('public.recontact_agenda(jsonb)',
    'return jsonb_build_object(''today'', v_today, ''people'', v_people, ''rows'', v_rows, ''truncated'', v_truncated);',
    '-- 028: «Asignados hoy» = «Asignados» de Actividad para hoy (misma consulta que el CTE asg de agent_activity).
  with a as (
    select distinct on (ae.to_user, ae.prospect_id)
           ae.to_user as actor_id, ae.prospect_id, ae.created_at as assigned_at,
           (p.assigned_to is not distinct from ae.to_user) as still_owner
    from public.assignment_events ae
    join public.prospects p on p.id = ae.prospect_id
    where ae.to_user is not null and p.status = ''active''
      and (v_branch is null or p.branch_id = v_branch)
      and ae.created_at >= v_start
      and ae.created_at < ((v_today + 1)::timestamp at time zone tz)
    order by ae.to_user, ae.prospect_id, ae.created_at
  ),
  counted as (
    select a.actor_id, a.still_owner
    from a
    where a.still_owner or exists (
      select 1 from public.followups fu
      where fu.prospect_id = a.prospect_id and fu.actor_id = a.actor_id and fu.contacted_at >= a.assigned_at
    )
  ),
  ids as (
    select (pp ->> ''id'')::uuid as id from jsonb_array_elements(v_people) pp
    union
    select c.actor_id from counted c
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           ''id'', ids.id,
           ''assigned'', (select count(*) from counted c where c.actor_id = ids.id),
           ''passed_on'', (select count(*) from counted c where c.actor_id = ids.id and not c.still_owner))), ''[]''::jsonb),
         -- Quien recibió asignaciones hoy y no estaba en la lista (sin agenda ni personal fijo) también aparece.
         v_people || coalesce((
           select jsonb_agg(jsonb_build_object(''id'', pr.id, ''full_name'', pr.full_name, ''role'', pr.role, ''branch_id'', pr.branch_id)
                            order by pr.full_name)
           from public.profiles pr
           where pr.id in (select c.actor_id from counted c)
             and not exists (select 1 from jsonb_array_elements(v_people) pp where (pp ->> ''id'')::uuid = pr.id)
         ), ''[]''::jsonb)
  into v_assigned, v_people
  from ids;

  return jsonb_build_object(''today'', v_today, ''people'', v_people, ''rows'', v_rows, ''truncated'', v_truncated,
                            ''assigned'', v_assigned);');
end;
$do$;
