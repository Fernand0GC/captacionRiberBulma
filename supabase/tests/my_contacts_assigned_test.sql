begin;
select plan(15);

-- Spec 022: my_contacts devuelve la fecha en que se le asignó cada cliente a quien consulta (assigned_at) y conserva
-- todos los campos anteriores. Usuarios propios: a1 y a2 auxiliares de Verdolago; asigna el Encargado Verdolago (…03).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email, now(), now()
from (values
  ('00000000-0000-4000-8000-0000000022a1', 'aux.atr1@captacion.riberbulma.local'),
  ('00000000-0000-4000-8000-0000000022a2', 'aux.atr2@captacion.riberbulma.local')) as u(id, email);
insert into public.profiles (id, username, full_name, role, branch_id, contract_type, active, deactivated_at) values
  ('00000000-0000-4000-8000-0000000022a1', 'aux.atr1', 'Aux Atrasos Uno', 'field_assistant', 5, 'permanent', true, null),
  ('00000000-0000-4000-8000-0000000022a2', 'aux.atr2', 'Aux Atrasos Dos', 'field_assistant', 5, 'permanent', true, null);

create function pg_temp.pid(n text) returns uuid language sql as $$ select ('01900000-0000-7000-8000-0000000220' || n)::uuid $$;
grant execute on function pg_temp.pid(text) to authenticated;
create function pg_temp.row_of(n text) returns jsonb language sql as $$
  select c from jsonb_array_elements(public.my_contacts()) c where c ->> 'id' = pg_temp.pid(n)::text
$$;
grant execute on function pg_temp.row_of(text) to authenticated;

-- 01: asignado por el encargado el sábado · 02: primero a a2 (viernes), después reasignado a a1 (domingo)
-- 03: sin evento de asignación (dato viejo) · 04: tomado por la misma a1 (hoy)
-- 06: a2 lo contactó y después se reasignó a a1 (ya no espera «sin contactar»)
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift, stage, assigned_to)
values
  (pg_temp.pid('01'), 'Atr Cliente 1', '79220001', '79220001', 5, '00000000-0000-4000-8000-000000000006', '2026-11-19 09:00-04', 'morning', 'capture', '00000000-0000-4000-8000-0000000022a1'),
  (pg_temp.pid('02'), 'Atr Cliente 2', '79220002', '79220002', 5, '00000000-0000-4000-8000-000000000006', '2026-11-19 09:00-04', 'morning', 'capture', '00000000-0000-4000-8000-0000000022a1'),
  (pg_temp.pid('03'), 'Atr Cliente 3', '79220003', '79220003', 5, '00000000-0000-4000-8000-000000000006', '2026-11-18 16:30-04', 'afternoon', 'capture', '00000000-0000-4000-8000-0000000022a1'),
  (pg_temp.pid('04'), 'Atr Cliente 4', '79220004', '79220004', 5, '00000000-0000-4000-8000-000000000006', '2026-11-19 09:00-04', 'morning', 'capture', '00000000-0000-4000-8000-0000000022a1'),
  (pg_temp.pid('05'), 'Atr Cliente 5', '79220005', '79220005', 5, '00000000-0000-4000-8000-000000000006', '2026-11-19 09:00-04', 'morning', 'capture', '00000000-0000-4000-8000-0000000022a2'),
  (pg_temp.pid('06'), 'Atr Cliente 6', '79220006', '79220006', 5, '00000000-0000-4000-8000-000000000006', '2026-11-19 09:00-04', 'morning', 'recapture', '00000000-0000-4000-8000-0000000022a1');
insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at) values
  (pg_temp.pid('01'), null, '00000000-0000-4000-8000-0000000022a1', '00000000-0000-4000-8000-000000000003', '2026-11-21 10:00-04'),
  (pg_temp.pid('02'), null, '00000000-0000-4000-8000-0000000022a2', '00000000-0000-4000-8000-000000000003', '2026-11-20 10:00-04'),
  (pg_temp.pid('02'), '00000000-0000-4000-8000-0000000022a2', '00000000-0000-4000-8000-0000000022a1', '00000000-0000-4000-8000-000000000003', '2026-11-22 18:45-04'),
  (pg_temp.pid('04'), null, '00000000-0000-4000-8000-0000000022a1', '00000000-0000-4000-8000-0000000022a1', '2026-11-23 08:15-04'),
  (pg_temp.pid('05'), null, '00000000-0000-4000-8000-0000000022a2', '00000000-0000-4000-8000-000000000003', '2026-11-21 10:00-04'),
  (pg_temp.pid('06'), null, '00000000-0000-4000-8000-0000000022a2', '00000000-0000-4000-8000-000000000003', '2026-11-20 10:00-04'),
  (pg_temp.pid('06'), '00000000-0000-4000-8000-0000000022a2', '00000000-0000-4000-8000-0000000022a1', '00000000-0000-4000-8000-000000000003', '2026-11-22 18:45-04');
insert into public.followups (id, prospect_id, contacted_at, result, method, effective, note, visit_at, actor_id) values
  ('01900000-0000-7000-8000-0000000220f6', pg_temp.pid('06'), '2026-11-21 11:00-04', 'no_answer', 'call', false, null, null, '00000000-0000-4000-8000-0000000022a2');

select tests.login_as('00000000-0000-4000-8000-0000000022a1');

select is((pg_temp.row_of('01') ->> 'assigned_at')::timestamptz, timestamptz '2026-11-21 10:00-04',
  'assigned_at: fecha del evento de asignación');
select is((pg_temp.row_of('02') ->> 'assigned_at')::timestamptz, timestamptz '2026-11-22 18:45-04',
  'reasignado: cuenta la asignación a quien consulta, no la primera');
select is((pg_temp.row_of('03') ->> 'assigned_at')::timestamptz, timestamptz '2026-11-18 16:30-04',
  'sin evento: assigned_at = client_created_at');
select is((pg_temp.row_of('04') ->> 'assigned_at')::timestamptz, timestamptz '2026-11-23 08:15-04',
  'tomado por sí misma: también trae la fecha');
select is(pg_temp.row_of('04') ->> 'assigned_by_name', null, 'tomado por sí misma: sin assigned_by_name (como antes)');
select is(pg_temp.row_of('01') ->> 'assigned_by_name', 'Encargado Verdolago', 'conserva assigned_by_name');
select ok((select bool_and(pg_temp.row_of('01') ? k) from unnest(array[
    'id', 'full_name', 'phone_raw', 'phone_norm', 'stage', 'contact_attempts', 'next_contact_at', 'visit_at',
    'client_created_at', 'interest', 'product_id', 'product_name', 'channel_name', 'created_by_name', 'referrer_name',
    'assigned_by_name', 'contacts_count', 'last_result', 'last_method', 'last_note', 'last_contacted_at', 'assigned_at',
    'reassigned_from_name', 'waiting_since']) k),
  'conserva todos los campos anteriores y suma assigned_at, reassigned_from_name y waiting_since');

-- Reasignados (decisión B): de quién venía y desde cuándo espera sin contacto
select is(pg_temp.row_of('02') ->> 'reassigned_from_name', 'Aux Atrasos Dos', 'reasignado: de quién venía');
select is((pg_temp.row_of('02') ->> 'waiting_since')::timestamptz, timestamptz '2026-11-20 10:00-04',
  'reasignado sin contactar: espera desde la primera asignación');
select is(pg_temp.row_of('01') ->> 'reassigned_from_name', null, 'primera asignación: no es reasignado');
select is((pg_temp.row_of('03') ->> 'waiting_since')::timestamptz, timestamptz '2026-11-18 16:30-04',
  'sin eventos: espera desde la captación');
select is(pg_temp.row_of('06') ->> 'waiting_since', null, 'ya contactado: no espera «sin contactar»');
select is(pg_temp.row_of('06') ->> 'reassigned_from_name', 'Aux Atrasos Dos', 'ya contactado y reasignado: igual dice de quién venía');
select is(pg_temp.row_of('05'), null, 'no ve clientes asignados a otra persona');

select tests.login_as('00000000-0000-4000-8000-0000000022a2');
select is(pg_temp.row_of('02'), null, 'quien lo tenía antes ya no lo ve');

select * from finish();
rollback;
