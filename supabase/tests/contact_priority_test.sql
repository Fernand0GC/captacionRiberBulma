begin;
select plan(20);

-- Spec 026 · «Poner para hoy»: la jefa marca clientes como prioridad de hoy para su responsable, sin reasignarlos.
-- Tabla contact_priorities (cliente + persona + día) solo por RPC; my_contacts, recontact_agenda y list_agent_assigned
-- devuelven priority_today. Usuarios: a1 y a2 auxiliares de Verdolago (5). Encargado Verdolago (…03), Auxiliar (…04),
-- Supervisor (…05), Encargado Trinidad (…07).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email, now(), now()
from (values
  ('00000000-0000-4000-8000-0000000026a1', 'aux.prio1@captacion.riberbulma.local'),
  ('00000000-0000-4000-8000-0000000026a2', 'aux.prio2@captacion.riberbulma.local')) as u(id, email);
insert into public.profiles (id, username, full_name, role, branch_id, contract_type, active, deactivated_at) values
  ('00000000-0000-4000-8000-0000000026a1', 'aux.prio1', 'Aux Prioridad Uno', 'field_assistant', 5, 'permanent', true, null),
  ('00000000-0000-4000-8000-0000000026a2', 'aux.prio2', 'Aux Prioridad Dos', 'field_assistant', 5, 'permanent', true, null);

create function pg_temp.pid(n text) returns uuid language sql as $$ select ('01900000-0000-7000-8000-0000000260' || n)::uuid $$;
create function pg_temp.at(d integer, h text) returns timestamptz language sql as $$
  select (((now() at time zone 'America/La_Paz')::date + d)::timestamp + h::time) at time zone 'America/La_Paz'
$$;
-- Fila de la agenda de un cliente (null si no está).
create function pg_temp.agenda(n text) returns jsonb language sql as $$
  select r from jsonb_array_elements(public.recontact_agenda('{"branch_id":5}') -> 'rows') r where (r ->> 'id')::uuid = pg_temp.pid(n)
$$;
grant execute on function pg_temp.pid(text), pg_temp.at(integer, text), pg_temp.agenda(text) to authenticated;

--  01 a1 · nunca contactado, asignado hace 3 días      (atrasado)
--  02 a1 · recaptación agendada ayer                   (atrasado)
--  03 a2 · no es de a1                                 (se salta: P3)
--  04 a1 · agendado dentro de 5 días                   (fuera de la agenda hasta marcarlo)
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift, stage,
                              assigned_to, next_contact_at, contact_attempts)
values
  (pg_temp.pid('01'), 'Prio 01', '79260001', '79260001', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-5, '09:00'), 'morning', 'capture', '00000000-0000-4000-8000-0000000026a1', null, 0),
  (pg_temp.pid('02'), 'Prio 02', '79260002', '79260002', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-5, '09:00'), 'morning', 'recapture', '00000000-0000-4000-8000-0000000026a1', pg_temp.at(-1, '09:00'), 1),
  (pg_temp.pid('03'), 'Prio 03', '79260003', '79260003', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-5, '09:00'), 'morning', 'capture', '00000000-0000-4000-8000-0000000026a2', null, 0),
  (pg_temp.pid('04'), 'Prio 04', '79260004', '79260004', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-5, '09:00'), 'morning', 'recapture', '00000000-0000-4000-8000-0000000026a1', pg_temp.at(5, '09:00'), 1);
insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at)
select pg_temp.pid(n), null, case n when '03' then '00000000-0000-4000-8000-0000000026a2' else '00000000-0000-4000-8000-0000000026a1' end::uuid,
       '00000000-0000-4000-8000-000000000003', pg_temp.at(-3, '10:00')
from unnest(array['01', '02', '03', '04']) n;

-- P1 / P2 · permisos ----------------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.set_contact_priority('00000000-0000-4000-8000-0000000026a1', array[pg_temp.pid('01')], true) $$,
  'P0001', 'forbidden', 'P1 · la auxiliar no marca prioridades');
select tests.login_as('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.set_contact_priority('00000000-0000-4000-8000-0000000026a1', array[pg_temp.pid('01')], true) $$,
  'P0001', 'forbidden', 'P1 · el supervisor no marca prioridades');
select tests.login_as('00000000-0000-4000-8000-000000000007');
select throws_ok($$ select public.set_contact_priority('00000000-0000-4000-8000-0000000026a1', array[pg_temp.pid('01')], true) $$,
  'P0001', 'forbidden', 'P2 · la encargada de otra sucursal no marca prioridades');

