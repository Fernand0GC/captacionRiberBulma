begin;
select plan(54);

-- Spec 005: referidos por origen (20261118001000).
-- Usuarios del seed: 1 admin, 2 gerente, 3 enc.verdolago (5), 6 vol.verdolago (5), 8 vol.trinidad (7).
-- Jefes de prueba: a5 con Verdolago (5); a6 con Trinidad (7).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a5', 'authenticated', 'authenticated',
   'jefe.ref5@captacion.riberbulma.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a6', 'authenticated', 'authenticated',
   'jefe.ref7@captacion.riberbulma.local', now(), now());
insert into public.profiles (id, username, full_name, role, branch_id, contract_type) values
  ('00000000-0000-4000-8000-0000000000a5', 'jefe.ref5', 'Jefe Verdolago', 'sales_lead', null, 'permanent'),
  ('00000000-0000-4000-8000-0000000000a6', 'jefe.ref7', 'Jefe Trinidad', 'sales_lead', null, 'permanent');
insert into public.profile_branches values ('00000000-0000-4000-8000-0000000000a5', 5), ('00000000-0000-4000-8000-0000000000a6', 7);

create temp table ref (name text primary key, id smallint);
grant all on ref to authenticated;

create function pg_temp.cap(p_id text, p_phone text, p_at text, p_ref text) returns text
language sql as $$
  select public.submit_capture(jsonb_build_object('id', '01900000-0000-7000-8000-0000000050' || p_id, 'full_name', 'Referido ' || p_id,
    'phone', p_phone, 'client_created_at', p_at, 'referrer_id', p_ref)) ->> 'result'
$$;
grant execute on function pg_temp.cap(text, text, text, text) to authenticated;
create function pg_temp.pid(p_id text) returns uuid language sql as $$ select ('01900000-0000-7000-8000-0000000050' || p_id)::uuid $$;
grant execute on function pg_temp.pid(text) to authenticated;
create function pg_temp.row_of(p_report jsonb, p_name text) returns jsonb language sql as $$
  select r from jsonb_array_elements(p_report -> 'referrers') r where r ->> 'name' = p_name
$$;
grant execute on function pg_temp.row_of(jsonb, text) to authenticated;

-- Referidores: quién puede administrarlos (FR-006) ----------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000001');
insert into ref select 'F', public.referrer_save('{"branch_id":5,"name":"Contacto Fernanda","kind":"staff"}');
select ok((select id from ref where name = 'F') is not null, 'admin crea un referidor');
select tests.login_as('00000000-0000-4000-8000-0000000000a5');
insert into ref select 'W', public.referrer_save('{"branch_id":5,"name":"  Freelance   Walker ","kind":"freelance","sort":2}');
select is((select name from public.referrers where id = (select id from ref where name = 'W')), 'Freelance Walker', 'jefe de su sucursal crea; nombre limpio');
insert into ref select 'D', public.referrer_save('{"branch_id":5,"name":"Freelance Tamara","kind":"freelance","active":false}');
select throws_ok($$ select public.referrer_save('{"branch_id":5,"name":"contacto fernanda","kind":"staff"}') $$,
  'P0001', 'invalid_input', 'nombre repetido en la sucursal (sin distinguir mayúsculas)');
select throws_ok($$ select public.referrer_save('{"branch_id":5,"name":"X","kind":"staff"}') $$, 'P0001', 'invalid_input', 'nombre muy corto');
select throws_ok($$ select public.referrer_save('{"branch_id":5,"name":"Pago","kind":"bonus"}') $$, 'P0001', 'invalid_input', 'tipo inválido');
select throws_ok($$ select public.referrer_save('{"branch_id":7,"name":"Ajeno","kind":"staff"}') $$, 'P0001', 'forbidden', 'jefe: sucursal ajena prohibida');
select throws_ok(format($$ select public.referrer_save('{"id":%s,"branch_id":7,"name":"Contacto Fernanda","kind":"staff"}') $$,
  (select id from ref where name = 'F')), 'P0001', 'invalid_input', 'no cambia de sucursal');
