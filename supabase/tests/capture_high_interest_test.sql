begin;
select plan(9);

-- Encargado esperado de Verdolago (el más antiguo activo; la base local puede tener más de uno)
create temp table mgr as select u.id from public.profiles u
  where u.branch_id = 5 and u.active and u.role = 'branch_manager' order by u.created_at, u.id limit 1;

-- Volantera Verdolago: interés alto, interés medio y un teléfono repetido con interés alto
select tests.login_as('00000000-0000-4000-8000-000000000006');
select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000301","full_name":"Alto Volantera","phone":"73000301","interest":"high"}');
select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000302","full_name":"Medio Volantera","phone":"73000302","interest":"medium"}');
-- Auxiliar Verdolago y encargado Trinidad: interés alto
select tests.login_as('00000000-0000-4000-8000-000000000004');
select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000303","full_name":"Alto Auxiliar","phone":"73000303","interest":"high"}');
select tests.login_as('00000000-0000-4000-8000-000000000007');
select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000304","full_name":"Alto Encargado","phone":"73000304","interest":"high"}');
select tests.login_as('00000000-0000-4000-8000-000000000006');
select is(public.submit_capture('{"id":"01900000-0000-7000-8000-000000000305","full_name":"Alto Repetido","phone":"73000303","interest":"high"}') ->> 'result',
  'duplicate', 'teléfono repetido: rechazado');
select tests.logout();

select is((select stage::text from public.prospects where id = '01900000-0000-7000-8000-000000000301'), 'interested',
  'volantera + interés alto: entra como Cliente potencial');
select is((select assigned_to from public.prospects where id = '01900000-0000-7000-8000-000000000301'), (select id from mgr),
  'volantera + interés alto: responsable el encargado de la sucursal');
select is((select count(*)::int from public.stage_events where prospect_id = '01900000-0000-7000-8000-000000000301'
  and from_stage = 'capture' and to_stage = 'interested'), 1, 'deja el paso Captación → Cliente potencial en el historial');
select is((select count(*)::int from public.assignment_events where prospect_id = '01900000-0000-7000-8000-000000000301'
  and to_user = (select id from mgr)), 1, 'deja la asignación en el historial');
select ok((select stage = 'capture' and assigned_to is null from public.prospects where id = '01900000-0000-7000-8000-000000000302'),
  'interés medio: queda como captación sin responsable');
select ok((select stage = 'interested' and assigned_to = '00000000-0000-4000-8000-000000000004'
  from public.prospects where id = '01900000-0000-7000-8000-000000000303'), 'auxiliar + interés alto: responsable ella misma');
select ok((select stage = 'interested' and assigned_to = '00000000-0000-4000-8000-000000000007'
  from public.prospects where id = '01900000-0000-7000-8000-000000000304'), 'encargado + interés alto: responsable él mismo');
select ok((select stage = 'capture' and assigned_to is null from public.prospects where id = '01900000-0000-7000-8000-000000000305'),
  'duplicado: no pasa a Cliente potencial ni toma responsable');

select * from finish();
rollback;
