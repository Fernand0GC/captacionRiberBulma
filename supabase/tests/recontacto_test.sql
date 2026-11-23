begin;
select plan(32);

-- Spec 023: agenda de recontacto (recontact_agenda), primer contacto / recontacto en Actividad y «Contar por» en
-- Seguimientos. Fechas relativas a hoy en La Paz: la agenda siempre es de hoy.
-- Usuarios propios: r1 y r2 auxiliares de Verdolago (5). Encargado Verdolago (…03), Encargado Trinidad (…07),
-- Gerente (…02), Volantera Verdolago (…06).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email, now(), now()
from (values
  ('00000000-0000-4000-8000-0000000023a1', 'aux.rec1@captacion.riberbulma.local'),
  ('00000000-0000-4000-8000-0000000023a2', 'aux.rec2@captacion.riberbulma.local')) as u(id, email);
insert into public.profiles (id, username, full_name, role, branch_id, contract_type, active, deactivated_at) values
  ('00000000-0000-4000-8000-0000000023a1', 'aux.rec1', 'Aux Recontacto Uno', 'field_assistant', 5, 'permanent', true, null),
  ('00000000-0000-4000-8000-0000000023a2', 'aux.rec2', 'Aux Recontacto Dos', 'field_assistant', 5, 'permanent', true, null);

create function pg_temp.pid(n text) returns uuid language sql as $$ select ('01900000-0000-7000-8000-0000000230' || n)::uuid $$;
-- Hoy + d días a la hora h, en La Paz.
create function pg_temp.at(d integer, h text) returns timestamptz language sql as $$
  select (((now() at time zone 'America/La_Paz')::date + d)::timestamp + h::time) at time zone 'America/La_Paz'
$$;
create function pg_temp.agenda_ids(f jsonb default '{}') returns text[] language sql as $$
  select coalesce(array_agg(r ->> 'id'), '{}') from jsonb_array_elements(public.recontact_agenda(f) -> 'rows') r
$$;
create function pg_temp.r1_activity(f jsonb) returns jsonb language sql as $$
  select r from jsonb_array_elements(public.agent_activity(f) -> 'rows') r
  where r ->> 'actor_id' = '00000000-0000-4000-8000-0000000023a1'
$$;
grant execute on function pg_temp.pid(text), pg_temp.at(integer, text), pg_temp.agenda_ids(jsonb),
  pg_temp.r1_activity(jsonb) to authenticated;

-- Clientes. R1 = auxiliar 1; V = volantera que registró.
--  01 recaptación, agendado hoy 9:00, último contacto ayer          → agenda (pendiente)
--  02 recaptación, agendado ayer, sin contacto hoy                  → agenda (atrasado)
--  03 seguimiento, agendado pasado mañana                           → no
--  04 sin contactar, sin fecha, asignado hoy                        → agenda (para hoy)
--  05 recaptación, agendado hoy, contactado hoy                     → agenda (contactó)
--  06 sin interés HOY (3.er no contestó)                            → agenda (contactó)
--  07 sin interés hace días                                         → no
--  08 seguimiento sin fecha, contactado hace 3 días                 → no («por contactar», no cuenta)
--  09 de Trinidad (7), agendado hoy, del Encargado Trinidad         → solo gerencia
--  10 visita mañana (confirmar hoy)                                 → agenda
--  11 sin responsable, agendado hoy                                 → no
--  12 registrado hace 40 días, asignado hoy a R1, contactado por R2 ayer y por R1 hoy dos veces → agenda (contactó)
--  13 primer contacto hoy por R1                                    → agenda (contactó)
--  14 dos contactos de R2 hoy a la misma hora (desempate por id)
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift, stage,
                              assigned_to, next_contact_at, visit_at, contact_attempts, lost_reason_id)