select tests.login_as('00000000-0000-4000-8000-0000000000a6');
select throws_ok(format($$ select public.referrer_save('{"id":%s,"name":"Renombrado","kind":"staff"}') $$,
  (select id from ref where name = 'F')), 'P0001', 'forbidden', 'jefe de otra sucursal no edita');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.referrer_save('{"branch_id":5,"name":"Del encargado","kind":"staff"}') $$,
  'P0001', 'forbidden', 'el encargado no administra referidores');
select throws_ok($$ insert into public.referrers (branch_id, name, kind) values (5, 'Directo', 'staff') $$, '42501', null,
  'sin escritura directa en la tabla');
select tests.login_as('00000000-0000-4000-8000-000000000002');
insert into ref select 'T', public.referrer_save('{"branch_id":7,"name":"App","kind":"channel"}');
select ok((select id from ref where name = 'T') is not null, 'gerente crea en cualquier sucursal');
select tests.login_as('00000000-0000-4000-8000-000000000006');
select ok((select count(*) from public.referrers where id in (select id from ref)) = 4, 'el campo lee referidores (catálogo sin señal)');

-- Metas (FR-007) ------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-0000000000a5');
select lives_ok(format($$ select public.referral_goals_save('{"branch_id":5,"month":"2026-08-15","referrers":[{"id":%s,"goal":20}]}') $$,
  (select id from ref where name = 'F')), 'meta de agosto (cualquier día del mes)');
select lives_ok(format($$ select public.referral_goals_save('{"branch_id":5,"month":"2026-09-01","referrers":[{"id":%s,"goal":10}]}') $$,
  (select id from ref where name = 'W')), 'meta de septiembre');
select throws_ok(format($$ select public.referral_goals_save('{"branch_id":5,"month":"2026-09-01","referrers":[{"id":%s,"goal":3}]}') $$,
  (select id from ref where name = 'T')), 'P0001', 'invalid_input', 'referidor de otra sucursal en las metas');
select throws_ok(format($$ select public.referral_goals_save('{"branch_id":5,"month":"2026-09-01","referrers":[{"id":%s,"goal":10000}]}') $$,
  (select id from ref where name = 'F')), 'P0001', 'invalid_input', 'meta fuera de rango');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok(format($$ select public.referral_goals_save('{"branch_id":5,"month":"2026-09-01","referrers":[{"id":%s,"goal":1}]}') $$,
  (select id from ref where name = 'F')), 'P0001', 'forbidden', 'el encargado no pone metas');

-- Registro (FR-001, R3) -----------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000006');
select is(pg_temp.cap('01', '76505001', '2026-09-04T10:00:00-04:00', (select id::text from ref where name = 'F')), 'accepted', 'referido válido');
select pg_temp.cap('02', '76505002', '2026-09-04T23:30:00-04:00', (select id::text from ref where name = 'F'));
select pg_temp.cap('03', '76505003', '2026-09-12T09:00:00-04:00', (select id::text from ref where name = 'F'));
select pg_temp.cap('04', '76505004', '2026-09-13T09:00:00-04:00', (select id::text from ref where name = 'F'));
select pg_temp.cap('05', '76505005', '2026-09-30T23:00:00-04:00', (select id::text from ref where name = 'W'));
select is(pg_temp.cap('06', '76505006', '2026-09-14T09:00:00-04:00', (select id::text from ref where name = 'T')), 'accepted',
  'referidor de otra sucursal: se acepta igual');
select is(pg_temp.cap('07', '76505007', '2026-09-14T09:00:00-04:00', 'abc'), 'accepted', 'referidor inválido: se acepta igual');
select is(pg_temp.cap('08', '76505001', '2026-09-15T09:00:00-04:00', (select id::text from ref where name = 'W')), 'duplicate', 'duplicado sigue igual');
select pg_temp.cap('09', '76505009', '2026-10-01T00:30:00-04:00', (select id::text from ref where name = 'F'));
select pg_temp.cap('10', '76505010', '2026-09-16T09:00:00-04:00', (select id::text from ref where name = 'F'));
select is(pg_temp.cap('11', '76505011', '2026-09-17T09:00:00-04:00', (select id::text from ref where name = 'D')), 'accepted',
  'referidor desactivado (registro sin señal): se acepta');
