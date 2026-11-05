begin;
select plan(4);

-- Captación sin responsable de la volantera de Verdolago
select tests.login_as('00000000-0000-4000-8000-000000000006');
select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000401","full_name":"Toma Seguimiento","phone":"73200001"}');

-- El jefe de ventas registra un seguimiento: queda como responsable
select tests.login_as('00000000-0000-4000-8000-000000000009');
select public.add_followup('{"id":"01900000-0000-7000-8000-000000000491","prospect_id":"01900000-0000-7000-8000-000000000401","result":"looking_product"}');
select ok((select count(*) > 0 from jsonb_array_elements(public.my_contacts()) x where x ->> 'full_name' = 'Toma Seguimiento'),
  'el jefe de ventas lo ve en Mis contactos');
select tests.logout();
select is((select assigned_to from public.prospects where full_name = 'Toma Seguimiento'), '00000000-0000-4000-8000-000000000009'::uuid,
  'seguimiento sin responsable: quien lo registra queda como responsable');
select is((select count(*)::int from public.assignment_events where prospect_id = '01900000-0000-7000-8000-000000000401'), 1,
  'y queda en el historial de asignación');

-- Con responsable, otro seguimiento (del encargado) no cambia el responsable
select tests.login_as('00000000-0000-4000-8000-000000000003');
select public.add_followup('{"id":"01900000-0000-7000-8000-000000000492","prospect_id":"01900000-0000-7000-8000-000000000401","result":"no_answer"}');
select tests.logout();
select is((select assigned_to from public.prospects where full_name = 'Toma Seguimiento'), '00000000-0000-4000-8000-000000000009'::uuid,
  'si ya tiene responsable, no se lo quita');

select * from finish();
rollback;
