begin;
select plan(19);

-- Spec 009: daily_report (20261119000300). Día fijo en el pasado (20/05/2025, hora de La Paz) para no chocar con otros datos.
-- Usuarios del seed: 2 gerente, 3 enc.verdolago (5), 4 aux.verdolago (5), 7 enc.trinidad (7), 8 vol.trinidad (7).
insert into public.referrers (branch_id, name, kind) values (5, 'Colegas 009', 'staff');

insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
  stage, status, duplicate_of, void_reason, voided_by, voided_at, referrer_id)
values
  -- Registros del día en Verdolago: 2 de la auxiliar (uno referido) y 1 del encargado
  ('01900000-0000-7000-8000-000000009001', 'Dia Nuevo Uno', '79130001', '79130001', 5, '00000000-0000-4000-8000-000000000004', '2025-05-20 09:00-04', 'morning', 'capture', 'active', null, null, null, null, (select id from public.referrers where name = 'Colegas 009')),
  ('01900000-0000-7000-8000-000000009002', 'Dia Nuevo Dos', '79130002', '79130002', 5, '00000000-0000-4000-8000-000000000004', '2025-05-20 10:00-04', 'morning', 'capture', 'active', null, null, null, null, null),
  ('01900000-0000-7000-8000-000000009003', 'Dia Nuevo Tres', '79130003', '79130003', 5, '00000000-0000-4000-8000-000000000003', '2025-05-20 11:00-04', 'morning', 'capture', 'active', null, null, null, null, null),
  -- Clientes de otros días: uno de hace 3 días (referido) y uno de hace 5 (entran en la semana), uno de hace 10
  ('01900000-0000-7000-8000-000000009004', 'Dia Viejo Tres', '79130004', '79130004', 5, '00000000-0000-4000-8000-000000000004', '2025-05-17 09:00-04', 'morning', 'followup', 'active', null, null, null, null, (select id from public.referrers where name = 'Colegas 009')),
  ('01900000-0000-7000-8000-000000009005', 'Dia Viejo Cinco', '79130005', '79130005', 5, '00000000-0000-4000-8000-000000000004', '2025-05-15 09:00-04', 'morning', 'followup', 'active', null, null, null, null, null),
  ('01900000-0000-7000-8000-000000009006', 'Dia Viejo Diez', '79130006', '79130006', 5, '00000000-0000-4000-8000-000000000004', '2025-05-10 09:00-04', 'morning', 'followup', 'active', null, null, null, null, null),
  -- No cuentan: duplicado rechazado y anulado del mismo día
  ('01900000-0000-7000-8000-000000009007', 'Dia Duplicado', '79130002', '79130002', 5, '00000000-0000-4000-8000-000000000004', '2025-05-20 12:00-04', 'morning', 'capture', 'duplicate_rejected', '01900000-0000-7000-8000-000000009002', null, null, null, null),
  ('01900000-0000-7000-8000-000000009008', 'Dia Anulado', '79130008', '79130008', 5, '00000000-0000-4000-8000-000000000004', '2025-05-20 12:30-04', 'morning', 'capture', 'voided', null, 'prueba', '00000000-0000-4000-8000-000000000003', '2025-05-20 13:00-04', null),
  -- Otra sucursal (Trinidad)
  ('01900000-0000-7000-8000-000000009009', 'Dia Trinidad', '79130009', '79130009', 7, '00000000-0000-4000-8000-000000000008', '2025-05-20 09:30-04', 'morning', 'capture', 'active', null, null, null, null, null);