select lives_ok($$ select public.submit_capture('{"id":"01900000-0000-7000-8000-000000005012","full_name":"Sin Referido","phone":"76505012"}') $$,
  'captación sin referidor, como la app publicada');

select tests.logout();
select ok((select referrer_id is null from public.prospects where id = pg_temp.pid('06')), 'otra sucursal: queda nulo');
select ok((select referrer_id is null from public.prospects where id = pg_temp.pid('07')), 'inválido: queda nulo');
select is((select referrer_id from public.prospects where id = pg_temp.pid('08') and status = 'duplicate_rejected'),
  (select id from ref where name = 'W'), 'el duplicado guarda el referidor (para la 006)');
select is((select referrer_id from public.prospects where id = pg_temp.pid('11')), (select id from ref where name = 'D'), 'desactivado: se guarda');

-- Etapas: p02 en seguimiento, p03 compra el 20, p04 sin interés; p10 anulado (eventos simulados como postgres).
update public.prospects set stage = 'followup', stage_changed_at = now() where id = pg_temp.pid('02');
update public.prospects set stage = 'sale', sold_at = '2026-09-20T15:00:00-04:00', product_id = (select min(id) from public.products) where id = pg_temp.pid('03');
insert into public.stage_events (prospect_id, from_stage, to_stage, actor_id, created_at)
values (pg_temp.pid('03'), 'capture', 'sale', '00000000-0000-4000-8000-000000000003', '2026-09-20T15:00:00-04:00');
update public.prospects set stage = 'lost', lost_reason_id = (select min(id) from public.lost_reasons) where id = pg_temp.pid('04');
select tests.login_as('00000000-0000-4000-8000-000000000001');
select public.void_prospect(pg_temp.pid('10'), 'Prueba de anulación');

-- Corregir el origen (FR-001, FR-003) ---------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select lives_ok(format($$ select public.update_prospect(%L, '{"referrer_id":%s}') $$, pg_temp.pid('04'), (select id from ref where name = 'W')),
  'el encargado corrige el origen');
select ok((select bool_or(x ->> 'type' = 'edit' and x -> 'data' -> 'old' ->> 'referrer_id' = 'Contacto Fernanda'
                          and x -> 'data' -> 'new' ->> 'referrer_id' = 'Freelance Walker')
           from jsonb_array_elements(public.get_prospect(pg_temp.pid('04')) -> 'timeline') x), 'historial con nombres de antes y después');
select is(public.get_prospect(pg_temp.pid('04')) -> 'prospect' ->> 'referrer', 'Freelance Walker', 'la ficha muestra el referidor');
select throws_ok(format($$ select public.update_prospect(%L, '{"referrer_id":%s}') $$, pg_temp.pid('01'), (select id from ref where name = 'T')),
  'P0001', 'invalid_input', 'referidor de otra sucursal: rechazado');
select throws_ok(format($$ select public.update_prospect(%L, '{"referrer_id":%s}') $$, pg_temp.pid('01'), (select id from ref where name = 'D')),
  'P0001', 'invalid_input', 'referidor desactivado: no se elige al corregir');
select lives_ok(format($$ select public.update_prospect(%L, '{"referrer_id":%s,"full_name":"Referido 11 bis"}') $$, pg_temp.pid('11'), (select id from ref where name = 'D')),
  'el desactivado que ya tenía se conserva al editar otros datos');
select lives_ok(format($$ select public.update_prospect(%L, '{"referrer_id":null}') $$, pg_temp.pid('07')), 'nulo quita el origen');
select tests.logout();
select is((select count(*)::int from public.audit_log where table_name = 'prospects' and row_id = pg_temp.pid('04') and new ? 'referrer_id'), 1,
  'el cambio queda en la auditoría');