values
  (pg_temp.pid('01'), 'Rec Cliente 01', '79230001', '79230001', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-5, '09:00'), 'morning', 'recapture', '00000000-0000-4000-8000-0000000023a1', pg_temp.at(0, '09:00'), null, 1, null),
  (pg_temp.pid('02'), 'Rec Cliente 02', '79230002', '79230002', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-5, '09:00'), 'morning', 'recapture', '00000000-0000-4000-8000-0000000023a1', pg_temp.at(-1, '09:00'), null, 1, null),
  (pg_temp.pid('03'), 'Rec Cliente 03', '79230003', '79230003', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-5, '09:00'), 'morning', 'followup', '00000000-0000-4000-8000-0000000023a1', pg_temp.at(2, '09:00'), null, 0, null),
  (pg_temp.pid('04'), 'Rec Cliente 04', '79230004', '79230004', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-1, '09:00'), 'morning', 'capture', '00000000-0000-4000-8000-0000000023a1', null, null, 0, null),
  (pg_temp.pid('05'), 'Rec Cliente 05', '79230005', '79230005', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-5, '09:00'), 'morning', 'recapture', '00000000-0000-4000-8000-0000000023a1', pg_temp.at(1, '09:00'), null, 2, null),
  (pg_temp.pid('06'), 'Rec Cliente 06', '79230006', '79230006', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-5, '09:00'), 'morning', 'lost', '00000000-0000-4000-8000-0000000023a1', null, null, 3, (select min(id) from public.lost_reasons)),
  (pg_temp.pid('07'), 'Rec Cliente 07', '79230007', '79230007', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-9, '09:00'), 'morning', 'lost', '00000000-0000-4000-8000-0000000023a1', null, null, 3, (select min(id) from public.lost_reasons)),
  (pg_temp.pid('08'), 'Rec Cliente 08', '79230008', '79230008', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-9, '09:00'), 'morning', 'followup', '00000000-0000-4000-8000-0000000023a1', null, null, 0, null),
  (pg_temp.pid('09'), 'Rec Cliente 09', '79230009', '79230009', 7, '00000000-0000-4000-8000-000000000008', pg_temp.at(-5, '09:00'), 'morning', 'recapture', '00000000-0000-4000-8000-000000000007', pg_temp.at(0, '09:00'), null, 1, null),
  (pg_temp.pid('10'), 'Rec Cliente 10', '79230010', '79230010', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-5, '09:00'), 'morning', 'followup', '00000000-0000-4000-8000-0000000023a1', pg_temp.at(1, '10:00'), pg_temp.at(1, '10:00'), 0, null),
  (pg_temp.pid('11'), 'Rec Cliente 11', '79230011', '79230011', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-5, '09:00'), 'morning', 'recapture', null, pg_temp.at(0, '09:00'), null, 1, null),
  (pg_temp.pid('12'), 'Rec Cliente 12', '79230012', '79230012', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-40, '09:00'), 'morning', 'followup', '00000000-0000-4000-8000-0000000023a1', pg_temp.at(3, '09:00'), null, 0, null),
  (pg_temp.pid('13'), 'Rec Cliente 13', '79230013', '79230013', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-1, '09:00'), 'morning', 'followup', '00000000-0000-4000-8000-0000000023a1', pg_temp.at(2, '09:00'), null, 0, null),
  (pg_temp.pid('14'), 'Rec Cliente 14', '79230014', '79230014', 5, '00000000-0000-4000-8000-000000000006', pg_temp.at(-1, '09:00'), 'morning', 'recapture', '00000000-0000-4000-8000-0000000023a2', pg_temp.at(1, '09:00'), null, 2, null);

insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at) values
  (pg_temp.pid('04'), null, '00000000-0000-4000-8000-0000000023a1', '00000000-0000-4000-8000-000000000003', pg_temp.at(0, '07:00')),
  (pg_temp.pid('12'), null, '00000000-0000-4000-8000-0000000023a2', '00000000-0000-4000-8000-000000000003', pg_temp.at(-30, '07:00')),
  (pg_temp.pid('12'), '00000000-0000-4000-8000-0000000023a2', '00000000-0000-4000-8000-0000000023a1', '00000000-0000-4000-8000-000000000003', pg_temp.at(0, '07:00'));

