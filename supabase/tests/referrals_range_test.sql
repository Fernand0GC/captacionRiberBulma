begin;
select plan(40);

-- Spec 014: referidos por rango y sucursales, unir referidores, filtro «Referido por».
-- Usuarios del seed: 1 admin, 2 gerente, 3 enc.verdolago (5), 6 vol.verdolago (5), 8 vol.trinidad (7).
-- Jefes de prueba: b5 con Verdolago (5) y Trinidad (7); b7 solo con Trinidad (7).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000b5', 'authenticated', 'authenticated',
   'jefe.rng5@captacion.riberbulma.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000b7', 'authenticated', 'authenticated',
   'jefe.rng7@captacion.riberbulma.local', now(), now());
insert into public.profiles (id, username, full_name, role, branch_id, contract_type) values
  ('00000000-0000-4000-8000-0000000000b5', 'jefe.rng5', 'Jefe Dos Sucursales', 'sales_lead', null, 'permanent'),
  ('00000000-0000-4000-8000-0000000000b7', 'jefe.rng7', 'Jefe Trinidad', 'sales_lead', null, 'permanent');
insert into public.profile_branches values
  ('00000000-0000-4000-8000-0000000000b5', 5), ('00000000-0000-4000-8000-0000000000b5', 7),
  ('00000000-0000-4000-8000-0000000000b7', 7);

create temp table ref (name text primary key, id smallint);
grant all on ref to authenticated;
create function pg_temp.r(p_name text) returns text language sql as $$ select id::text from ref where name = p_name $$;
grant execute on function pg_temp.r(text) to authenticated;

create function pg_temp.cap(p_id text, p_phone text, p_at text, p_ref jsonb) returns text
language sql as $$
  select public.submit_capture(jsonb_build_object('id', '01900000-0000-7000-8000-0000000140' || p_id, 'full_name', 'Rango ' || p_id,
    'phone', p_phone, 'client_created_at', p_at) || coalesce(p_ref, '{}'::jsonb)) ->> 'result'
$$;
grant execute on function pg_temp.cap(text, text, text, jsonb) to authenticated;
create function pg_temp.pid(p_id text) returns uuid language sql as $$ select ('01900000-0000-7000-8000-0000000140' || p_id)::uuid $$;
grant execute on function pg_temp.pid(text) to authenticated;
create function pg_temp.rep(p jsonb) returns jsonb language sql as $$ select public.referral_report_range(p) $$;
grant execute on function pg_temp.rep(jsonb) to authenticated;
create function pg_temp.row_of(p_report jsonb, p_name text) returns jsonb language sql as $$
  select r from jsonb_array_elements(p_report -> 'referrers') r where r ->> 'name' = p_name
$$;
grant execute on function pg_temp.row_of(jsonb, text) to authenticated;

-- Datos: referidores con metas y referidos en julio 2026 ------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000001');
insert into ref select 'A', public.referrer_save('{"branch_id":5,"name":"Rango Ana","kind":"staff"}');
insert into ref select 'B', public.referrer_save('{"branch_id":5,"name":"Rango Beto","kind":"freelance"}');
insert into ref select 'T', public.referrer_save('{"branch_id":7,"name":"Rango Tere","kind":"client"}');
select public.referral_goals_save(format('{"branch_id":5,"month":"2026-07-01","referrers":[{"id":%s,"goal":31},{"id":%s,"goal":10}]}',
  pg_temp.r('A'), pg_temp.r('B'))::jsonb);
select public.referral_goals_save(format('{"branch_id":5,"month":"2026-08-01","referrers":[{"id":%s,"goal":62}]}', pg_temp.r('A'))::jsonb);

select tests.login_as('00000000-0000-4000-8000-000000000006');
select pg_temp.cap('01', '76514001', '2026-07-02T10:00:00-04:00', jsonb_build_object('referrer_id', pg_temp.r('A')));
select pg_temp.cap('02', '76514002', '2026-07-10T10:00:00-04:00', jsonb_build_object('referrer_id', pg_temp.r('A')));
select pg_temp.cap('03', '76514003', '2026-07-20T10:00:00-04:00', jsonb_build_object('referrer_id', pg_temp.r('B')));
select pg_temp.cap('04', '76514004', '2026-07-20T11:00:00-04:00', null);  -- captación sin referido
select pg_temp.cap('05', '76514005', '2026-08-03T10:00:00-04:00', jsonb_build_object('referrer_id', pg_temp.r('A')));
select tests.login_as('00000000-0000-4000-8000-000000000008');
select pg_temp.cap('06', '76514006', '2026-07-05T10:00:00-04:00', jsonb_build_object('referrer_id', pg_temp.r('T')));

