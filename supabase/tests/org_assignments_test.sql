begin;
select plan(39);
-- Spec 032: sin resultados pendientes heredados de otras corridas (la transacción se deshace al final).
delete from public.org_assignments where branch_id in (5, 7);
-- Spec 032: las reglas del cierre del día rigen desde hace 30 días en esta prueba, para que «ayer» siempre cuente.
create or replace function public.org_day_close_since() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'America/La_Paz')::date - 30 $$;

-- Usuarios del seed: 3 enc.verdolago, 4 aux.verdolago, 5 sup.verdolago, 6 vol.verdolago, 7 enc.trinidad,
-- 9 jefe.ventas (Verdolago y Trinidad), 2 gerente, 1 admin.
create temp table k as
select (now() at time zone 'America/La_Paz')::date as today,
       (now() at time zone 'America/La_Paz')::date + 1 as tomorrow,
       (select id from public.org_strategies where name = 'Calle') as calle,
       (select id from public.org_strategies where name = 'Tienda') as tienda,
       (select id from public.org_channels where name = 'Activación') as activacion,
       (select id from public.org_channels where name = 'Llamadas') as llamadas,
       (select id from public.org_subchannels where name = 'Activaciones en barrios') as barrios;
grant select on k to authenticated;
create temp table ids (name text, id uuid);
grant all on ids to authenticated;

create function pg_temp.payload(p_day date, p_profile text, extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('branch_id', 5, 'work_date', p_day, 'shift', 'morning', 'start_time', '10:00', 'end_time', '12:00',
    'profile_id', p_profile, 'strategy_id', (select calle from k), 'channel_id', (select activacion from k),
    'subchannel_id', (select barrios from k), 'place', 'Barrio Litoral', 'goal', 30) || extra
$$;
grant execute on function pg_temp.payload(date, text, jsonb) to authenticated;

-- La fila de una asignación creada por este test (spec 018: no depende de otras filas que haya en la base local).
create function pg_temp.row_of(p_name text, p_from date, p_to date) returns jsonb
language sql as $$
  select r from jsonb_array_elements(public.org_list(p_from, p_to) -> 'rows') r
  where r ->> 'id' = (select id::text from ids where name = p_name)
$$;
grant execute on function pg_temp.row_of(text, date, date) to authenticated;

-- Encargado: crea para mañana y para hoy
select tests.login_as('00000000-0000-4000-8000-000000000003');
insert into ids select 'tomorrow', public.org_save(pg_temp.payload((select tomorrow from k), '00000000-0000-4000-8000-000000000004'));
insert into ids select 'today', public.org_save(pg_temp.payload((select today from k), '00000000-0000-4000-8000-000000000005'));
select is((select count(*)::int from ids), 2, 'el encargado crea asignaciones para mañana y para hoy');
select is(
  pg_temp.row_of('today', (select today from k), (select tomorrow from k)) ->> 'lead',
  'Jefe de Ventas Prueba', 'el gerente a cargo se copia solo');
select is(
  pg_temp.row_of('today', (select today from k), (select tomorrow from k)) ->> 'subchannel',
  'Activaciones en barrios', 'devuelve el subcanal');

-- Catálogo y persona inválidos
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select tomorrow from k), '00000000-0000-4000-8000-000000000004', jsonb_build_object('strategy_id', (select tienda from k)))),
  'P0001', 'invalid_input', 'canal de otra estrategia rechazado');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select tomorrow from k), '00000000-0000-4000-8000-000000000004',
    jsonb_build_object('channel_id', (select llamadas from k), 'strategy_id', (select tienda from k)))),
  'P0001', 'invalid_input', 'subcanal de otro canal rechazado');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select tomorrow from k), '00000000-0000-4000-8000-000000000007')),
  'P0001', 'invalid_input', 'persona de otra sucursal rechazada');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select tomorrow from k), '00000000-0000-4000-8000-000000000004', '{"start_time":"12:00","end_time":"10:00"}')),
  'P0001', 'invalid_input', 'fin antes del inicio rechazado');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select tomorrow from k), '00000000-0000-4000-8000-000000000004', '{"goal":10000}')),
  'P0001', 'invalid_input', 'meta fuera de rango rechazada');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select tomorrow from k), '00000000-0000-4000-8000-000000000004', '{"branch_id":7}')),
  'P0001', 'forbidden', 'el encargado no carga en otra sucursal');

-- Límite por fecha (FR-029, cambiado por spec 018: el encargado replanifica hasta el mismo día; los pasados, no)
select lives_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select tomorrow from k), '00000000-0000-4000-8000-000000000004', jsonb_build_object('id', (select id from ids where name = 'tomorrow'), 'goal', 40))),
  'el encargado cambia la meta de mañana');
