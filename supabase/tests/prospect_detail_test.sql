begin;
select plan(18);

-- Datos: captación de la volantera Verdolago, asignada a la auxiliar, con un contacto; un duplicado desde Trinidad
select tests.login_as('00000000-0000-4000-8000-000000000006');
select public.submit_capture(jsonb_build_object('id','01900000-0000-7000-8000-000000000601','full_name','Ficha Uno','phone','76000601',
  'channel_id',(select id from public.channels where name = 'Volantes')));
select tests.login_as('00000000-0000-4000-8000-000000000008');
select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000602","full_name":"Repetido Trinidad","phone":"76000601"}');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select public.assign_prospects(array['01900000-0000-7000-8000-000000000601']::uuid[], '00000000-0000-4000-8000-000000000004');
select tests.login_as('00000000-0000-4000-8000-000000000004');
select public.add_followup('{"id":"01900000-0000-7000-8000-000000000611","prospect_id":"01900000-0000-7000-8000-000000000601","result":"looking_product","note":"Quiere un TV"}');

-- La auxiliar asignada ve la ficha pero no edita
select is(public.get_prospect('01900000-0000-7000-8000-000000000601') -> 'prospect' ->> 'full_name', 'Ficha Uno', 'responsable ve la ficha');
select is((public.get_prospect('01900000-0000-7000-8000-000000000601') ->> 'can_edit')::boolean, false, 'responsable no edita');
select ok((select bool_or(x ->> 'type' = 'contact' and x -> 'data' ->> 'note' = 'Quiere un TV')
           from jsonb_array_elements(public.get_prospect('01900000-0000-7000-8000-000000000601') -> 'timeline') x), 'historial: el contacto con su nota');
select ok((select bool_or(x ->> 'type' = 'assignment') from jsonb_array_elements(public.get_prospect('01900000-0000-7000-8000-000000000601') -> 'timeline') x), 'historial: la asignación');
select ok((select bool_or(x ->> 'type' = 'stage' and x -> 'data' ->> 'to' = 'followup') from jsonb_array_elements(public.get_prospect('01900000-0000-7000-8000-000000000601') -> 'timeline') x), 'historial: cambio de etapa');
select ok((select bool_or(x ->> 'type' = 'duplicate' and x ->> 'actor' = 'Volantera Trinidad') from jsonb_array_elements(public.get_prospect('01900000-0000-7000-8000-000000000601') -> 'timeline') x), 'historial: intento duplicado desde otra sucursal');
select throws_ok($$ select public.update_prospect('01900000-0000-7000-8000-000000000601', '{"full_name":"Otro"}') $$, 'P0001', 'forbidden', 'responsable no puede editar');

-- Otro supervisor sin asignación no ve la ficha; encargado de otra sucursal tampoco
select tests.login_as('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.get_prospect('01900000-0000-7000-8000-000000000601') $$, 'P0001', 'forbidden', 'sin asignación: no ve la ficha');
select tests.login_as('00000000-0000-4000-8000-000000000007');
select throws_ok($$ select public.get_prospect('01900000-0000-7000-8000-000000000601') $$, 'P0001', 'forbidden', 'encargado de otra sucursal: no ve');

-- Encargado Verdolago edita: queda auditado
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is((public.get_prospect('01900000-0000-7000-8000-000000000601') ->> 'can_edit')::boolean, true, 'encargado puede editar');
select lives_ok($$ select public.update_prospect('01900000-0000-7000-8000-000000000601', '{"full_name":"Ficha Uno Corregida","address":"Barrio Central"}') $$, 'encargado edita');
select ok((select bool_or(x ->> 'type' = 'edit' and x -> 'data' -> 'new' ->> 'full_name' = 'Ficha Uno Corregida' and x ->> 'actor' = 'Encargado Verdolago')
           from jsonb_array_elements(public.get_prospect('01900000-0000-7000-8000-000000000601') -> 'timeline') x), 'historial: la edición con quién la hizo');
select throws_ok($$ select public.update_prospect('01900000-0000-7000-8000-000000000601', '{"phone":"7600060"}') $$, 'P0001', 'invalid_phone', 'teléfono inválido');
select tests.login_as('00000000-0000-4000-8000-000000000006');
select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000603","full_name":"Otra Persona","phone":"76000603"}');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.update_prospect('01900000-0000-7000-8000-000000000601', '{"phone":"76000603"}') $$, 'P0001', 'invalid_input', 'teléfono de otro cliente: rechazado');
select throws_ok($$ select public.void_prospect('01900000-0000-7000-8000-000000000601', 'Prueba de anulación') $$, 'P0001', 'forbidden', 'encargado no anula');

-- Sistemas anula: desaparece para el responsable, se conserva para el gestor
select tests.login_as('00000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.void_prospect('01900000-0000-7000-8000-000000000601', 'Cliente cargado por error') $$, 'Sistemas anula con motivo');
select is(public.get_prospect('01900000-0000-7000-8000-000000000601') -> 'prospect' ->> 'void_reason', 'Cliente cargado por error', 'se conserva con el motivo');
select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.get_prospect('01900000-0000-7000-8000-000000000601') $$, 'P0001', 'not_found', 'anulada: ya no la ve el responsable');

select * from finish();
rollback;
