begin;
select plan(38);

-- Datos: 3 captaciones de la volantera Verdolago, 1 de Trinidad
select tests.login_as('00000000-0000-4000-8000-000000000006');
select public.submit_capture('{"id":"01900000-0000-7000-8000-0000000000f1","full_name":"Cliente Uno","phone":"77000001"}');
select public.submit_capture('{"id":"01900000-0000-7000-8000-0000000000f2","full_name":"Cliente Dos","phone":"77000002"}');
select public.submit_capture('{"id":"01900000-0000-7000-8000-0000000000f3","full_name":"Cliente Tres","phone":"77000003"}');
select tests.login_as('00000000-0000-4000-8000-000000000008');
select public.submit_capture('{"id":"01900000-0000-7000-8000-0000000000f4","full_name":"Cliente Trinidad","phone":"77000004"}');

-- Asignación (encargado Verdolago → auxiliar Verdolago)
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(public.assign_prospects(array['01900000-0000-7000-8000-0000000000f1','01900000-0000-7000-8000-0000000000f2','01900000-0000-7000-8000-0000000000f3']::uuid[],
  '00000000-0000-4000-8000-000000000004'), 3, 'encargado asigna 3 a la auxiliar');
select throws_ok($$ select public.assign_prospects(array['01900000-0000-7000-8000-0000000000f4']::uuid[], '00000000-0000-4000-8000-000000000004') $$,
  'P0001', 'forbidden', 'encargado no asigna de otra sucursal');
select throws_ok($$ select public.assign_prospects(array['01900000-0000-7000-8000-0000000000f1']::uuid[], '00000000-0000-4000-8000-000000000006') $$,
  'P0001', 'invalid_input', 'no se asigna a un volantero (temporal, solo capta)');
select ok((select bool_and((x ->> 'role') <> 'field_volunteer') from jsonb_array_elements(public.assignee_options(5::smallint)) x), 'assignee_options sin volanteros');
select tests.logout();
select is((select count(*) from public.assignment_events where to_user = '00000000-0000-4000-8000-000000000004'
  and prospect_id in ('01900000-0000-7000-8000-0000000000f1','01900000-0000-7000-8000-0000000000f2','01900000-0000-7000-8000-0000000000f3'))::int, 3, 'deja historial de asignación');

-- Gerente no puede asignar a alguien de otra sucursal
select tests.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.assign_prospects(array['01900000-0000-7000-8000-0000000000f4']::uuid[], '00000000-0000-4000-8000-000000000004') $$,
  'P0001', 'invalid_input', 'responsable debe ser de la sucursal del prospecto');

-- Bandeja de la auxiliar: solo lo suyo
select tests.login_as('00000000-0000-4000-8000-000000000004');
select ok((select bool_or(x ->> 'id' = '01900000-0000-7000-8000-0000000000f1') from jsonb_array_elements(public.list_my_followups('today') -> 'rows') x), 'bandeja: aparece lo asignado');
select ok((select bool_and(x ->> 'id' <> '01900000-0000-7000-8000-0000000000f4') from jsonb_array_elements(public.list_my_followups('today') -> 'rows') x), 'bandeja: no aparece lo no asignado');
select is((select count(*) from public.prospects)::int, 0, 'la auxiliar no lee la tabla directo');

-- 2 Recaptación: No contestó ×3 → Sin interés
select is(public.add_followup('{"id":"01900000-0000-7000-8000-0000000000a1","prospect_id":"01900000-0000-7000-8000-0000000000f1","result":"no_answer"}') ->> 'stage', 'recapture', 'no contestó → Recaptación');
select ok((select bool_and(x ->> 'id' <> '01900000-0000-7000-8000-0000000000f1') from jsonb_array_elements(public.list_my_followups('today') -> 'rows') x), 'tras no contestar, vuelve mañana (sale de hoy)');
select is((select (x ->> 'contacts_count')::int from jsonb_array_elements(public.my_contacts()) x where x ->> 'id' = '01900000-0000-7000-8000-0000000000f1'), 1, 'my_contacts: cuenta los contactos (recaptado)');
select is((select (x ->> 'contacts_count')::int from jsonb_array_elements(public.my_contacts()) x where x ->> 'id' = '01900000-0000-7000-8000-0000000000f2'), 0, 'my_contacts: sin contactos (no recaptado)');
select is(public.add_followup('{"id":"01900000-0000-7000-8000-0000000000a1","prospect_id":"01900000-0000-7000-8000-0000000000f1","result":"no_answer"}') ->> 'contact_attempts', '1', 'idempotente por id');
select public.add_followup('{"id":"01900000-0000-7000-8000-0000000000a2","prospect_id":"01900000-0000-7000-8000-0000000000f1","result":"no_answer","method":"message"}');
select is(public.add_followup('{"id":"01900000-0000-7000-8000-0000000000a5","prospect_id":"01900000-0000-7000-8000-0000000000f3","result":"no_answer","method":"whatsapp_call"}') ->> 'stage', 'recapture', 'acepta llamada por WhatsApp');
select is(public.add_followup('{"id":"01900000-0000-7000-8000-0000000000a3","prospect_id":"01900000-0000-7000-8000-0000000000f1","result":"no_answer"}') ->> 'stage', 'lost', 'al tercer intento: Sin interés');
select throws_ok($$ select public.add_followup('{"id":"01900000-0000-7000-8000-0000000000a4","prospect_id":"01900000-0000-7000-8000-0000000000f1","result":"looking_product"}') $$,
  'P0001', 'invalid_transition', 'cerrado no se reabre');

