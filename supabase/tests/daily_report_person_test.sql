begin;
select plan(19);

-- Filtro Persona de «Del día» (daily_report con person_id). Día fijo en el pasado (10/06/2025, hora de La Paz).
-- Usuarios del seed: 2 gerente, 3 enc.verdolago (5), 4 aux.verdolago (5), 7 enc.trinidad (7), 8 vol.trinidad (7).
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
  stage, status)
values
  -- Registros del día en Verdolago: uno de la auxiliar y uno del encargado
  ('01900000-0000-7000-8000-00000000a001', 'Per Nuevo Aux', '7914 0001', '79140001', 5, '00000000-0000-4000-8000-000000000004', '2025-06-10 09:00-04', 'morning', 'capture', 'active'),
  ('01900000-0000-7000-8000-00000000a002', 'Per Nuevo Enc', '79140002', '79140002', 5, '00000000-0000-4000-8000-000000000003', '2025-06-10 10:00-04', 'morning', 'capture', 'active'),
  -- Registrado por la auxiliar hace 5 días (entra en la semana)
  ('01900000-0000-7000-8000-00000000a003', 'Per Viejo', '79140003', '79140003', 5, '00000000-0000-4000-8000-000000000004', '2025-06-05 09:00-04', 'morning', 'followup', 'active'),
  -- Trinidad
  ('01900000-0000-7000-8000-00000000a004', 'Per Trinidad', '79140004', '79140004', 7, '00000000-0000-4000-8000-000000000008', '2025-06-10 09:30-04', 'morning', 'capture', 'active');

insert into public.followups (id, prospect_id, contacted_at, result, method, effective, actor_id) values
  -- Per Viejo: la auxiliar 2 veces (la primera efectiva) y el encargado al final, sin contestar
  ('01900000-0000-7000-8000-00000000a01a', '01900000-0000-7000-8000-00000000a003', '2025-06-10 09:00-04', 'very_interested', 'whatsapp_call', true, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-00000000a01b', '01900000-0000-7000-8000-00000000a003', '2025-06-10 10:00-04', 'no_answer', 'call', false, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-00000000a01c', '01900000-0000-7000-8000-00000000a003', '2025-06-10 12:00-04', 'no_answer', 'call', false, '00000000-0000-4000-8000-000000000003'),
  -- Per Nuevo Aux: solo el encargado
  ('01900000-0000-7000-8000-00000000a01d', '01900000-0000-7000-8000-00000000a001', '2025-06-10 13:00-04', 'no_answer', 'call', false, '00000000-0000-4000-8000-000000000003'),
  -- Trinidad
  ('01900000-0000-7000-8000-00000000a01e', '01900000-0000-7000-8000-00000000a004', '2025-06-10 11:00-04', 'no_answer', 'call', false, '00000000-0000-4000-8000-000000000008');

create temp table r as select null::jsonb as j;
grant all on r to authenticated;
create function pg_temp.dr(f jsonb) returns jsonb language sql as $$ select public.daily_report(f) $$;
grant execute on function pg_temp.dr(jsonb) to authenticated;
create function pg_temp.row_of(name text) returns jsonb language sql as $$
  select x from jsonb_array_elements((select j from r) -> 'followed_rows') x where x ->> 'full_name' = name
$$;
grant execute on function pg_temp.row_of(text) to authenticated;

select tests.login_as('00000000-0000-4000-8000-000000000003');

-- Sin persona: las opciones del selector -------------------------------------------------------------------------------
update r set j = pg_temp.dr('{"from": "2025-06-10"}');
select is((select string_agg(x ->> 'name', ',' order by ord) from jsonb_array_elements((select j from r) -> 'people') with ordinality t(x, ord)),
  'Auxiliar Verdolago,Encargado Verdolago', 'people: quienes registraron o contactaron ese día en el alcance, por nombre');
select is(((select j from r) -> 'people' -> 0 ->> 'id'), '00000000-0000-4000-8000-000000000004', 'people trae el id');
select is((pg_temp.row_of('Per Viejo') ->> 'phone_norm'), '79140003', 'filas de seguimiento traen phone_norm');
select is(((select j from r) -> 'new_rows' -> 0 ->> 'phone_norm'), '79140001', 'filas nuevas traen phone_norm');

-- Persona = auxiliar -------------------------------------------------------------------------------------------------
update r set j = pg_temp.dr('{"from": "2025-06-10", "person_id": "00000000-0000-4000-8000-000000000004"}');
select is(((select j from r) -> 'totals' ->> 'new')::int, 1, 'auxiliar: 1 registro nuevo');
select is(((select j from r) -> 'totals' ->> 'new_people')::int, 1, 'auxiliar: 1 persona registró');
select is(((select j from r) -> 'totals' ->> 'week_new')::int, 2, 'auxiliar: 2 registros en la semana');
select is(((select j from r) -> 'totals' ->> 'followed')::int, 1, 'auxiliar: 1 cliente con seguimiento');
select is(((select j from r) -> 'totals' ->> 'contacts')::int, 2, 'auxiliar: 2 contactos');
select is(((select j from r) -> 'totals' ->> 'effective')::int, 1, 'auxiliar: 1 efectivo (aunque el último del día no lo fue)');
select is((select string_agg(x ->> 'full_name', ',') from jsonb_array_elements((select j from r) -> 'new_rows') x),
  'Per Nuevo Aux', 'auxiliar: la lista nueva solo trae lo que ella registró');
select is((select p ->> 'contacts' || '|' || (p ->> 'effective') || '|' || (p ->> 'last_result') || '|' || (p ->> 'last_actor')
           from pg_temp.row_of('Per Viejo') p),
  '2|true|no_answer|Auxiliar Verdolago', 'la fila cuenta solo sus contactos y su último resultado');
select is(jsonb_array_length((select j from r) -> 'people'), 2, 'con persona elegida, el selector conserva todas las opciones');

-- Persona = encargado ------------------------------------------------------------------------------------------------
update r set j = pg_temp.dr('{"from": "2025-06-10", "person_id": "00000000-0000-4000-8000-000000000003"}');
select is(((select j from r) -> 'totals' ->> 'followed')::int || '/' || jsonb_array_length((select j from r) -> 'followed_rows'), '2/2',
  'encargado: 2 clientes con seguimiento, número y lista coinciden');
select is((pg_temp.row_of('Per Viejo') ->> 'contacts')::int, 1, 'encargado: en Per Viejo solo cuenta su contacto');

-- Errores y alcance --------------------------------------------------------------------------------------------------
select throws_ok($$ select public.daily_report('{"person_id": "no-es-uuid"}') $$, 'P0001', 'invalid_input',
  'person_id inválido rechazado');

select tests.login_as('00000000-0000-4000-8000-000000000007');
update r set j = pg_temp.dr('{"from": "2025-06-10", "person_id": "00000000-0000-4000-8000-000000000004"}');
select is(((select j from r) -> 'totals' ->> 'new')::int + ((select j from r) -> 'totals' ->> 'followed')::int, 0,
  'el encargado de Trinidad no ve nada de Verdolago filtrando por una persona de allá');
update r set j = pg_temp.dr('{"from": "2025-06-10"}');
select is((select string_agg(x ->> 'name', ',') from jsonb_array_elements((select j from r) -> 'people') x),
  'Volantera Trinidad', 'el selector de Trinidad solo trae a su gente');

select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.daily_report('{"person_id": "00000000-0000-4000-8000-000000000004"}') $$, 'P0001', 'forbidden',
  'la auxiliar no tiene acceso, ni filtrando por sí misma');

select * from finish();
rollback;