-- Venta de 02 (en agosto, después del rango de julio): cuenta como «compró» en la cohorte de julio.
select tests.logout();
update public.prospects set stage = 'sale', sold_at = '2026-08-05T12:00:00-04:00', product_id = (select min(id) from public.products) where id = pg_temp.pid('02');
insert into public.stage_events (prospect_id, from_stage, to_stage, actor_id, created_at)
values (pg_temp.pid('02'), 'capture', 'sale', '00000000-0000-4000-8000-000000000001', '2026-08-05T12:00:00-04:00');

-- Rango con una sucursal ----------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-0000000000b5');
select is((pg_temp.row_of(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}'), 'Rango Ana') ->> 'arrived')::int, 2,
  'julio: Ana 2 llegados');
select is((pg_temp.row_of(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}'), 'Rango Ana') ->> 'sold')::int, 1,
  'julio: la venta de agosto cuenta en la cohorte de julio');
select is((pg_temp.row_of(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}'), 'Rango Ana') ->> 'goal')::numeric, 31.0,
  'mes completo: meta entera');
select is((pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}') ->> 'goal_prorated')::boolean, false, 'mes completo: sin prorrateo');
select is((pg_temp.row_of(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-10"}'), 'Rango Ana') ->> 'arrived')::int, 2,
  '1–10 julio: los dos de Ana');
select is((pg_temp.row_of(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-10"}'), 'Rango Ana') ->> 'goal')::numeric, 10.0,
  '1–10 julio: meta 31 prorrateada a 10');
select is((pg_temp.row_of(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-10"}'), 'Rango Beto') ->> 'goal')::numeric, 3.2,
  '1–10 julio: meta 10 prorrateada a 3,2');
select is((pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-10"}') ->> 'goal_prorated')::boolean, true, 'rango parcial: marca prorrateo');
select is((pg_temp.row_of(pg_temp.rep('{"branch_id":5,"from":"2026-07-16","to":"2026-08-15"}'), 'Rango Ana') ->> 'goal')::numeric, 46.0,
  'dos meses parciales: 31×16/31 + 62×15/31 = 46');
select is((pg_temp.row_of(pg_temp.rep('{"branch_id":5,"from":"2026-07-16","to":"2026-08-15"}'), 'Rango Ana') ->> 'arrived')::int, 1,
  '16 jul–15 ago: solo el del 3 de agosto');
select is(pg_temp.row_of(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}'), 'Rango Ana') -> 'by_day' -> '2026-07-02' ->> 'arrived', '1',
  'por día con fecha completa');
select is(pg_temp.row_of(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-08-31"}'), 'Rango Ana') -> 'by_day' -> '2026-08-05' ->> 'sold', '1',
  'la venta aparece el día que se vendió si cae en el rango');
select is((pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}') -> 'totals' ->> 'captures')::int, 4,
  'totales: 4 captaciones en Verdolago (3 referidas + 1 sin referido)');

-- Contactos y quién registra
select is(jsonb_array_length(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}') -> 'contacts'), 3, 'contactos: 3 referidos');
select is((select c ->> 'referrer_name' from jsonb_array_elements(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}') -> 'contacts') c
  where c ->> 'id' = pg_temp.pid('03')::text), 'Rango Beto', 'contacto con el nombre del referidor');
select ok((select (c ->> 'days_waiting')::int > 100 from jsonb_array_elements(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}') -> 'contacts') c
  where c ->> 'id' = pg_temp.pid('01')::text), 'sin contactar: días esperando');
select is((select c ->> 'days_waiting' from jsonb_array_elements(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}') -> 'contacts') c
  where c ->> 'id' = pg_temp.pid('02')::text), null, 'compró: sin días esperando');
select is((select (r ->> 'captures')::int * 10 + (r ->> 'referred')::int
  from jsonb_array_elements(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}') -> 'registrars') r
  where r ->> 'id' = '00000000-0000-4000-8000-000000000006'), 43, 'quién registra: vol.verdolago 4 captaciones, 3 referidas');

-- Varias sucursales ---------------------------------------------------------------------------------------
select is(jsonb_array_length(pg_temp.rep('{"from":"2026-07-01","to":"2026-07-31"}') -> 'by_branch'), 2, 'jefe con dos sucursales: «todas mis sucursales» = 2');
select is((pg_temp.rep('{"from":"2026-07-01","to":"2026-07-31"}') -> 'totals' ->> 'arrived')::int, 4, 'todas mis sucursales: 4 llegados');
select is(jsonb_array_length(pg_temp.rep('{"from":"2026-07-01","to":"2026-07-31"}') -> 'referrers'), 0, 'sin sucursal: sin filas por referidor');
select is(jsonb_array_length(pg_temp.rep('{"from":"2026-07-01","to":"2026-07-31","lists":false}') -> 'contacts'), 0, 'lists:false no trae listas');
select tests.login_as('00000000-0000-4000-8000-0000000000b7');
select is((select string_agg(b ->> 'id', ',') from jsonb_array_elements(pg_temp.rep('{"from":"2026-07-01","to":"2026-07-31"}') -> 'by_branch') b), '7',
  'jefe de Trinidad: solo la suya');
select throws_ok($$ select pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}') $$, 'P0001', 'forbidden', 'jefe: sucursal ajena prohibida');
select tests.login_as('00000000-0000-4000-8000-000000000002');
select ok(jsonb_array_length(pg_temp.rep('{"from":"2026-07-01","to":"2026-07-31"}') -> 'by_branch') >= 2, 'gerente: todas las sucursales');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}') $$, 'P0001', 'forbidden', 'el encargado no ve Referidos');
select throws_ok($$ select pg_temp.rep('{"from":"2026-07-01","to":"2026-07-31"}') $$, 'P0001', 'forbidden', 'el encargado tampoco en «todas»');
select tests.login_as('00000000-0000-4000-8000-000000000001');
select throws_ok($$ select pg_temp.rep('{"branch_id":5,"from":"2026-07-10","to":"2026-07-01"}') $$, 'P0001', 'invalid_input', 'hasta antes de desde');
select throws_ok($$ select pg_temp.rep('{"branch_id":5,"from":"2025-01-01","to":"2026-07-01"}') $$, 'P0001', 'invalid_input', 'más de 366 días');

-- Filtro «Referido por» (Captaciones y Seguimientos) ---------------------------------------------------
select is((public.list_prospects('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31","referrer":"any"}'::jsonb) ->> 'total')::int, 3,
  'Captaciones: solo referidos');
select is((public.list_prospects(format('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31","referrer":"%s"}', pg_temp.r('B'))::jsonb)
  -> 'rows' -> 0 ->> 'referrer_name'), 'Rango Beto', 'Captaciones: por referidor, con el nombre en la fila');
select is((public.list_followup_status('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31","referrer":"any"}'::jsonb) -> 'by_tab' ->> 'todos')::int, 3,
  'Seguimientos: solo referidos');

-- Unir referidores ----------------------------------------------------------------------------------------
select public.referral_goals_save(format('{"branch_id":5,"month":"2026-09-01","referrers":[{"id":%s,"goal":7}]}', pg_temp.r('B'))::jsonb);
select tests.login_as('00000000-0000-4000-8000-0000000000b7');
select throws_ok(format($$ select public.referrer_merge('{"from_id":%s,"into_id":%s}') $$, pg_temp.r('B'), pg_temp.r('A')),
  'P0001', 'forbidden', 'jefe de otra sucursal no une');
select tests.login_as('00000000-0000-4000-8000-0000000000b5');
select throws_ok(format($$ select public.referrer_merge('{"from_id":%s,"into_id":%s}') $$, pg_temp.r('B'), pg_temp.r('T')),
  'P0001', 'invalid_input', 'no se une con otra sucursal');
select throws_ok(format($$ select public.referrer_merge('{"from_id":%s,"into_id":%s}') $$, pg_temp.r('B'), pg_temp.r('B')),
  'P0001', 'invalid_input', 'no se une consigo mismo');
select lives_ok(format($$ select public.referrer_merge('{"from_id":%s,"into_id":%s}') $$, pg_temp.r('B'), pg_temp.r('A')), 'une Beto con Ana');
select is((pg_temp.row_of(pg_temp.rep('{"branch_id":5,"from":"2026-07-01","to":"2026-07-31"}'), 'Rango Ana') ->> 'arrived')::int, 3,
  'el reporte suma los de Beto en Ana');
select tests.logout();
select ok((select not active and merged_into = pg_temp.r('A')::smallint from public.referrers where id = pg_temp.r('B')::smallint)
  and (select goal from public.referrer_goals where referrer_id = pg_temp.r('A')::smallint and month = '2026-09-01') = 7
  and (select goal from public.referrer_goals where referrer_id = pg_temp.r('A')::smallint and month = '2026-07-01') = 31,
  'Beto desactivado y unido; su meta de septiembre pasa a Ana sin pisar la de julio');
select tests.login_as('00000000-0000-4000-8000-0000000000b5');
select throws_ok(format($$ select public.referrer_save('{"id":%s,"name":"Rango Beto","kind":"staff","active":true}') $$, pg_temp.r('B')),
  'P0001', 'invalid_input', 'un unido no se reactiva');

-- Captación sin señal que traía a Beto, y Beto escrito a mano → Ana
select tests.login_as('00000000-0000-4000-8000-000000000006');
select pg_temp.cap('07', '76514007', '2026-07-21T10:00:00-04:00', jsonb_build_object('referrer_id', pg_temp.r('B')));
select pg_temp.cap('08', '76514008', '2026-07-21T11:00:00-04:00', jsonb_build_object('referrer_new', jsonb_build_object('name', 'rango beto', 'kind', 'other')));
select tests.logout();
select is((select string_agg(distinct referrer_id::text, ',') from public.prospects where id in (pg_temp.pid('07'), pg_temp.pid('08'))),
  pg_temp.r('A'), 'por id y por nombre, un unido se guarda como su destino');

select * from finish();
rollback;
