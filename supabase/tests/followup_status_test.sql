begin;
select plan(34);

-- Datos (fechas de 2025 para no chocar con datos de demo). Verdolago (5): una por etapa + una anulada; Trinidad (7): una.
-- Volantera Verdolago registra; auxiliar Verdolago es responsable (salvo s1, sin asignar).
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
  stage, interest, contact_attempts, next_contact_at, assigned_to, lost_reason_id, sold_at, product_id, status,
  void_reason, voided_by, voided_at)
values
  ('01900000-0000-7000-8000-0000000005a1', 'Seg Sin Contactar', '79110001', '79110001', 5, '00000000-0000-4000-8000-000000000006',
   '2025-03-10 09:00:00-04', 'morning', 'capture', null, 0, null, null, null, null, null, 'active', null, null, null),
  ('01900000-0000-7000-8000-0000000005a2', 'Seg Recaptacion', '79110002', '79110002', 5, '00000000-0000-4000-8000-000000000006',
   '2025-03-10 10:00:00-04', 'morning', 'recapture', 'low', 2, now() - interval '2 days',
   '00000000-0000-4000-8000-000000000004', null, null, null, 'active', null, null, null),
  ('01900000-0000-7000-8000-0000000005a3', 'Seg Seguimiento', '79110003', '79110003', 5, '00000000-0000-4000-8000-000000000006',
   '2025-03-10 11:00:00-04', 'morning', 'followup', 'high', 0, now() + interval '1 day',
   '00000000-0000-4000-8000-000000000004', null, null, null, 'active', null, null, null),
  ('01900000-0000-7000-8000-0000000005a4', 'Seg Potencial', '79110004', '79110004', 5, '00000000-0000-4000-8000-000000000006',
   '2025-03-11 09:00:00-04', 'morning', 'interested', 'high', 0, now() - interval '1 hour',
   '00000000-0000-4000-8000-000000000004', null, null, null, 'active', null, null, null),
  ('01900000-0000-7000-8000-0000000005a5', 'Seg Venta', '79110005', '79110005', 5, '00000000-0000-4000-8000-000000000006',
   '2025-03-11 10:00:00-04', 'morning', 'sale', 'medium', 0, now() - interval '5 days',
   '00000000-0000-4000-8000-000000000004', null, '2025-03-24 10:00:00-04', (select min(id) from public.products), 'active', null, null, null),
  ('01900000-0000-7000-8000-0000000005a6', 'Seg Sin Interes', '79110006', '79110006', 5, '00000000-0000-4000-8000-000000000006',
   '2025-03-11 11:00:00-04', 'morning', 'lost', null, 0, null,
   '00000000-0000-4000-8000-000000000004', 2, null, null, 'active', null, null, null),
  ('01900000-0000-7000-8000-0000000005a7', 'Seg Anulada', '79110007', '79110007', 5, '00000000-0000-4000-8000-000000000006',
   '2025-03-11 12:00:00-04', 'morning', 'capture', null, 0, null, null, null, null, null, 'voided',
   'prueba', '00000000-0000-4000-8000-000000000001', now()),
  ('01900000-0000-7000-8000-0000000005a8', 'Seg Trinidad', '79110008', '79110008', 7, '00000000-0000-4000-8000-000000000008',
   '2025-03-10 09:00:00-04', 'morning', 'capture', null, 0, null, null, null, null, null, 'active', null, null, null);

insert into public.followups (id, prospect_id, contacted_at, result, method, effective, note, actor_id, callback_at) values
  ('01900000-0000-7000-8000-0000000005b1', '01900000-0000-7000-8000-0000000005a2', '2025-03-21 10:00:00-04', 'no_answer', 'whatsapp_call', false, 'primer intento', '00000000-0000-4000-8000-000000000004', null),
  ('01900000-0000-7000-8000-0000000005b2', '01900000-0000-7000-8000-0000000005a2', '2025-03-22 10:00:00-04', 'no_answer', 'whatsapp_call', false, null, '00000000-0000-4000-8000-000000000004', null),
  ('01900000-0000-7000-8000-0000000005b3', '01900000-0000-7000-8000-0000000005a3', '2025-03-21 10:00:00-04', 'looking_product', 'message', true, 'primera', '00000000-0000-4000-8000-000000000004', null),
  ('01900000-0000-7000-8000-0000000005b4', '01900000-0000-7000-8000-0000000005a3', now() - interval '1 day', 'call_later', 'whatsapp_call', true, 'llamar el lunes', '00000000-0000-4000-8000-000000000005', now() + interval '1 day'),
  ('01900000-0000-7000-8000-0000000005b5', '01900000-0000-7000-8000-0000000005a4', '2025-03-23 10:00:00-04', 'very_interested', 'store', true, null, '00000000-0000-4000-8000-000000000004', null),
  ('01900000-0000-7000-8000-0000000005b6', '01900000-0000-7000-8000-0000000005a5', '2025-03-24 10:00:00-04', 'sold', 'whatsapp_call', true, 'compró TV', '00000000-0000-4000-8000-000000000004', null),
  ('01900000-0000-7000-8000-0000000005b7', '01900000-0000-7000-8000-0000000005a6', '2025-03-25 10:00:00-04', 'not_interested', 'message', true, null, '00000000-0000-4000-8000-000000000004', null);