select lives_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select today from k), '00000000-0000-4000-8000-000000000005', jsonb_build_object('id', (select id from ids where name = 'today'), 'goal', 5))),
  'el encargado cambia la meta de hoy (018)');
-- Otra asignación de hoy solo para quitarla (la de arriba sigue para los resultados).
insert into ids select 'today_del', public.org_save(pg_temp.payload((select today from k), '00000000-0000-4000-8000-000000000004',
  '{"shift":"afternoon","start_time":"16:00","end_time":"18:00"}'));
select lives_ok(format($$ select public.org_delete(%L) $$, (select id from ids where name = 'today_del')),
  'el encargado elimina una asignación de hoy (018)');
select lives_ok(format($$ select public.org_set_result(%L, 15, '5 ventas concretadas') $$, (select id from ids where name = 'today')),
  'el encargado registra el resultado de hoy');
select is(pg_temp.row_of('today', (select today from k), (select today from k)) ->> 'result', '15', 'resultado guardado');
select throws_ok(format($$ select public.org_set_result(%L, 10000, null) $$, (select id from ids where name = 'today')),
  'P0001', 'invalid_input', 'resultado fuera de rango rechazado');
select is((pg_temp.row_of('today', (select today from k), (select today from k)) ->> 'can_replan')::boolean,
  true, 'la fila de hoy deja replanificar al encargado (018)');

-- Días pasados (018): la asignación de ayer la carga gerencia; encargado y supervisor no la cambian ni la quitan.
select tests.login_as('00000000-0000-4000-8000-000000000002');
insert into ids select 'yesterday', public.org_save(pg_temp.payload((select today - 1 from k), '00000000-0000-4000-8000-000000000004'));
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select today - 1 from k), '00000000-0000-4000-8000-000000000004', jsonb_build_object('id', (select id from ids where name = 'yesterday'), 'goal', 5))),
  'P0001', 'forbidden', 'el encargado no cambia la meta de ayer (018)');
select throws_ok(format($$ select public.org_delete(%L) $$, (select id from ids where name = 'yesterday')),
  'P0001', 'forbidden', 'el encargado no elimina una asignación de ayer (018)');
select is((pg_temp.row_of('yesterday', (select today - 1 from k), (select today - 1 from k)) ->> 'can_replan')::boolean,
  false, 'la fila de ayer avisa que el encargado no puede replanificar (018)');
select throws_ok(format($$ select public.org_set_result(%L, 3, null) $$, (select id from ids where name = 'yesterday')),
  'P0001', 'forbidden', 'el encargado ya no registra el resultado de ayer (032, obs. 7)');

-- Supervisor: mismos permisos que el encargado
select tests.login_as('00000000-0000-4000-8000-000000000005');
select is(
  (select count(*)::int from jsonb_array_elements(public.org_list((select today from k), (select tomorrow from k)) -> 'rows') r
   where r ->> 'id' in (select id::text from ids where name in ('today', 'tomorrow'))),
  2, 'el supervisor ve toda la sucursal');
select lives_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select tomorrow from k), '00000000-0000-4000-8000-000000000005')), 'el supervisor carga una asignación');
select lives_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select today from k), '00000000-0000-4000-8000-000000000005', jsonb_build_object('id', (select id from ids where name = 'today'), 'goal', 5))),
  'el supervisor cambia la meta de hoy (018)');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select today - 1 from k), '00000000-0000-4000-8000-000000000004', jsonb_build_object('id', (select id from ids where name = 'yesterday'), 'goal', 5))),
  'P0001', 'forbidden', 'el supervisor no cambia la meta de ayer (018)');
select throws_ok(format($$ select public.org_delete(%L) $$, (select id from ids where name = 'yesterday')),
  'P0001', 'forbidden', 'el supervisor no elimina una asignación de ayer (018)');

-- Auxiliar: solo lo suyo y sin escribir
select tests.login_as('00000000-0000-4000-8000-000000000004');
select is(
  (select array_agg(distinct r ->> 'person') from jsonb_array_elements(public.org_list((select today from k), (select tomorrow from k)) -> 'rows') r),
  array['Auxiliar Verdolago'], 'el auxiliar ve solo sus asignaciones');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select tomorrow from k), '00000000-0000-4000-8000-000000000004')), 'P0001', 'forbidden', 'el auxiliar no carga');

-- Volantera: sin acceso
select tests.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.org_list(current_date, current_date) $$, 'P0001', 'forbidden', 'la volantera no ve la organización');