insert into public.followups (id, prospect_id, contacted_at, result, method, effective, actor_id) values
  -- El viejo de hace 3 días: 3 contactos hoy, uno efectivo; el último lo hizo el encargado
  ('01900000-0000-7000-8000-00000000901a', '01900000-0000-7000-8000-000000009004', '2025-05-20 09:10-04', 'no_answer', 'call', false, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-00000000901b', '01900000-0000-7000-8000-000000009004', '2025-05-20 11:10-04', 'no_answer', 'call', false, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-00000000901c', '01900000-0000-7000-8000-000000009004', '2025-05-20 15:10-04', 'very_interested', 'message', true, '00000000-0000-4000-8000-000000000003'),
  -- Uno nuevo del día, contactado el mismo día
  ('01900000-0000-7000-8000-00000000901d', '01900000-0000-7000-8000-000000009001', '2025-05-20 16:00-04', 'no_answer', 'call', false, '00000000-0000-4000-8000-000000000004'),
  -- Borde: 23:30 de La Paz cuenta hoy; 00:10 del día siguiente no
  ('01900000-0000-7000-8000-00000000901e', '01900000-0000-7000-8000-000000009006', '2025-05-20 23:30-04', 'no_answer', 'call', false, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-00000000901f', '01900000-0000-7000-8000-000000009005', '2025-05-21 00:10-04', 'no_answer', 'call', false, '00000000-0000-4000-8000-000000000004'),
  -- Trinidad
  ('01900000-0000-7000-8000-000000009020', '01900000-0000-7000-8000-000000009009', '2025-05-20 10:00-04', 'no_answer', 'call', false, '00000000-0000-4000-8000-000000000008');

create temp table r as select null::jsonb as j;
grant all on r to authenticated;
create function pg_temp.dr(f jsonb) returns jsonb language sql as $$ select public.daily_report(f) $$;
grant execute on function pg_temp.dr(jsonb) to authenticated;

-- Encargado de Verdolago, todos los orígenes -------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
update r set j = pg_temp.dr('{"from": "2025-05-20"}');
select is(((select j from r) -> 'totals' ->> 'new')::int, 3, 'registros nuevos: 3 (sin duplicado ni anulado)');
select is(((select j from r) -> 'totals' ->> 'new_people')::int, 2, 'registraron 2 personas');
select is(((select j from r) -> 'totals' ->> 'week_new')::int, 5, 'semana (7 días que terminan hoy): 5');
select is(((select j from r) -> 'totals' ->> 'followed')::int, 3, 'clientes con seguimiento: 3 (el de 3 contactos cuenta 1; 23:30 cuenta)');
select is(((select j from r) -> 'totals' ->> 'contacts')::int, 5, 'contactos totales: 5');
select is(((select j from r) -> 'totals' ->> 'effective')::int, 1, 'clientes con algún contacto efectivo: 1');
select is(jsonb_array_length((select j from r) -> 'new_rows'), 3, 'la lista de registros tiene tantas filas como el número');
select is(jsonb_array_length((select j from r) -> 'followed_rows'), 3, 'la lista de seguimiento tiene tantas filas como el número');
select is((select x ->> 'contacts' || '|' || (x ->> 'effective') || '|' || (x ->> 'last_result') || '|' || (x ->> 'last_actor')
           from jsonb_array_elements((select j from r) -> 'followed_rows') x where x ->> 'full_name' = 'Dia Viejo Tres'),
  '3|true|very_interested|Encargado Verdolago', 'la fila trae contactos del día, efectivo y el último contacto');
select ok(not exists (select 1 from jsonb_array_elements((select j from r) -> 'new_rows') x where x ->> 'branch' <> 'VERDOLAGO'),
  'sin filas de otra sucursal');

-- Referidos (FR-004) ---------------------------------------------------------------------------------------------------
update r set j = pg_temp.dr('{"from": "2025-05-20", "origin": "referred"}');
select is(((select j from r) -> 'totals' ->> 'new')::int || '/' || ((select j from r) -> 'totals' ->> 'followed'), '1/2',
  'solo referidos: 1 nuevo y 2 con seguimiento');
update r set j = pg_temp.dr(jsonb_build_object('from', '2025-05-20', 'origin', 'referred',
  'referrer_id', (select id from public.referrers where name = 'Colegas 009')));
select is(((select j from r) -> 'new_rows' -> 0 ->> 'referrer'), 'Colegas 009', 'por referidor: trae su nombre');
select throws_ok($$ select public.daily_report('{"origin": "otro"}') $$, 'P0001', 'invalid_input', 'origen inválido rechazado');

-- Sin listas, para el Panel ---------------------------------------------------------------------------------------------
update r set j = pg_temp.dr('{"from": "2025-05-20", "lists": false}');
select is(jsonb_array_length((select j from r) -> 'new_rows') + jsonb_array_length((select j from r) -> 'followed_rows'), 0,
  'lists=false: sin listas');
select is(((select j from r) -> 'totals' ->> 'followed')::int, 3, 'lists=false: mismos números');

-- Alcance y permisos (FR-005) --------------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000007');
select throws_ok($$ select public.daily_report('{"from": "2025-05-20", "branch_id": 5}') $$, 'P0001', 'forbidden',
  'el encargado de Trinidad no puede pedir Verdolago');
update r set j = pg_temp.dr('{"from": "2025-05-20"}');
select is(((select j from r) -> 'new_rows' -> 0 ->> 'full_name'), 'Dia Trinidad', 'sin pedir sucursal, el encargado ve solo la suya');
select tests.login_as('00000000-0000-4000-8000-000000000002');
update r set j = pg_temp.dr('{"from": "2025-05-20"}');
select ok(((select j from r) -> 'totals' ->> 'new')::int >= 4, 'gerencia sin sucursal ve todas');
select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.daily_report('{}') $$, 'P0001', 'forbidden', 'la auxiliar no tiene acceso');

select * from finish();
rollback;