-- Hoy hasta las 08:40 (así los tests no dependen de la hora en que corren, salvo antes de las 08:40 de La Paz:
-- un contacto «en el futuro» igual cuenta como de hoy).
insert into public.followups (id, prospect_id, contacted_at, result, method, effective, note, visit_at, actor_id) values
  ('01900000-0000-7000-8000-0000000231a1', pg_temp.pid('01'), pg_temp.at(-1, '10:00'), 'no_answer', 'call', false, null, null, '00000000-0000-4000-8000-0000000023a1'),
  ('01900000-0000-7000-8000-0000000231a2', pg_temp.pid('02'), pg_temp.at(-2, '10:00'), 'no_answer', 'call', false, null, null, '00000000-0000-4000-8000-0000000023a1'),
  ('01900000-0000-7000-8000-0000000231a3', pg_temp.pid('05'), pg_temp.at(-2, '10:00'), 'no_answer', 'call', false, null, null, '00000000-0000-4000-8000-0000000023a1'),
  ('01900000-0000-7000-8000-0000000231a4', pg_temp.pid('05'), pg_temp.at(0, '08:10'), 'no_answer', 'call', false, null, null, '00000000-0000-4000-8000-0000000023a1'),
  ('01900000-0000-7000-8000-0000000231a5', pg_temp.pid('06'), pg_temp.at(-2, '10:00'), 'no_answer', 'call', false, null, null, '00000000-0000-4000-8000-0000000023a1'),
  ('01900000-0000-7000-8000-0000000231a6', pg_temp.pid('06'), pg_temp.at(0, '08:20'), 'no_answer', 'call', false, null, null, '00000000-0000-4000-8000-0000000023a1'),
  ('01900000-0000-7000-8000-0000000231a7', pg_temp.pid('07'), pg_temp.at(-5, '10:00'), 'no_answer', 'call', false, null, null, '00000000-0000-4000-8000-0000000023a1'),
  ('01900000-0000-7000-8000-0000000231a8', pg_temp.pid('08'), pg_temp.at(-3, '10:00'), 'looking_product', 'call', true, null, null, '00000000-0000-4000-8000-0000000023a1'),
  ('01900000-0000-7000-8000-0000000231a9', pg_temp.pid('12'), pg_temp.at(-1, '10:00'), 'no_answer', 'call', false, null, null, '00000000-0000-4000-8000-0000000023a2'),
  ('01900000-0000-7000-8000-0000000231b1', pg_temp.pid('12'), pg_temp.at(0, '08:00'), 'no_answer', 'call', false, null, null, '00000000-0000-4000-8000-0000000023a1'),
  ('01900000-0000-7000-8000-0000000231b2', pg_temp.pid('12'), pg_temp.at(0, '08:30'), 'looking_product', 'message', true, 'Pide fotos', null, '00000000-0000-4000-8000-0000000023a1'),
  ('01900000-0000-7000-8000-0000000231b3', pg_temp.pid('13'), pg_temp.at(0, '08:40'), 'looking_product', 'call', true, null, null, '00000000-0000-4000-8000-0000000023a1'),
  ('01900000-0000-7000-8000-0000000231c1', pg_temp.pid('14'), pg_temp.at(0, '09:00'), 'no_answer', 'call', false, null, null, '00000000-0000-4000-8000-0000000023a2'),
  ('01900000-0000-7000-8000-0000000231c2', pg_temp.pid('14'), pg_temp.at(0, '09:00'), 'no_answer', 'whatsapp_call', false, null, null, '00000000-0000-4000-8000-0000000023a2');

-- ===== US1: recontact_agenda =====================================================================================
select tests.login_as('00000000-0000-4000-8000-0000000023a1');
select throws_ok($$ select public.recontact_agenda('{}') $$, 'forbidden', 'la auxiliar no ve la agenda de las jefas');

