begin;
select plan(12);

-- Spec 025 · Fase de caracterización: qué hace HOY assign_prospects con los atrasados de la agenda de recontacto
-- (recontact_agenda). Fija permisos por rol y cómo queda la fila después de reasignar, antes de sumar la UI.
-- Usuarios propios: a1 y a2 auxiliares de Verdolago (5). Encargado Verdolago (…03), Auxiliar (…04),
-- Supervisor (…05), Encargado Trinidad (…07).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email, now(), now()
from (values
  ('00000000-0000-4000-8000-0000000025a1', 'aux.reas1@captacion.riberbulma.local'),
  ('00000000-0000-4000-8000-0000000025a2', 'aux.reas2@captacion.riberbulma.local')) as u(id, email);
insert into public.profiles (id, username, full_name, role, branch_id, contract_type, active, deactivated_at) values
  ('00000000-0000-4000-8000-0000000025a1', 'aux.reas1', 'Aux Reasignar Uno', 'field_assistant', 5, 'permanent', true, null),
  ('00000000-0000-4000-8000-0000000025a2', 'aux.reas2', 'Aux Reasignar Dos', 'field_assistant', 5, 'permanent', true, null);

create function pg_temp.pid(n text) returns uuid language sql as $$ select ('01900000-0000-7000-8000-0000000250' || n)::uuid $$;
-- Hoy + d días a la hora h, en La Paz.
create function pg_temp.at(d integer, h text) returns timestamptz language sql as $$
  select (((now() at time zone 'America/La_Paz')::date + d)::timestamp + h::time) at time zone 'America/La_Paz'
$$;
-- Filas de la agenda de estos dos clientes.
create function pg_temp.rows() returns setof jsonb language sql as $$
  select r from jsonb_array_elements(public.recontact_agenda('{"branch_id":5}') -> 'rows') r
  where (r ->> 'id')::uuid in (pg_temp.pid('01'), pg_temp.pid('02'))
$$;
grant execute on function pg_temp.pid(text), pg_temp.at(integer, text), pg_temp.rows() to authenticated;

-- Dos atrasados de a1:
--  01 nunca contactado, asignado hace 3 días            → atrasado «asignado hace 3 días»
--  02 recaptación agendada ayer, sin contacto           → atrasado «tocaba ayer»
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift, stage,
                              assigned_to, next_contact_at, visit_at, contact_attempts, lost_reason_id)
values
  (pg_temp.pid('01'), 'Reas Cliente 01', '79250001', '79250001', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-5, '09:00'), 'morning', 'capture', '00000000-0000-4000-8000-0000000025a1', null, null, 0, null),
  (pg_temp.pid('02'), 'Reas Cliente 02', '79250002', '79250002', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-5, '09:00'), 'morning', 'recapture', '00000000-0000-4000-8000-0000000025a1', pg_temp.at(-1, '09:00'), null, 1, null);
insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at) values
  (pg_temp.pid('01'), null, '00000000-0000-4000-8000-0000000025a1', '00000000-0000-4000-8000-000000000003', pg_temp.at(-3, '10:00')),
  (pg_temp.pid('02'), null, '00000000-0000-4000-8000-0000000025a1', '00000000-0000-4000-8000-000000000003', pg_temp.at(-5, '10:00'));

-- Permisos: quien no es gestor no reasigna -------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.assign_prospects(array[pg_temp.pid('01')], '00000000-0000-4000-8000-0000000025a2') $$,
  'P0001', 'forbidden', 'auxiliar no reasigna');
select tests.login_as('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.assign_prospects(array[pg_temp.pid('01')], '00000000-0000-4000-8000-0000000025a2') $$,
  'P0001', 'forbidden', 'supervisor no reasigna');
select tests.login_as('00000000-0000-4000-8000-000000000007');
select throws_ok($$ select public.assign_prospects(array[pg_temp.pid('01')], '00000000-0000-4000-8000-0000000025a2') $$,
  'P0001', 'forbidden', 'encargado de otra sucursal no reasigna');

-- Antes: los dos son de a1 ----------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is((select count(*)::int from pg_temp.rows() r where r ->> 'assigned_to' = '00000000-0000-4000-8000-0000000025a1'),
  2, 'antes: los dos atrasados están en la agenda de a1');
select throws_ok($$ select public.assign_prospects(array[pg_temp.pid('01')], '00000000-0000-4000-8000-000000000007') $$,
  'P0001', 'invalid_input', 'no se reasigna a alguien de otra sucursal');

-- Reasignar los dos a a2 ------------------------------------------------------------------------------------------
select is(public.assign_prospects(array[pg_temp.pid('01'), pg_temp.pid('02')], '00000000-0000-4000-8000-0000000025a2'),
  2, 'el encargado reasigna los dos atrasados');
select is((select count(*)::int from pg_temp.rows() r where r ->> 'assigned_to' = '00000000-0000-4000-8000-0000000025a2'),
  2, 'después: los dos están en la agenda de a2');
select is((select count(*)::int from pg_temp.rows() r
           where ((r ->> 'assigned_at')::timestamptz at time zone 'America/La_Paz')::date = (now() at time zone 'America/La_Paz')::date),
  2, 'assigned_at pasa a hoy (por eso para a2 son trabajo de hoy)');
select is((select count(*)::int from pg_temp.rows() r where r ->> 'reassigned_from_name' = 'Aux Reasignar Uno'),
  2, 'la agenda muestra «Reasignado de» la persona anterior');
select is((select (r ->> 'next_contact_at')::timestamptz from pg_temp.rows() r where (r ->> 'id')::uuid = pg_temp.pid('02')),
  pg_temp.at(-1, '09:00'), 'la fecha vencida se conserva (queda como dato: «Recibido hoy · venció el …»)');
select tests.logout();
select is((select count(*)::int from public.assignment_events
           where prospect_id in (pg_temp.pid('01'), pg_temp.pid('02'))
             and from_user = '00000000-0000-4000-8000-0000000025a1' and to_user = '00000000-0000-4000-8000-0000000025a2'),
  2, 'deja historial de a1 → a2');

-- Repetir la misma asignación no cambia nada (un doble clic no duplica historial)
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(public.assign_prospects(array[pg_temp.pid('01'), pg_temp.pid('02')], '00000000-0000-4000-8000-0000000025a2'),
  0, 'reasignar otra vez a la misma persona no cambia nada');

select * from finish();
rollback;
