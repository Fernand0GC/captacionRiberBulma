begin;
select plan(10);

-- Datos: una captación de la volantera Verdolago (conteo previo para no depender de datos existentes)
select tests.login_as('00000000-0000-4000-8000-000000000006');
create temp table stats_before as select (public.my_capture_stats() ->> 'today')::int as n;
select public.submit_capture(jsonb_build_object(
  'id', '01900000-0000-7000-8000-0000000000a1', 'full_name', 'Lucía Rojas', 'phone', '72222222',
  'product_id', 1, 'channel_id', 1, 'interest', 'high'));

-- Roles de campo: 0 filas en SELECT, sin escritura directa (SC-005)
select is((select count(*) from public.prospects)::int, 0, 'volantero: 0 filas, ni las propias');
select tests.login_as('00000000-0000-4000-8000-000000000004');
select is((select count(*) from public.prospects)::int, 0, 'auxiliar sin asignaciones: 0 filas');
select tests.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok($$ insert into public.prospects (id) values (gen_random_uuid()) $$, '42501', null, 'sin INSERT directo');
select throws_ok($$ update public.prospects set full_name = 'X' $$, '42501', null, 'sin UPDATE directo');
select throws_ok($$ delete from public.prospects $$, '42501', null, 'sin DELETE directo');
select is((select count(*) from public.stage_events)::int, 0, 'volantero no lee eventos');

-- RPC propias
select is((public.my_capture_stats() ->> 'today')::int, (select n + 1 from stats_before), 'my_capture_stats suma la nueva captación propia de hoy');
select ok(not public.phone_available('+591 72222222'), 'phone_available: ocupado (con otro formato)');
select ok(public.phone_available('72222223'), 'phone_available: libre');

-- Límite de llamadas de phone_available (60 por minuto)
select throws_ok($$ select public.phone_available('72222224') from generate_series(1, 61) $$, 'P0001', 'rate_limited', 'phone_available limitado a 60/min');

select * from finish();
rollback;