select tests.login_as('00000000-0000-4000-8000-000000000003');
select ok(pg_temp.agenda_ids() @> array[pg_temp.pid('01'), pg_temp.pid('02'), pg_temp.pid('04'), pg_temp.pid('05'),
  pg_temp.pid('06'), pg_temp.pid('10'), pg_temp.pid('12'), pg_temp.pid('13')]::text[],
  'entran: agendado hoy, atrasado, nunca contactado, contactado hoy, cerrado hoy, visita de mañana');
select ok(not (pg_temp.agenda_ids() && array[pg_temp.pid('03'), pg_temp.pid('07'), pg_temp.pid('08'), pg_temp.pid('11')]::text[]),
  'no entran: agendado para más adelante, cerrado antes, «por contactar» sin fecha, sin responsable');
select ok(not (pg_temp.pid('09')::text = any (pg_temp.agenda_ids())), 'el encargado solo ve su sucursal');
select is(public.recontact_agenda('{}') ->> 'today', ((now() at time zone 'America/La_Paz')::date)::text, 'today = hoy en La Paz');
select is((public.recontact_agenda('{}') ->> 'truncated')::boolean, false, 'sin truncar');
select ok((select bool_and(r ? k) from jsonb_array_elements(public.recontact_agenda('{}') -> 'rows') r,
    unnest(array['id', 'full_name', 'phone_raw', 'stage', 'contact_attempts', 'next_contact_at', 'visit_at',
      'client_created_at', 'assigned_to', 'branch_id', 'assigned_at', 'reassigned_from_name', 'last_contacted_at',
      'last_result', 'last_method', 'last_note']) k),
  'cada fila trae los campos del contrato');
select is((select (r ->> 'assigned_at')::timestamptz from jsonb_array_elements(public.recontact_agenda('{}') -> 'rows') r
           where r ->> 'id' = pg_temp.pid('04')::text), pg_temp.at(0, '07:00'), 'assigned_at: asignación al responsable actual');
select is((select r ->> 'reassigned_from_name' from jsonb_array_elements(public.recontact_agenda('{}') -> 'rows') r
           where r ->> 'id' = pg_temp.pid('12')::text), 'Aux Recontacto Dos', 'reasignado: de quién venía');
select is((select r ->> 'last_note' from jsonb_array_elements(public.recontact_agenda('{}') -> 'rows') r
           where r ->> 'id' = pg_temp.pid('12')::text), 'Pide fotos', 'último contacto de cualquier persona');
select ok((select array_agg(p ->> 'id') from jsonb_array_elements(public.recontact_agenda('{}') -> 'people') p)
          @> array['00000000-0000-4000-8000-0000000023a2', '00000000-0000-4000-8000-000000000004',
                   '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003'],
  'personal fijo de la sucursal aunque esté en cero');
select ok(not exists (select 1 from jsonb_array_elements(public.recontact_agenda('{}') -> 'people') p
                      where p ->> 'id' = '00000000-0000-4000-8000-000000000006'),
  'la volantera no aparece (no hace seguimiento)');

select tests.login_as('00000000-0000-4000-8000-000000000007');
select ok(not (pg_temp.pid('01')::text = any (pg_temp.agenda_ids())), 'Trinidad no ve clientes de Verdolago');

select tests.login_as('00000000-0000-4000-8000-000000000002');
select ok(pg_temp.pid('09')::text = any (pg_temp.agenda_ids()), 'gerencia ve todas las sucursales');
select ok(not (pg_temp.pid('09')::text = any (pg_temp.agenda_ids('{"branch_id": 5}'))), 'gerencia filtra por sucursal');

-- ===== US2: primer contacto / recontacto ==========================================================================
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is((pg_temp.r1_activity(jsonb_build_object('from', pg_temp.at(0, '00:00')::date)) ->> 'total')::int, 5,
  'R1 hizo 5 contactos hoy');
select is((pg_temp.r1_activity(jsonb_build_object('from', pg_temp.at(0, '00:00')::date)) ->> 'first_contacts')::int, 1,
  'primer contacto: solo el cliente 13');
