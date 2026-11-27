begin;
select plan(21);

-- Spec 032: cierre del día. Obs. 7: resultados solo el mismo día (salvo jefas para arriba o permiso replan_past).
-- Obs. 8: no crear ni copiar asignaciones de un día nuevo si el último día trabajado tiene resultados pendientes.
-- Usuarios del seed: 2 gerente, 3 enc.verdolago (5), 5 sup.verdolago (5), 9 jefe.ventas (sucursales asignadas).
-- La sucursal 5 se vacía dentro de la transacción para no depender de datos de otras pruebas.
delete from public.org_assignments where branch_id = 5;
-- Criterio 14: la fecha de inicio vive en org_day_close_since(). Para que las pruebas no dependan del día en que se
-- corren, aquí rige desde hace 30 días; al final se mueve a hoy (criterios 15 y 16). La transacción lo deshace.
create or replace function public.org_day_close_since() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'America/La_Paz')::date - 30 $$;

create temp table k as
select (now() at time zone 'America/La_Paz')::date as today,
       (select id from public.org_strategies where name = 'Tienda') as tienda,
       (select id from public.org_channels where name = 'Llamadas') as llamadas,
       (select id from public.org_subchannels where name = 'Llamadas a clientes de pedidos') as pedidos,
       (select id from public.org_channels where name = 'Compartidas y estados') as compartidas,
       (select id from public.org_subchannels where name = 'Compartidas WhatsApp') as sh_wa,
       (select id from public.org_channels where name = 'Tareas administrativas') as admin_tasks;
grant select on k to authenticated;
create temp table ids (name text, id uuid);
grant all on ids to authenticated;

-- Inserta directo (como dato que ya existía), sin pasar por las reglas. Solo se usa sin sesión.
create function pg_temp.put(p_name text, p_day date, p_start time, p_channel smallint, p_sub smallint,
  p_goal int, p_result int, p_share int, p_share_result int) returns void
language sql as $$
  with x as (
    insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
      channel_id, subchannel_id, goal, result, share_goal, share_result, created_by)
    values (5, p_day, 'morning', p_start, p_start + interval '30 minutes', '00000000-0000-4000-8000-000000000004',
      (select tienda from k), p_channel, p_sub, p_goal, p_result, p_share, p_share_result,
      '00000000-0000-4000-8000-000000000003')
    returning id)
  insert into ids select p_name, x.id from x
$$;

-- 'ok' o «mensaje:detalle» del error.
create function pg_temp.try(q text) returns text
language plpgsql as $$
declare v_detail text;
begin
  execute q;
  return 'ok';
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return sqlerrm || ':' || coalesce(v_detail, '');
end $$;
grant execute on function pg_temp.try(text) to authenticated;