-- Reporte (FR-009…FR-014) ---------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-0000000000a5');
create temp table rep as select public.referral_report(5::smallint, '2026-09-10') as r;
select is((select r ->> 'month' from rep), '2026-09-01', 'mes normalizado al día 1');
select is((select (r ->> 'days')::int from rep), 30, 'días del mes');
select is((select jsonb_build_array(x -> 'goal', x -> 'goal_from', x -> 'arrived', x -> 'uncontacted', x -> 'in_followup', x -> 'sold', x -> 'lost')
           from rep, pg_temp.row_of(r, 'Contacto Fernanda') x),
  '[20, "2026-08-01", 3, 1, 1, 1, 0]'::jsonb, 'Fernanda: meta arrastrada de agosto; llegados y etapas (sin duplicado, anulado ni octubre)');
select is((select jsonb_build_array(x -> 'goal', x -> 'arrived', x -> 'uncontacted', x -> 'sold', x -> 'lost') from rep, pg_temp.row_of(r, 'Freelance Walker') x),
  '[10, 2, 1, 0, 1]'::jsonb, 'Walker: meta del mes y el contacto corregido');
select is((select x -> 'by_day' from rep, pg_temp.row_of(r, 'Contacto Fernanda') x),
  '{"4": {"arrived": 2, "sold": 0}, "12": {"arrived": 1, "sold": 0}, "20": {"arrived": 0, "sold": 1}}'::jsonb,
  'avance por día en hora de La Paz, con la venta en su día');
select ok((select x ->> 'active' = 'false' and (x ->> 'arrived')::int = 1 from rep, pg_temp.row_of(r, 'Freelance Tamara') x),
  'desactivado con contactos sigue en el reporte');
select is((select jsonb_array_length(r -> 'contacts') from rep), 6, 'contactos del mes: solo fichas activas');
select is((select c ->> 'sold_at' from rep, jsonb_array_elements(r -> 'contacts') c where c ->> 'id' = pg_temp.pid('03')::text)::timestamptz,
  '2026-09-20T15:00:00-04:00'::timestamptz, 'fecha de venta del contacto');
select ok((select pg_temp.row_of(public.referral_report(5::smallint, '2026-08-01'), 'Freelance Tamara') is null),
  'desactivado sin contactos en el mes no aparece');
select lives_ok(format($$ select public.referral_goals_save('{"branch_id":5,"month":"2026-09-01","referrers":[{"id":%s,"goal":5}]}') $$,
  (select id from ref where name = 'F')), 'meta propia de septiembre');
select is((select (pg_temp.row_of(public.referral_report(5::smallint, '2026-09-01'), 'Contacto Fernanda') ->> 'goal')::int), 5, 'usa la meta del mes');
select lives_ok(format($$ select public.referral_goals_save('{"branch_id":5,"month":"2026-09-01","referrers":[{"id":%s,"goal":null}]}') $$,
  (select id from ref where name = 'F')), 'meta nula borra la del mes');
select is((select (pg_temp.row_of(public.referral_report(5::smallint, '2026-09-01'), 'Contacto Fernanda') ->> 'goal')::int), 20, 'vuelve a arrastrar la de agosto');
select throws_ok($$ select public.referral_report(7::smallint, '2026-09-01') $$, 'P0001', 'forbidden', 'jefe: reporte de sucursal ajena prohibido');

select tests.login_as('00000000-0000-4000-8000-0000000000a6');
select throws_ok($$ select public.referral_report(5::smallint, '2026-09-01') $$, 'P0001', 'forbidden', 'jefe de otra sucursal: prohibido');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.referral_report(5::smallint, '2026-09-01') $$, 'P0001', 'forbidden', 'el encargado no ve el reporte');
select tests.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.referral_report(5::smallint, '2026-09-01') $$, 'P0001', 'forbidden', 'el campo no ve el reporte');
select tests.login_as('00000000-0000-4000-8000-000000000002');
select is((select (pg_temp.row_of(public.referral_report(5::smallint, '2026-09-01'), 'Contacto Fernanda') ->> 'arrived')::int), 3, 'el gerente ve el reporte');
select tests.login_as('00000000-0000-4000-8000-000000000001');
select ok((select pg_temp.row_of(public.referral_report(5::smallint, '2026-09-01'), 'App') is null), 'Sistemas lo ve; solo referidores de la sucursal');

select * from finish();
rollback;
