begin;
select plan(15);

-- 5 captaciones de hoy en Verdolago (volantera) + 1 de ayer + 1 en Trinidad
select tests.login_as('00000000-0000-4000-8000-000000000006');
select public.submit_capture(jsonb_build_object('id', format('01900000-0000-7000-8000-0000000001%s', lpad(i::text, 2, '0')),
  'full_name', 'Reparto ' || i, 'phone', '7300000' || i)) from generate_series(1, 6) i;
select tests.login_as('00000000-0000-4000-8000-000000000008');
select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000199","full_name":"Reparto Trinidad","phone":"73000099"}');
select tests.logout();
update public.prospects set client_created_at = now() - interval '1 day' where id = '01900000-0000-7000-8000-000000000106';
create temp table d as select (now() at time zone 'America/La_Paz')::date as today,
  (select count(*)::int from public.distribution_pool(5::smallint, (now() at time zone 'America/La_Paz')::date,
     (now() at time zone 'America/La_Paz')::date, false) where full_name not like 'Reparto %') as others;
grant select on d to authenticated;

-- Vista previa del encargado
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is((public.distribution_preview(5::smallint, (select today from d), (select today from d)) ->> 'total')::int - (select others from d),
  5, 'hoy: 5 sin asignar (sin contar datos ajenos)');
select ok((public.distribution_preview(5::smallint, (select today from d), (select today from d), true) ->> 'total')::int
  > (public.distribution_preview(5::smallint, (select today from d), (select today from d)) ->> 'total')::int, 'incluir días anteriores suma la de ayer');
select ok((select bool_and((x ->> 'role') <> 'field_volunteer') from jsonb_array_elements(public.distribution_preview(5::smallint, (select today from d), (select today from d)) -> 'people') x),
  'personas: sin volanteros');
select ok((select bool_or(x ->> 'name' = 'Volantera Verdolago') from jsonb_array_elements(public.distribution_preview(5::smallint, (select today from d), (select today from d)) -> 'by_author') x),
  'muestra de qué volantero vienen');
select throws_ok($$ select public.distribution_preview(7::smallint, current_date, current_date) $$, 'P0001', 'forbidden', 'encargado no ve otra sucursal');

-- Reparto por cupos: auxiliar 3, supervisor 1 (sobra 1 sin repartir si no hay datos ajenos)
create temp table res as select public.distribute_prospects(5::smallint, (select today from d), (select today from d), false,
  jsonb_build_object('00000000-0000-4000-8000-000000000004', 3, '00000000-0000-4000-8000-000000000005', 1)) as r;
select is((select (r ->> 'assigned')::int from res), 4, 'asigna exactamente la suma de cupos');
select is((select (r -> 'by_person' ->> '00000000-0000-4000-8000-000000000004')::int from res), 3, 'auxiliar recibe 3');
select is((select (r -> 'by_person' ->> '00000000-0000-4000-8000-000000000005')::int from res), 1, 'supervisor recibe 1');
select tests.logout();
select is((select count(*)::int from public.prospects where full_name = 'Reparto 6' and assigned_to is null), 1, 'la de ayer no se toca si no se incluye');
select is((select count(*)::int from public.assignment_events where created_at = now()), 4, 'deja historial de asignación (de esta transacción)');

-- Calendario (FR-039d): pendientes por día coinciden con lo repartible
select tests.login_as('00000000-0000-4000-8000-000000000003');
create temp table cal as select public.distribution_dates_summary(5::smallint,
  extract(year from (select today from d))::int, extract(month from (select today from d))::int) as s;
select is((select (s -> to_char((select today from d), 'YYYY-MM-DD') ->> 'pending')::int from cal),
  (public.distribution_preview(5::smallint, (select today from d), (select today from d)) ->> 'total')::int,
  'calendario: pendientes de hoy = vista previa de hoy');
select ok((select (s -> to_char((select today from d), 'YYYY-MM-DD') ->> 'total')::int
  >= (s -> to_char((select today from d), 'YYYY-MM-DD') ->> 'pending')::int + 4 from cal),
  'calendario: el total de hoy incluye las ya repartidas');
select throws_ok($$ select public.distribution_dates_summary(7::smallint, 2026, 1) $$, 'P0001', 'forbidden',
  'calendario: encargado no ve otra sucursal');
select tests.logout();

-- Validaciones
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.distribute_prospects(5::smallint, current_date, current_date, false, '{"00000000-0000-4000-8000-000000000006": 2}') $$,
  'P0001', 'invalid_input', 'no se reparte a volanteros');
select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.distribute_prospects(5::smallint, current_date, current_date, false, '{"00000000-0000-4000-8000-000000000004": 2}') $$,
  'P0001', 'forbidden', 'la auxiliar no reparte');

select * from finish();
rollback;