select is((pg_temp.r1_activity(jsonb_build_object('from', pg_temp.at(0, '00:00')::date)) ->> 'recontacts')::int, 4,
  'recontactos: 05, 06 y dos al 12 (el 12 ya lo había llamado otra persona)');
select is((select (r ->> 'first_contacts')::int + (r ->> 'recontacts')::int - (r ->> 'total')::int
           from jsonb_array_elements(public.agent_activity(jsonb_build_object('from', pg_temp.at(0, '00:00')::date)) -> 'rows') r
           where r ->> 'actor_id' = '00000000-0000-4000-8000-0000000023a2'), 0, 'R2: primeros + recontactos = total');
select is((select (r ->> 'first_contacts')::int
           from jsonb_array_elements(public.agent_activity(jsonb_build_object('from', pg_temp.at(0, '00:00')::date)) -> 'rows') r
           where r ->> 'actor_id' = '00000000-0000-4000-8000-0000000023a2'), 1,
  'dos contactos a la misma hora: uno es el primero (desempate por id)');
select is((pg_temp.r1_activity(jsonb_build_object('from', pg_temp.at(-1, '00:00')::date)) ->> 'first_contacts')::int, 1,
  'ayer: la primera llamada al 01 es primer contacto aunque el período sea otro día');
select is((public.list_agent_contacts(jsonb_build_object('from', pg_temp.at(0, '00:00')::date,
            'actor_id', '00000000-0000-4000-8000-0000000023a1', 'metric', 'first')) ->> 'total')::int, 1,
  'detalle «Primer contacto» coincide con la celda');
select is((public.list_agent_contacts(jsonb_build_object('from', pg_temp.at(0, '00:00')::date,
            'actor_id', '00000000-0000-4000-8000-0000000023a1', 'metric', 'recontact')) ->> 'total')::int, 4,
  'detalle «Recontacto» coincide con la celda');

select tests.login_as('00000000-0000-4000-8000-000000000002');
select is((select count(*)::int from jsonb_array_elements(public.agent_activity(jsonb_build_object('from', pg_temp.at(0, '00:00')::date)) -> 'by_branch') b
           where (b ->> 'first_contacts')::int + (b ->> 'recontacts')::int <> (b ->> 'total')::int), 0,
  'por sucursal: primeros + recontactos = total en cada fila');

-- ===== US3: «Contar por» en Seguimientos ===========================================================================
select tests.login_as('00000000-0000-4000-8000-000000000003');
create function pg_temp.fs_total(basis text, d1 integer, d2 integer) returns integer language sql as $$
  select (public.list_followup_status(jsonb_strip_nulls(jsonb_build_object(
    'from', pg_temp.at(d1, '00:00')::date, 'to', pg_temp.at(d2, '00:00')::date, 'q', 'Rec Cliente 12', 'date_basis', basis))) ->> 'total')::int
$$;
grant execute on function pg_temp.fs_total(text, integer, integer) to authenticated;
select is(pg_temp.fs_total(null, 0, 0), 0, 'sin date_basis: cuenta registro (se registró hace 40 días)');
select is(pg_temp.fs_total('registered', -40, -40), 1, 'registered: el día en que se registró');
select is(pg_temp.fs_total('assigned', 0, 0), 1, 'assigned: asignado hoy al responsable actual');
select is(pg_temp.fs_total('assigned', -30, -30), 0, 'assigned: no cuenta la asignación a la persona anterior');
select is(pg_temp.fs_total('last_contact', 0, 0), 1, 'last_contact: último contacto hoy');
select is(pg_temp.fs_total('next_contact', 3, 3), 1, 'next_contact: agendado en 3 días');
select is(pg_temp.fs_total('next_contact', 0, 0), 0, 'next_contact: hoy no');
select throws_ok($$ select public.list_followup_status('{"date_basis": "otra"}') $$, 'invalid_input',
  'date_basis inválido');

select * from finish();
rollback;
