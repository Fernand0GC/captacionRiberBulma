begin;
select plan(12);

-- Spec 028: la Agenda de recontacto refleja los asignados del día.
--  · recontact_agenda devuelve también lo recibido hoy con fecha agendada más adelante (no se exige, pero se ve).
--  · recontact_agenda suma `assigned`: por persona, «Asignados hoy» con la regla de Actividad (012 + 024) y cuántos de
--    ellos ya pasaron a otra persona después de contactarlos (`passed_on`).
-- Usuarios propios: A1 (como Rene), A2 (como Nayara), A3 (como Luis), auxiliares de Verdolago (5).
-- Encargado Verdolago (…03), Encargado Trinidad (…07), Gerente (…02), Volantera Verdolago (…06).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email, now(), now()
from (values
  ('00000000-0000-4000-8000-0000000028a1', 'aux.asg1@captacion.riberbulma.local'),
  ('00000000-0000-4000-8000-0000000028a2', 'aux.asg2@captacion.riberbulma.local'),
  ('00000000-0000-4000-8000-0000000028a3', 'aux.asg3@captacion.riberbulma.local')) as u(id, email);
insert into public.profiles (id, username, full_name, role, branch_id, contract_type, active, deactivated_at) values
  ('00000000-0000-4000-8000-0000000028a1', 'aux.asg1', 'Aux Asignados Uno', 'field_assistant', 5, 'permanent', true, null),
  ('00000000-0000-4000-8000-0000000028a2', 'aux.asg2', 'Aux Asignados Dos', 'field_assistant', 5, 'permanent', true, null),
  ('00000000-0000-4000-8000-0000000028a3', 'aux.asg3', 'Aux Asignados Tres', 'field_assistant', 5, 'permanent', true, null);

create function pg_temp.pid(n text) returns uuid language sql as $$ select ('01900000-0000-7000-8000-0000000280' || n)::uuid $$;
create function pg_temp.at(d integer, h text) returns timestamptz language sql as $$
  select (((now() at time zone 'America/La_Paz')::date + d)::timestamp + h::time) at time zone 'America/La_Paz'
$$;
create function pg_temp.agenda_ids(f jsonb default '{}') returns text[] language sql as $$
  select coalesce(array_agg(r ->> 'id'), '{}') from jsonb_array_elements(public.recontact_agenda(f) -> 'rows') r
$$;
-- «Asignados hoy» de una persona en la agenda (null si no figura).
create function pg_temp.asg(who text, k text default 'assigned', f jsonb default '{}') returns int language sql as $$
  select (a ->> k)::int from jsonb_array_elements(public.recontact_agenda(f) -> 'assigned') a where a ->> 'id' = who
$$;
grant execute on function pg_temp.pid(text), pg_temp.at(integer, text), pg_temp.agenda_ids(jsonb),
  pg_temp.asg(text, text, jsonb) to authenticated;

-- Clientes (V = volantera que registró; todos de Verdolago):
--  01 A2 → A1 hoy, visita en 4 días (como Carlos Tonore)         → fila en la agenda · cuenta a A1
--  02 A2 → A1 hoy, fecha vencida hace 3 días (caso 8)             → fila · cuenta a A1
--  03 nuevo, asignado hoy a A1, sin fecha                          → fila · cuenta a A1
--  04 asignado hoy a A1, A1 lo contactó y después pasó a A3        → cuenta a A1 (passed_on) y a A3
--  05 asignado hoy a A1, sin contacto, después pasó a A3           → no cuenta a A1 (024) · cuenta a A3
--  06 asignado a A1 hace 5 días, agendado hoy (rellamada)          → fila · no es asignado de hoy
--  07 asignado a A1 hace 5 días, agendado en 6 días                → no entra (más adelante y no recibido hoy)
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift, stage,
                              assigned_to, next_contact_at, visit_at, contact_attempts, lost_reason_id)
values
  (pg_temp.pid('01'), 'Asg Cliente 01', '79280001', '79280001', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-10, '09:00'), 'morning', 'followup', '00000000-0000-4000-8000-0000000028a1', pg_temp.at(4, '10:00'), pg_temp.at(4, '10:00'), 0, null),
  (pg_temp.pid('02'), 'Asg Cliente 02', '79280002', '79280002', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-10, '09:00'), 'morning', 'followup', '00000000-0000-4000-8000-0000000028a1', pg_temp.at(-3, '09:00'), null, 0, null),
  (pg_temp.pid('03'), 'Asg Cliente 03', '79280003', '79280003', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(0, '06:00'), 'morning', 'capture', '00000000-0000-4000-8000-0000000028a1', null, null, 0, null),
  (pg_temp.pid('04'), 'Asg Cliente 04', '79280004', '79280004', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(0, '06:00'), 'morning', 'interested', '00000000-0000-4000-8000-0000000028a3', null, null, 0, null),
  (pg_temp.pid('05'), 'Asg Cliente 05', '79280005', '79280005', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(0, '06:00'), 'morning', 'interested', '00000000-0000-4000-8000-0000000028a3', null, null, 0, null),
  (pg_temp.pid('06'), 'Asg Cliente 06', '79280006', '79280006', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-10, '09:00'), 'morning', 'recapture', '00000000-0000-4000-8000-0000000028a1', pg_temp.at(0, '09:00'), null, 1, null),
  (pg_temp.pid('07'), 'Asg Cliente 07', '79280007', '79280007', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-10, '09:00'), 'morning', 'followup', '00000000-0000-4000-8000-0000000028a1', pg_temp.at(6, '09:00'), null, 0, null);

insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at) values
  (pg_temp.pid('01'), '00000000-0000-4000-8000-0000000028a2', '00000000-0000-4000-8000-0000000028a1', '00000000-0000-4000-8000-000000000003', pg_temp.at(0, '07:00')),
  (pg_temp.pid('02'), '00000000-0000-4000-8000-0000000028a2', '00000000-0000-4000-8000-0000000028a1', '00000000-0000-4000-8000-000000000003', pg_temp.at(0, '07:00')),
  (pg_temp.pid('03'), null, '00000000-0000-4000-8000-0000000028a1', '00000000-0000-4000-8000-000000000003', pg_temp.at(0, '07:00')),
  (pg_temp.pid('04'), null, '00000000-0000-4000-8000-0000000028a1', '00000000-0000-4000-8000-000000000003', pg_temp.at(0, '07:00')),
  (pg_temp.pid('04'), '00000000-0000-4000-8000-0000000028a1', '00000000-0000-4000-8000-0000000028a3', '00000000-0000-4000-8000-0000000028a1', pg_temp.at(0, '07:30')),
  (pg_temp.pid('05'), null, '00000000-0000-4000-8000-0000000028a1', '00000000-0000-4000-8000-000000000003', pg_temp.at(0, '07:00')),
  (pg_temp.pid('05'), '00000000-0000-4000-8000-0000000028a1', '00000000-0000-4000-8000-0000000028a3', '00000000-0000-4000-8000-0000000028a1', pg_temp.at(0, '07:30')),
  (pg_temp.pid('06'), null, '00000000-0000-4000-8000-0000000028a1', '00000000-0000-4000-8000-000000000003', pg_temp.at(-5, '07:00')),
  (pg_temp.pid('07'), null, '00000000-0000-4000-8000-0000000028a1', '00000000-0000-4000-8000-000000000003', pg_temp.at(-5, '07:00'));

-- A1 contactó al 04 antes de pasarlo (07:10, antes de las 07:30).
insert into public.followups (id, prospect_id, contacted_at, result, method, effective, note, visit_at, actor_id) values
  ('01900000-0000-7000-8000-0000000281a1', pg_temp.pid('04'), pg_temp.at(0, '07:10'), 'looking_product', 'call', true, null, null, '00000000-0000-4000-8000-0000000028a1');

-- ===== Permisos ==================================================================================================
select tests.login_as('00000000-0000-4000-8000-0000000028a1');
select throws_ok($$ select public.recontact_agenda('{}') $$, 'forbidden', 'la auxiliar no ve la agenda ni sus asignados');

select tests.login_as('00000000-0000-4000-8000-000000000007');
select is(pg_temp.asg('00000000-0000-4000-8000-0000000028a1'), null, 'el encargado de Trinidad no ve los asignados de Verdolago');

-- ===== Filas: recibido hoy con fecha más adelante ================================================================
select tests.login_as('00000000-0000-4000-8000-000000000003');
select ok(pg_temp.pid('01')::text = any (pg_temp.agenda_ids()), 'recibido hoy con visita en 4 días: entra a la agenda');
select ok(not (pg_temp.pid('07')::text = any (pg_temp.agenda_ids())), 'agendado más adelante y recibido antes: no entra (como antes)');
select ok(pg_temp.agenda_ids() @> array[pg_temp.pid('02'), pg_temp.pid('03'), pg_temp.pid('06')]::text[],
  'lo de hoy sigue entrando: fecha vencida recibida hoy, nuevo y rellamada');

-- ===== Asignados hoy (regla de Actividad) =========================================================================
select is(pg_temp.asg('00000000-0000-4000-8000-0000000028a1'), 4,
  'A1: 01, 02, 03 y 04 (el 05 pasó a otra persona sin contactar: no cuenta, 024)');
select is(pg_temp.asg('00000000-0000-4000-8000-0000000028a1', 'passed_on'), 1, 'A1: el 04 lo contactó y ya pasó a otra persona');
select is(pg_temp.asg('00000000-0000-4000-8000-0000000028a3'), 2, 'A3: 04 y 05 le llegaron hoy');
select is(pg_temp.asg('00000000-0000-4000-8000-0000000028a3', 'passed_on'), 0, 'A3: no pasó ninguno');
select is(pg_temp.asg('00000000-0000-4000-8000-0000000028a2'), 0, 'A2: entregó, no recibió → 0 (personal fijo en cero)');

-- ===== Paridad con Actividad → Hoy (la garantía de la spec) ========================================================
select is(
  (select count(*) from jsonb_array_elements(public.agent_activity('{}') -> 'rows') r
   full join jsonb_array_elements(public.recontact_agenda('{}') -> 'assigned') a on a ->> 'id' = r ->> 'actor_id'
   where coalesce((r ->> 'assigned')::int, 0) <> coalesce((a ->> 'assigned')::int, 0)),
  0::bigint, 'encargado: «Asignados hoy» de la agenda = «Asignados» de Actividad para cada persona');

select tests.login_as('00000000-0000-4000-8000-000000000002');
select is(
  (select count(*) from jsonb_array_elements(public.agent_activity('{}') -> 'rows') r
   full join jsonb_array_elements(public.recontact_agenda('{}') -> 'assigned') a on a ->> 'id' = r ->> 'actor_id'
   where coalesce((r ->> 'assigned')::int, 0) <> coalesce((a ->> 'assigned')::int, 0)),
  0::bigint, 'gerencia (todas las sucursales): misma paridad');

select * from finish();
rollback;