create temp table r (k text primary key, v jsonb);
grant all on r to authenticated;

-- Encargado Verdolago
select tests.login_as('00000000-0000-4000-8000-000000000003');
insert into r values ('all', public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11"}'));

select is((select v ->> 'total' from r where k = 'all')::int, 6, 'encargado: 6 de su sucursal (sin anulada ni Trinidad)');
select is((select v -> 'by_tab' from r where k = 'all'),
  '{"sin_contactar":1,"seguimiento":2,"potencial":1,"venta":1,"sin_interes":1,"todos":6}'::jsonb, 'conteo por pestaña; la suma da todos');
select is((select v -> 'rows' -> 0 ->> 'full_name' from r where k = 'all'), 'Seg Recaptacion', 'orden: el vencido más atrasado primero');
select is((select v -> 'rows' -> 1 ->> 'full_name' from r where k = 'all'), 'Seg Potencial', 'orden: luego el otro vencido');
select is((select v -> 'rows' -> 2 ->> 'full_name' from r where k = 'all'), 'Seg Sin Contactar', 'orden: luego el de más días sin contacto');
select is((select v -> 'rows' -> 5 ->> 'full_name' from r where k = 'all'), 'Seg Seguimiento', 'orden: el contactado ayer al final');

-- Valores por fila
select is((select x ->> 'last_note' from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Seg Seguimiento'),
  'llamar el lunes', 'última observación = la del contacto más reciente');
select is((select x ->> 'last_result' from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Seg Seguimiento'),
  'call_later', 'último resultado');
select is((select x ->> 'last_actor_name' from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Seg Seguimiento'),
  'Supervisor Verdolago', 'quién hizo el último contacto');
select is((select (x ->> 'contacts_total')::int from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Seg Seguimiento'),
  2, 'contactos totales');
select is((select x ->> 'last_note' from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Seg Recaptacion'),
  null, 'último contacto sin observación: null (no la del anterior)');
select is((select (x ->> 'no_answer_streak')::int from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Seg Recaptacion'),
  2, 'no contestó seguidos');
select is((select (x ->> 'contacts_total')::int from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Seg Sin Contactar'),
  0, 'sin contactos: 0');
select is((select x ->> 'last_contacted_at' from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Seg Sin Contactar'),
  null, 'sin contactos: sin último contacto');
select is((select (x ->> 'days_without_contact')::int from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Seg Sin Contactar'),
  (now() at time zone 'America/La_Paz')::date - date '2025-03-10', 'sin contactos: días desde el registro');
select is((select (x ->> 'overdue')::boolean from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Seg Venta'),
  false, 'venta cerrada nunca está vencida');
select is((select x ->> 'lost_reason' from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Seg Sin Interes'),
  'No le interesa', 'motivo de sin interés');
select is((select x ->> 'assigned_to_name' from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Seg Sin Contactar'),
  null, 'sin responsable');

-- Pestaña y filtros
select is((public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11","tab":"seguimiento"}') ->> 'total')::int, 2, 'pestaña seguimiento = followup + recapture');
select is((public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11","tab":"seguimiento"}') -> 'by_tab' ->> 'todos')::int, 6, 'by_tab no depende de la pestaña');
select is((public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11","interest":"high"}') ->> 'total')::int, 2, 'interés alto');
select is((public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11","interest":"none"}') ->> 'total')::int, 2, 'interés sin dato');
select is((public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11","attempts":"0"}') ->> 'total')::int, 5, 'intentos 0');
select is((public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11","attempts":"1-2"}') ->> 'total')::int, 1, 'intentos 1-2');
select is((public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11","overdue":true}') ->> 'total')::int, 2, 'solo vencidos');
select is((public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11","stale_days":3}') ->> 'total')::int, 5, 'sin contacto hace más de 3 días');
select is((public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11","lost_reason_id":2}') ->> 'total')::int, 1, 'motivo de pérdida');
select is((public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11","assigned":"none"}') ->> 'total')::int, 1, 'sin asignar');
select is((public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11","q":"potencial"}') ->> 'total')::int, 1, 'búsqueda por nombre');
select throws_ok($$ select public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11","branch_id":7}') $$,
  'P0001', 'forbidden', 'encargado: otra sucursal prohibida');
select throws_ok($$ select public.list_followup_status('{"from":"2024-01-01","to":"2025-03-11"}') $$,
  'P0001', 'invalid_input', 'rango de más de 366 días');

-- Jefe de ventas (Verdolago y Trinidad): elige una de las suyas
select tests.login_as('00000000-0000-4000-8000-000000000009');
select is((public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11","branch_id":7}') ->> 'total')::int, 1, 'jefe de ventas: Trinidad');

-- Gerente: todas (sin la anulada)
select tests.login_as('00000000-0000-4000-8000-000000000002');
select is((public.list_followup_status('{"from":"2025-03-10","to":"2025-03-11"}') ->> 'total')::int, 7, 'gerente: todas las sucursales');

-- Auxiliar: no es una pantalla suya
select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.list_followup_status('{}') $$, 'P0001', 'forbidden', 'auxiliar: prohibido');

select * from finish();
rollback;