select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.set_contact_priority('00000000-0000-4000-8000-0000000026a1', array[]::uuid[], true) $$,
  'P0001', 'invalid_input', 'sin clientes → invalid_input');
select throws_ok($$ select * from public.contact_priorities $$, '42501', null, 'la tabla no se lee directo (solo por RPC)');

-- Antes de marcar ------------------------------------------------------------------------------------------------
select is(pg_temp.agenda('04'), null, 'antes: lo agendado en 5 días no está en la agenda de hoy');
select is(pg_temp.agenda('01') ->> 'priority_today', 'false', 'antes: sin prioridad');

-- B1 / P3 / E2 · marcar ------------------------------------------------------------------------------------------
select is(public.set_contact_priority('00000000-0000-4000-8000-0000000026a1',
            array[pg_temp.pid('01'), pg_temp.pid('02'), pg_temp.pid('03'), pg_temp.pid('04')], true),
  '{"changed": 3, "skipped": 1}'::jsonb, 'B1/P3 · marca los 3 de a1 y salta el de a2');
select is(public.set_contact_priority('00000000-0000-4000-8000-0000000026a1',
            array[pg_temp.pid('01'), pg_temp.pid('02'), pg_temp.pid('04')], true),
  '{"changed": 3, "skipped": 0}'::jsonb, 'E2 · marcar otra vez no falla');
select tests.logout();
select is((select count(*)::int from public.contact_priorities where prospect_id in (pg_temp.pid('01'), pg_temp.pid('02'), pg_temp.pid('03'), pg_temp.pid('04'))),
  3, 'E2 · una sola prioridad por cliente, persona y día');

-- B2 · la agenda lo ve -------------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(pg_temp.agenda('01') ->> 'priority_today', 'true', 'B2 · la agenda devuelve priority_today');
select isnt(pg_temp.agenda('04'), null, 'B2 · lo agendado más adelante entra en la agenda de hoy');
select is((select (r ->> 'priority_today')::boolean from jsonb_array_elements(
             public.list_agent_assigned(jsonb_build_object('actor_id', '00000000-0000-4000-8000-0000000026a1', 'branch_id', 5,
               'from', ((now() at time zone 'America/La_Paz')::date - 5)::text,
               'to', (now() at time zone 'America/La_Paz')::date::text)) -> 'rows') r
           where (r ->> 'prospect_id')::uuid = pg_temp.pid('01')),
  true, 'B1 · el modal devuelve priority_today');

-- B3 · «Mis contactos» de a1 -------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-0000000026a1');
select is((select count(*)::int from jsonb_array_elements(public.my_contacts()) r
           where (r ->> 'id')::uuid in (pg_temp.pid('01'), pg_temp.pid('02'), pg_temp.pid('04')) and (r ->> 'priority_today')::boolean),
  3, 'B3 · my_contacts devuelve priority_today');

-- B8 · quitar ----------------------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(public.set_contact_priority('00000000-0000-4000-8000-0000000026a1', array[pg_temp.pid('02')], false),
  '{"changed": 1, "skipped": 0}'::jsonb, 'B8 · quitar la prioridad');
select is(pg_temp.agenda('02') ->> 'priority_today', 'false', 'B8 · ya no es prioridad');

-- B5 · la de otro día no cuenta ----------------------------------------------------------------------------------
select tests.logout();
insert into public.contact_priorities (prospect_id, agent_id, day, set_by)
values (pg_temp.pid('02'), '00000000-0000-4000-8000-0000000026a1', (now() at time zone 'America/La_Paz')::date - 1, '00000000-0000-4000-8000-000000000003');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(pg_temp.agenda('02') ->> 'priority_today', 'false', 'B5 · la prioridad de ayer no cuenta hoy');

-- B6 · si se reasigna, no lo sigue ---------------------------------------------------------------------------------
select is(public.assign_prospects(array[pg_temp.pid('01')], '00000000-0000-4000-8000-0000000026a2'), 1, 'se reasigna 01 a a2');
select is(pg_temp.agenda('01') ->> 'priority_today', 'false', 'B6 · para a2 no es prioridad');
select is(public.set_contact_priority('00000000-0000-4000-8000-0000000026a1', array[pg_temp.pid('01')], true),
  '{"changed": 0, "skipped": 1}'::jsonb, 'P3 · ya no es de a1: se salta');

select * from finish();
rollback;