-- Otra sucursal
select tests.login_as('00000000-0000-4000-8000-000000000007');
select throws_ok($$ select public.org_list(current_date, current_date, array[5::smallint]) $$, 'P0001', 'forbidden', 'el encargado de Trinidad no ve Verdolago');
select is(jsonb_array_length(public.org_list((select today from k), (select tomorrow from k)) -> 'rows'), 0, 'el encargado de Trinidad ve solo la suya');

-- Jefe de ventas: cambia la meta de hoy en su sucursal
select tests.login_as('00000000-0000-4000-8000-000000000009');
select lives_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select today from k), '00000000-0000-4000-8000-000000000005', jsonb_build_object('id', (select id from ids where name = 'today'), 'goal', 25))),
  'el jefe de ventas cambia la meta de hoy');
select tests.logout(); -- audit_log no se lee desde la app
select ok(exists (select 1 from public.audit_log where table_name = 'org_assignments'
  and row_id = (select id from ids where name = 'today') and new ->> 'goal' = '25'), 'el cambio queda en el historial');

-- Copia de día: sin resultado ni observaciones
select tests.login_as('00000000-0000-4000-8000-000000000003');
-- Copia todo lo del día de la sucursal (puede haber filas de la base local además de las de este test).
select is(public.org_copy_day(5::smallint, (select today from k), (select today + 7 from k)),
  jsonb_array_length(public.org_list((select today from k), (select today from k)) -> 'rows'), 'copia las asignaciones del día');
select ok(
  (select bool_and(r ->> 'result' is null and r ->> 'notes' is null)
   from jsonb_array_elements(public.org_list((select today + 7 from k), (select today + 7 from k)) -> 'rows') r),
  'la copia va sin resultado ni observaciones');

-- Marcas del catálogo (20261117000400): Tienda no guarda lugar; Comentarios no guarda meta; Llamadas sí.
-- 008: los canales con subcanales exigen subcanal.
insert into ids select 'comentarios', public.org_save(pg_temp.payload((select today + 2 from k), '00000000-0000-4000-8000-000000000004',
  jsonb_build_object('strategy_id', (select tienda from k),
    'subchannel_id', (select id from public.org_subchannels where name = 'Comentarios Facebook'),
    'channel_id', (select id from public.org_channels where name = 'Comentarios'))));
insert into ids select 'llamadas', public.org_save(pg_temp.payload((select today + 2 from k), '00000000-0000-4000-8000-000000000005',
  jsonb_build_object('strategy_id', (select tienda from k),
    'subchannel_id', (select id from public.org_subchannels where name = 'Llamadas a clientes de pedidos'),
    'channel_id', (select llamadas from k))));
select ok(
  (select r ->> 'place' is null and r ->> 'goal' is null
   from jsonb_array_elements(public.org_list((select today + 2 from k), (select today + 2 from k)) -> 'rows') r
   where r ->> 'id' = (select id::text from ids where name = 'comentarios')),
  'Tienda + Comentarios: se guarda sin lugar ni meta aunque lleguen');
select ok(
  (select r ->> 'place' is null and r ->> 'goal' = '30'
   from jsonb_array_elements(public.org_list((select today + 2 from k), (select today + 2 from k)) -> 'rows') r
   where r ->> 'id' = (select id::text from ids where name = 'llamadas')),
  'Tienda + Llamadas: sin lugar, con meta');
select lives_ok(format($$ select public.org_save(%L) $$,
  pg_temp.payload((select today + 2 from k), '00000000-0000-4000-8000-000000000004',
    jsonb_build_object('strategy_id', (select tienda from k),
      -- 008: si el canal ya tiene subcanales (los agrega ventas), hay que elegir uno; si no, queda vacío
      'subchannel_id', (select sc.id from public.org_subchannels sc join public.org_channels c on c.id = sc.channel_id
                        where c.name = 'Tareas administrativas' and sc.active order by sc.id limit 1),
      'channel_id', (select id from public.org_channels where name = 'Tareas administrativas')))),
  'se asigna «Tareas administrativas» en Tienda');

-- Eliminar deja la fila en el historial
select lives_ok(format($$ select public.org_delete(%L) $$, (select id from ids where name = 'tomorrow')), 'el encargado elimina una asignación de mañana');
select tests.logout();
select ok(exists (select 1 from public.audit_log where table_name = 'org_assignments'
  and row_id = (select id from ids where name = 'tomorrow') and new is null), 'la eliminación queda en el historial');

select * from finish();
rollback;