-- Asignación nueva de Llamadas a clientes de pedidos (meta de captación) para el auxiliar de Verdolago.
create function pg_temp.a(p_day date, p_start text, p_end text, extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('branch_id', 5, 'work_date', p_day, 'shift', 'morning',
    'start_time', p_start, 'end_time', p_end, 'profile_id', '00000000-0000-4000-8000-000000000004',
    'strategy_id', (select tienda from k), 'channel_id', (select llamadas from k),
    'subchannel_id', (select pedidos from k), 'goal', 20) || extra
$$;
grant execute on function pg_temp.a(date, text, text, jsonb) to authenticated;

create function pg_temp.set_result(p_name text, p_args int) returns text
language sql as $$
  select pg_temp.try(case p_args
    when 3 then format('select public.org_set_result(%L::uuid, 5, null)', (select id from ids where name = p_name))
    else format('select public.org_set_result(%L::uuid, 5, null, 3)', (select id from ids where name = p_name)) end)
$$;
grant execute on function pg_temp.set_result(text, int) to authenticated;

-- Id de la primera asignación de hoy (org_assignments solo se lee por RPC con sesión).
create function pg_temp.today_id() returns uuid
language sql security definer as $$
  select id from public.org_assignments where branch_id = 5 and work_date = (select today from k) order by start_time limit 1
$$;
grant execute on function pg_temp.today_id() to authenticated;

create function pg_temp.can_set(p_name text) returns boolean
language sql as $$
  select (r ->> 'can_set_result')::boolean
  from jsonb_array_elements(public.org_list((select today - 1 from k), (select today from k), array[5]::smallint[]) -> 'rows') r
  where r ->> 'id' = (select id::text from ids where name = p_name)
$$;
grant execute on function pg_temp.can_set(text) to authenticated;

-- ===================== Obs. 7: resultados solo el mismo día =====================================================
select pg_temp.put('past', (select today - 1 from k), '08:00', (select llamadas from k), (select pedidos from k), 10, null, null, null);
select pg_temp.put('today', (select today from k), '08:00', (select llamadas from k), (select pedidos from k), 10, null, null, null);

select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(pg_temp.set_result('past', 4), 'forbidden:', '1. el encargado no carga resultados de ayer');
select is(pg_temp.set_result('past', 3), 'forbidden:', '1. tampoco con la versión de 3 argumentos');
select is(pg_temp.set_result('today', 4), 'ok', '2. el encargado carga los resultados de hoy');
select is(pg_temp.can_set('past'), false, '5. org_list: sin botón «Resultado» en ayer para el encargado');
select is(pg_temp.can_set('today'), true, '5. org_list: con botón «Resultado» hoy');
select tests.logout();

select tests.login_as('00000000-0000-4000-8000-000000000005');
select is(pg_temp.set_result('past', 4), 'forbidden:', '2. el supervisor no carga resultados de ayer');
select is(pg_temp.set_result('today', 4), 'ok', '2. el supervisor carga los de hoy');
select tests.logout();

select tests.login_as('00000000-0000-4000-8000-000000000009');
select is(pg_temp.set_result('past', 4), 'ok', '3. el jefe de ventas carga resultados de ayer');
select tests.logout();

select tests.login_as('00000000-0000-4000-8000-000000000002');
select is(pg_temp.can_set('past'), true, '5. org_list: el gerente ve «Resultado» en ayer');
select tests.logout();

insert into public.profile_permissions (profile_id, permission, granted_by)
values ('00000000-0000-4000-8000-000000000003', 'replan_past', '00000000-0000-4000-8000-000000000002');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(pg_temp.set_result('past', 3), 'ok', '4. el encargado con «replan_past» carga resultados de ayer');
select tests.logout();
delete from public.profile_permissions where profile_id = '00000000-0000-4000-8000-000000000003';

-- ===================== Obs. 8: planificar con resultados ========================================================
delete from public.org_assignments where branch_id = 5;
delete from ids;

select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(pg_temp.try(format('select public.org_save(%L)', pg_temp.a((select today from k), '08:00', '08:30'))),
  'ok', '9. sin días anteriores no bloquea (queda una de hoy sin resultado)');
select is(pg_temp.try(format('select public.org_save(%L)', pg_temp.a((select today + 1 from k), '08:00', '08:30'))),
  'results_pending:' || (select today from k) || '|1', '8. crear mañana con resultados de hoy pendientes se rechaza');
select is(pg_temp.try(format('select public.org_save_many(%L)', pg_temp.a((select today + 1 from k), '08:30', '09:00',
  jsonb_build_object('subchannel_id', null, 'goal', null, 'share_goal', null, 'place', '', 'notes', '', 'flyer_ids', '[]'::jsonb,
    'items', jsonb_build_array(jsonb_build_object('subchannel_id', (select pedidos from k), 'goal', 20, 'share_goal', null)))))),
  'results_pending:' || (select today from k) || '|1', '8. la carga múltiple también se rechaza');
select is(pg_temp.try(format('select public.org_copy_day_v2(5::smallint, %L, %L)', (select today from k), (select today + 1 from k))),
  'results_pending:' || (select today from k) || '|1', '8. copiar hoy a mañana también se rechaza');
select is(pg_temp.try(format('select public.org_save(%L)', pg_temp.a((select today from k), '08:00', '08:30',
  jsonb_build_object('id', pg_temp.today_id(), 'goal', 25)))),
  'ok', '11. editar una asignación que ya existe no se bloquea');
select tests.logout();

select tests.login_as('00000000-0000-4000-8000-000000000009');
select is(pg_temp.try(format('select public.org_save(%L)', pg_temp.a((select today + 1 from k), '10:00', '10:30'))),
  'ok', '12. el jefe de ventas planifica aunque falten resultados');
select tests.logout();

-- Ayer: una con meta de captación sin resultado, una con meta de compartidas sin resultado, una sin metas.
select pg_temp.put('y1', (select today - 1 from k), '08:00', (select llamadas from k), (select pedidos from k), 10, null, null, null);
select pg_temp.put('y2', (select today - 1 from k), '09:00', (select compartidas from k), (select sh_wa from k), null, null, 15, null);
select pg_temp.put('y3', (select today - 1 from k), '10:00', (select admin_tasks from k), null, null, null, null, null);

select tests.login_as('00000000-0000-4000-8000-000000000003');
-- Con el resultado de hoy cargado, mañana se destraba aunque ayer siga pendiente (solo cuenta el último día trabajado).
select pg_temp.try(format('select public.org_set_result(%L::uuid, 5, null, null)',
  pg_temp.today_id()));
select is(pg_temp.try(format('select public.org_save(%L)', pg_temp.a((select today + 1 from k), '11:00', '11:30'))),
  'ok', '10. con hoy completo, crear mañana pasa aunque ayer tenga pendientes');
-- Para hoy, el último día trabajado es ayer: cuentan la de captación y la de compartidas, no la que no tiene metas.
select is(pg_temp.try(format('select public.org_save(%L)', pg_temp.a((select today from k), '12:00', '12:30'))),
  'results_pending:' || (select today - 1 from k) || '|2', '8. crear hoy con ayer pendiente: cuenta solo las que tienen meta');
select tests.logout();

-- ===================== Desde cuándo rige (criterios 14 a 16) ====================================================
-- Ahora las reglas rigen desde hoy: ayer queda «antes de la fecha de inicio».
create or replace function public.org_day_close_since() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'America/La_Paz')::date $$;
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(pg_temp.set_result('y1', 4), 'ok', '15. antes de la fecha de inicio, el encargado aún carga el resultado de ayer');
select is((select (r ->> 'can_set_result')::boolean
  from jsonb_array_elements(public.org_list((select today - 1 from k), (select today - 1 from k), array[5]::smallint[]) -> 'rows') r
  where r ->> 'id' = (select id::text from ids where name = 'y2')), true,
  '15. org_list: «Resultado» visible en ayer porque es anterior a la fecha de inicio');
select is(pg_temp.try(format('select public.org_save(%L)', pg_temp.a((select today from k), '13:00', '13:30'))),
  'ok', '16. los pendientes de antes de la fecha de inicio no bloquean');
select tests.logout();

select * from finish();
rollback;
