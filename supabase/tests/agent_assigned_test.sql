begin;
select plan(24);

-- Spec 012: clientes asignados del día en Actividad (20261121000200).
-- Personas del seed: 02 gerente, 03 encargado Verdolago (5), 04 auxiliar Verdolago, 05 supervisor Verdolago,
-- 07 encargado Trinidad. Fecha 2025-05-20 para no chocar con otros datos.
-- Clientes de la auxiliar (04):
--   p1 Reparto 20/05 14:00, la llama 16:00 (no contestó) → Captación → Recaptación
--   p2 estaba en Recaptación; Reparto 20/05 14:00; la llama al día siguiente → Recaptación → Seguimiento
--   p3 Reparto 20/05 18:00, sin contactar; el 21/05 pasa al supervisor (reasignado)
--   p4 Cliente potencial; lo toma ella 20/05 10:00 y vende ahí mismo → Cliente potencial → Venta
--   p5 asignado el 19/05 y llamado el 20/05 → «cartera», no es asignado del día
--   p6 asignado dos veces el 20/05 → cuenta una
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
  stage, assigned_to, sold_at, product_id)
values
  ('01900000-0000-7000-8000-0000000012a1', 'Asg Cliente 1', '79130001', '79130001', 5, '00000000-0000-4000-8000-000000000006', '2025-05-19 09:00-04', 'morning', 'recapture', '00000000-0000-4000-8000-000000000004', null, null),
  ('01900000-0000-7000-8000-0000000012a2', 'Asg Cliente 2', '79130002', '79130002', 5, '00000000-0000-4000-8000-000000000006', '2025-05-18 09:00-04', 'morning', 'followup', '00000000-0000-4000-8000-000000000004', null, null),
  ('01900000-0000-7000-8000-0000000012a3', 'Asg Cliente 3', '79130003', '79130003', 5, '00000000-0000-4000-8000-000000000006', '2025-05-19 09:00-04', 'morning', 'capture', '00000000-0000-4000-8000-000000000005', null, null),
  ('01900000-0000-7000-8000-0000000012a4', 'Asg Cliente 4', '79130004', '79130004', 5, '00000000-0000-4000-8000-000000000006', '2025-05-18 09:00-04', 'morning', 'sale', '00000000-0000-4000-8000-000000000004', '2025-05-20 10:00-04', (select min(id) from public.products)),
  ('01900000-0000-7000-8000-0000000012a5', 'Asg Cliente 5', '79130005', '79130005', 5, '00000000-0000-4000-8000-000000000006', '2025-05-18 09:00-04', 'morning', 'followup', '00000000-0000-4000-8000-000000000004', null, null),
  ('01900000-0000-7000-8000-0000000012a6', 'Asg Cliente 6', '79130006', '79130006', 5, '00000000-0000-4000-8000-000000000006', '2025-05-19 09:00-04', 'morning', 'capture', '00000000-0000-4000-8000-000000000004', null, null);

insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at) values
  ('01900000-0000-7000-8000-0000000012a1', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-05-20 14:00-04'),
  ('01900000-0000-7000-8000-0000000012a2', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-05-20 14:00-04'),
  ('01900000-0000-7000-8000-0000000012a3', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-05-20 18:00-04'),
  ('01900000-0000-7000-8000-0000000012a3', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', '2025-05-21 08:00-04'),
  ('01900000-0000-7000-8000-0000000012a4', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', '2025-05-20 10:00-04'),
  ('01900000-0000-7000-8000-0000000012a5', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-05-19 15:00-04'),
  ('01900000-0000-7000-8000-0000000012a6', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-05-20 14:00-04'),
  ('01900000-0000-7000-8000-0000000012a6', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-05-20 15:00-04');

insert into public.stage_events (prospect_id, from_stage, to_stage, actor_id, created_at) values
  ('01900000-0000-7000-8000-0000000012a1', 'capture', 'recapture', '00000000-0000-4000-8000-000000000004', '2025-05-20 16:00-04'),
  ('01900000-0000-7000-8000-0000000012a2', 'capture', 'recapture', '00000000-0000-4000-8000-000000000003', '2025-05-19 10:00-04'),
  ('01900000-0000-7000-8000-0000000012a2', 'recapture', 'followup', '00000000-0000-4000-8000-000000000004', '2025-05-21 09:00-04'),
  ('01900000-0000-7000-8000-0000000012a4', 'capture', 'interested', '00000000-0000-4000-8000-000000000003', '2025-05-19 10:00-04'),
  ('01900000-0000-7000-8000-0000000012a4', 'interested', 'sale', '00000000-0000-4000-8000-000000000004', '2025-05-20 10:00-04');

insert into public.followups (id, prospect_id, contacted_at, result, method, effective, note, visit_at, callback_at, actor_id) values
  ('01900000-0000-7000-8000-0000000012b1', '01900000-0000-7000-8000-0000000012a1', '2025-05-20 16:00-04', 'no_answer', 'whatsapp_call', false, 'se dejó audio', null, null, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-0000000012b2', '01900000-0000-7000-8000-0000000012a2', '2025-05-21 09:00-04', 'visit_store', 'call', true, null, '2025-05-22 10:00-04', null, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-0000000012b3', '01900000-0000-7000-8000-0000000012a4', '2025-05-20 10:00-04', 'sold', 'store', true, null, null, null, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-0000000012b4', '01900000-0000-7000-8000-0000000012a5', '2025-05-20 11:00-04', 'looking_product', 'call', true, null, null, null, '00000000-0000-4000-8000-000000000004'),
  -- Otra persona llama a p6: no cuenta como contacto de la auxiliar.
  ('01900000-0000-7000-8000-0000000012b5', '01900000-0000-7000-8000-0000000012a6', '2025-05-20 17:00-04', 'no_answer', 'call', false, null, null, null, '00000000-0000-4000-8000-000000000005');

create temp table r (k text primary key, v jsonb);
grant all on r to authenticated;
create function pg_temp.asg(p_name text) returns jsonb language sql as $$
  select x from r, jsonb_array_elements(r.v -> 'rows') x where r.k = 'list' and x ->> 'full_name' = p_name
$$;
grant execute on function pg_temp.asg(text) to authenticated;

select tests.login_as('00000000-0000-4000-8000-000000000002');
insert into r values ('act', public.agent_activity('{"from":"2025-05-20","to":"2025-05-20"}'));
insert into r values ('list', public.list_agent_assigned('{"from":"2025-05-20","to":"2025-05-20","actor_id":"00000000-0000-4000-8000-000000000004"}'));
insert into r values ('contacts', public.list_agent_contacts('{"from":"2025-05-20","to":"2025-05-20","actor_id":"00000000-0000-4000-8000-000000000004"}'));

-- Resumen de Actividad --------------------------------------------------------------------------------------------
select is((select x ->> 'assigned' from r, jsonb_array_elements(r.v -> 'rows') x
           where r.k = 'act' and x ->> 'actor_id' = '00000000-0000-4000-8000-000000000004'), '5',
  'asignados del día: 5 (p5 es de ayer; p6 dos veces cuenta una)');
select is((select x ->> 'assigned_contacted' from r, jsonb_array_elements(r.v -> 'rows') x
           where r.k = 'act' and x ->> 'actor_id' = '00000000-0000-4000-8000-000000000004'), '3',
  'contactados: 3 (p2 al día siguiente cuenta; p6 lo llamó otra persona)');
select is((select x ->> 'assigned' from r, jsonb_array_elements(r.v -> 'by_branch') x
           where r.k = 'act' and (x ->> 'branch_id')::int = 5), '5', 'por sucursal: los 5 de Verdolago');

-- Lista de asignados ----------------------------------------------------------------------------------------------
select is((select (v ->> 'total')::int from r where k = 'list'), 5, 'la lista trae los 5');
select is(pg_temp.asg('Asg Cliente 1') ->> 'stage_at' || '→' || (pg_temp.asg('Asg Cliente 1') ->> 'stage_now'),
  'capture→recapture', 'p1: Captación → Recaptación');
select is(pg_temp.asg('Asg Cliente 1') ->> 'assigned_by', (select full_name from public.profiles where id = '00000000-0000-4000-8000-000000000003'),
  'p1: lo asignó el encargado');
select is(pg_temp.asg('Asg Cliente 1') ->> 'last_note', 'se dejó audio', 'p1: último contacto con su observación');
select is(pg_temp.asg('Asg Cliente 2') ->> 'stage_at' || '→' || (pg_temp.asg('Asg Cliente 2') ->> 'stage_now'),
  'recapture→followup', 'p2: venía de Recaptación');
select ok((pg_temp.asg('Asg Cliente 2') ->> 'first_at')::timestamptz = '2025-05-21 09:00-04', 'p2: primer contacto al día siguiente');
select is((pg_temp.asg('Asg Cliente 3') ->> 'contacts')::int, 0, 'p3: sin contactar');
select is(pg_temp.asg('Asg Cliente 3') ->> 'reassigned_to', (select full_name from public.profiles where id = '00000000-0000-4000-8000-000000000005'),
  'p3: reasignado al supervisor');
select ok((pg_temp.asg('Asg Cliente 4') ->> 'self_assigned')::boolean, 'p4: lo tomó ella');
select is(pg_temp.asg('Asg Cliente 4') ->> 'stage_at' || '→' || (pg_temp.asg('Asg Cliente 4') ->> 'stage_now'),
  'interested→sale', 'p4: Cliente potencial → Venta');
select is((pg_temp.asg('Asg Cliente 6') ->> 'contacts')::int, 0, 'p6: el contacto de otra persona no cuenta');

-- Todos los contactos: marca asignado hoy / cartera ----------------------------------------------------------------
select is((select (v ->> 'assigned_total')::int || '/' || (v ->> 'total') from r where k = 'contacts'), '2/3',
  'de 3 contactos del día, 2 son a asignados del día (p1, p4) y 1 de cartera (p5)');
select is((select x ->> 'assigned' from r, jsonb_array_elements(r.v -> 'rows') x
           where r.k = 'contacts' and x ->> 'full_name' = 'Asg Cliente 5'), 'false', 'p5 sale como cartera');

-- Spec 020: celular y sucursal del cliente en cada fila ------------------------------------------------------------
select is(pg_temp.asg('Asg Cliente 1') ->> 'phone_raw', '79130001', '020: la fila trae el celular como se registró');
select is(pg_temp.asg('Asg Cliente 1') ->> 'phone_norm', '79130001', '020: y normalizado (para buscar por dígitos)');
select is((pg_temp.asg('Asg Cliente 1') ->> 'branch_id')::int, 5, '020: y la sucursal del cliente');

-- Spec 020: reasignar desde el modal usa assign_prospects y no cambia los números del período ---------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(public.assign_prospects(array['01900000-0000-7000-8000-0000000012a6']::uuid[], '00000000-0000-4000-8000-000000000005'),
  1, '020: el encargado reasigna p6 (sin contactar) al supervisor');
select tests.login_as('00000000-0000-4000-8000-000000000002');
delete from r where k in ('act', 'list');
insert into r values ('act', public.agent_activity('{"from":"2025-05-20","to":"2025-05-20"}'));
insert into r values ('list', public.list_agent_assigned('{"from":"2025-05-20","to":"2025-05-20","actor_id":"00000000-0000-4000-8000-000000000004"}'));
select is((select x ->> 'assigned' from r, jsonb_array_elements(r.v -> 'rows') x
           where r.k = 'act' and x ->> 'actor_id' = '00000000-0000-4000-8000-000000000004'), '5',
  '020: la auxiliar sigue con 5 asignados en el período (se calcula del historial)');
select is(pg_temp.asg('Asg Cliente 6') ->> 'reassigned_to', (select full_name from public.profiles where id = '00000000-0000-4000-8000-000000000005'),
  '020: p6 sale «Reasignado a» el supervisor');

-- Alcance y validación --------------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000007');
select is((public.list_agent_assigned('{"from":"2025-05-20","to":"2025-05-20","actor_id":"00000000-0000-4000-8000-000000000004"}') ->> 'total')::int,
  0, 'el encargado de Trinidad no ve los asignados de Verdolago');
select throws_ok($$ select public.list_agent_assigned('{"from":"2025-05-20"}') $$, 'P0001', 'invalid_input', 'sin persona → invalid_input');

select * from finish();
rollback;