-- 3 Seguimiento: visitará la tienda (exige fecha) y volver a contactar (exige fecha)
select throws_ok($$ select public.add_followup('{"id":"01900000-0000-7000-8000-0000000000b1","prospect_id":"01900000-0000-7000-8000-0000000000f2","result":"visit_store"}') $$,
  'P0001', 'invalid_input', 'visita sin fecha: rechazada');
select is(public.add_followup(jsonb_build_object('id','01900000-0000-7000-8000-0000000000b2','prospect_id','01900000-0000-7000-8000-0000000000f2',
  'result','visit_store','visit_at',(now() + interval '1 day')::text,'note','Pasa con su esposa','method','store')) ->> 'stage', 'followup', 'visitará la tienda → Seguimiento');
select ok((select bool_or(x ->> 'id' = '01900000-0000-7000-8000-0000000000f2') from jsonb_array_elements(public.list_my_followups('visits') -> 'rows') x), 'aparece en visitas pactadas');
select is((select x ->> 'last_note' from jsonb_array_elements(public.list_my_followups('visits') -> 'rows') x where x ->> 'id' = '01900000-0000-7000-8000-0000000000f2'), 'Pasa con su esposa', 'guarda la observación');
select throws_ok($$ select public.add_followup('{"id":"01900000-0000-7000-8000-0000000000b3","prospect_id":"01900000-0000-7000-8000-0000000000f3","result":"call_later"}') $$,
  'P0001', 'invalid_input', 'volver a contactar sin fecha: rechazado');
select is(public.add_followup(jsonb_build_object('id','01900000-0000-7000-8000-0000000000b4','prospect_id','01900000-0000-7000-8000-0000000000f3',
  'result','call_later','callback_at',(now() + interval '5 days')::text,'note','Viajó al monte')) ->> 'stage', 'followup', 'viajó → Seguimiento con fecha');

-- 4 Cliente y no retroceso
select is(public.add_followup('{"id":"01900000-0000-7000-8000-0000000000b5","prospect_id":"01900000-0000-7000-8000-0000000000f2","result":"very_interested"}') ->> 'stage', 'interested', 'muy interesado → Cliente');
select is(public.add_followup('{"id":"01900000-0000-7000-8000-0000000000b6","prospect_id":"01900000-0000-7000-8000-0000000000f2","result":"looking_product"}') ->> 'stage', 'interested', 'un Cliente no retrocede a Seguimiento');

-- 5 Venta: exige producto
select throws_ok($$ select public.add_followup('{"id":"01900000-0000-7000-8000-0000000000b7","prospect_id":"01900000-0000-7000-8000-0000000000f2","result":"sold"}') $$,
  'P0001', 'invalid_input', 'compró sin producto: rechazado');
select is(public.add_followup(jsonb_build_object('id','01900000-0000-7000-8000-0000000000b8','prospect_id','01900000-0000-7000-8000-0000000000f2',
  'result','sold','product_id',(select id from public.products where name = 'Celulares'))) ->> 'stage', 'sale', 'compró → Venta');

-- 6 Sin interés
select is(public.add_followup('{"id":"01900000-0000-7000-8000-0000000000c1","prospect_id":"01900000-0000-7000-8000-0000000000f3","result":"not_interested"}') ->> 'stage', 'lost', 'no le interesa → Sin interés');

-- Otro usuario no puede registrar sobre algo que no tiene asignado
select tests.login_as('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.add_followup('{"id":"01900000-0000-7000-8000-0000000000d1","prospect_id":"01900000-0000-7000-8000-0000000000f1","result":"looking_product"}') $$,
  'P0001', 'forbidden', 'supervisor sin asignación: prohibido');
select tests.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.list_my_followups() $$, 'P0001', 'forbidden', 'volantero no tiene bandeja');

-- Eventos e historial
select tests.logout();
select is((select l.name from public.prospects p join public.lost_reasons l on l.id = p.lost_reason_id where p.id = '01900000-0000-7000-8000-0000000000f1'),
  'No contesta (3 intentos)', 'motivo de cierre por intentos');
select is((select count(*) from public.followups where prospect_id = '01900000-0000-7000-8000-0000000000f1')::int, 3, '3 llamadas registradas (sin duplicar)');
select is((select array_agg(to_stage::text order by id) from public.stage_events where prospect_id = '01900000-0000-7000-8000-0000000000f1'),
  array['capture','recapture','lost'], 'eventos: captación → recaptación → sin interés');
select is((select array_agg(to_stage::text order by id) from public.stage_events where prospect_id = '01900000-0000-7000-8000-0000000000f2'),
  array['capture','followup','interested','sale'], 'eventos: captación → seguimiento → cliente → venta');
select ok((select sold_at is not null and product_id is not null from public.prospects where id = '01900000-0000-7000-8000-0000000000f2'), 'venta con fecha y producto');
select is((select method::text from public.followups where id = '01900000-0000-7000-8000-0000000000a2'), 'message', 'guarda cómo se contactó');
select throws_ok($$ update public.followups set note = 'x' $$, '42501', null, 'llamadas inmutables');

-- Panel de gestión: filtro sin asignar
select tests.login_as('00000000-0000-4000-8000-000000000007');
select ok((select bool_or(x ->> 'id' = '01900000-0000-7000-8000-0000000000f4') from jsonb_array_elements(public.list_prospects(jsonb_build_object('assigned','none','from',(now() at time zone 'America/La_Paz')::date::text), 200) -> 'rows') x), 'encargado Trinidad: el suyo aparece sin asignar');

select * from finish();
rollback;
