begin;
select plan(24);

-- Spec 017: pedidos a referidores, celular del referidor, datos de Seguimiento, historial, registro automático al
-- cargar y unión. Jefes de prueba: f5 con Verdolago (5) y Trinidad (7); f7 solo con Trinidad (7).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email, now(), now()
from (values
  ('00000000-0000-4000-8000-0000000000f5', 'jefe.seg5@captacion.riberbulma.local'),
  ('00000000-0000-4000-8000-0000000000f7', 'jefe.seg7@captacion.riberbulma.local')) as u(id, email);
insert into public.profiles (id, username, full_name, role, branch_id, contract_type, active, deactivated_at) values
  ('00000000-0000-4000-8000-0000000000f5', 'jefe.seg5', 'Jefe Seguimiento Dos', 'sales_lead', null, 'permanent', true, null),
  ('00000000-0000-4000-8000-0000000000f7', 'jefe.seg7', 'Jefe Seguimiento Siete', 'sales_lead', null, 'permanent', true, null);
insert into public.profile_branches values
  ('00000000-0000-4000-8000-0000000000f5', 5), ('00000000-0000-4000-8000-0000000000f5', 7),
  ('00000000-0000-4000-8000-0000000000f7', 7);

create temp table ids (k text primary key, v smallint);
grant all on ids to authenticated;
create function pg_temp.rid(k text) returns smallint language sql as $$ select v from ids where ids.k = $1 $$;
grant execute on function pg_temp.rid(text) to authenticated;
create function pg_temp.ask(k text, method text, result text, next_on date default null) returns integer language sql as $$
  select public.referrer_ask_save(jsonb_build_object('referrer_ids', jsonb_build_array(pg_temp.rid(k)), 'method', method,
    'result', result, 'next_on', next_on))
$$;
grant execute on function pg_temp.ask(text, text, text, date) to authenticated;
create function pg_temp.fu(branch smallint) returns jsonb language sql as $$
  select public.referrer_followup(jsonb_build_object('branch_id', branch,
    'from', (now() at time zone 'America/La_Paz')::date - 6, 'to', (now() at time zone 'America/La_Paz')::date))
$$;
grant execute on function pg_temp.fu(smallint) to authenticated;
create function pg_temp.fref(branch smallint, k text) returns jsonb language sql as $$
  select r from jsonb_array_elements(pg_temp.fu(branch) -> 'referrers') r where (r ->> 'id')::smallint = pg_temp.rid(k)
$$;
grant execute on function pg_temp.fref(smallint, text) to authenticated;

-- Celular del referidor ------------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-0000000000f5');
insert into ids select 'ana', public.referrer_save('{"branch_id":5,"name":"Seg Ana","kind":"freelance","phone":"7651 7001"}');
insert into ids select 'beto', public.referrer_save('{"branch_id":5,"name":"Seg Beto","kind":"staff"}');
insert into ids select 'tere', public.referrer_save('{"branch_id":7,"name":"Seg Tere","kind":"client"}');
select is(pg_temp.fref(5::smallint, 'ana') ->> 'phone', '7651 7001', 'celular guardado y visible en Seguimiento');
select throws_ok($$ select public.referrer_save(jsonb_build_object('id', pg_temp.rid('beto'), 'name', 'Seg Beto', 'kind', 'staff', 'phone', '123')) $$,
  'invalid_input', 'celular inválido');
select throws_like($$ select public.referrer_save(jsonb_build_object('id', pg_temp.rid('beto'), 'name', 'Seg Beto', 'kind', 'staff', 'phone', '76517001')) $$,
  'invalid_input', 'celular repetido en la sucursal');
select lives_ok($$ select public.referrer_save(jsonb_build_object('id', pg_temp.rid('beto'), 'name', 'Seg Beto', 'kind', 'staff', 'sort', 0, 'active', true)) $$,
  'sin «phone» se guarda como antes');
select throws_ok($$ select phone from public.referrer_phones $$, '42501', null, 'el celular no se lee directo');

-- Permisos y validación ------------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-0000000000f7');
select throws_ok($$ select pg_temp.ask('ana', 'message', 'promised') $$, 'forbidden', 'jefe sin la sucursal: no registra');
select throws_ok($$ select public.referrer_history(pg_temp.rid('ana')) $$, 'forbidden', 'ni ve el historial');
select tests.login_as('00000000-0000-4000-8000-0000000000f5');
select throws_ok($$ select pg_temp.ask('ana', 'call', 'promised') $$, 'invalid_input', 'medio inválido (sin llamada telefónica)');
select throws_ok($$ select pg_temp.ask('ana', 'message', 'maybe') $$, 'invalid_input', 'resultado inválido');
select throws_ok($$ select pg_temp.ask('ana', 'message', 'promised', (now() at time zone 'America/La_Paz')::date - 1) $$, 'invalid_input', 'fecha pasada');
select throws_ok($$ select public.referrer_ask_save('{"referrer_ids":[],"method":"message","result":"waiting"}') $$, 'invalid_input', 'sin referidores');

-- Guardar ---------------------------------------------------------------------------------------------------------
select is(pg_temp.ask('ana', 'whatsapp_call', 'promised', (now() at time zone 'America/La_Paz')::date + 2), 1, 'un pedido');
select is(public.referrer_ask_save(jsonb_build_object('referrer_ids', jsonb_build_array(pg_temp.rid('beto'), pg_temp.rid('tere')),
  'method', 'message', 'result', 'waiting', 'note', 'Mensaje a todos')), 2, 'pedir a varios: uno por referidor (dos sucursales)');
select is(pg_temp.ask('beto', 'in_person', 'quit', (now() at time zone 'America/La_Paz')::date + 3), 1, 'No quiere seguir');
select is(pg_temp.fref(5::smallint, 'beto') #>> '{last_ask,next_on}', null, '«No quiere seguir» no lleva fecha');
select is(pg_temp.fref(7::smallint, 'tere') #>> '{last_ask,note}', 'Mensaje a todos', 'el último pedido trae su observación (En qué quedó)');

-- Datos de Seguimiento ---------------------------------------------------------------------------------------------
select is(pg_temp.fref(5::smallint, 'ana') #>> '{last_ask,result}' || '/' || (pg_temp.fref(5::smallint, 'ana') #>> '{last_ask,kept}') || '/' ||
  (pg_temp.fref(5::smallint, 'ana') #>> '{last_ask,actor_name}'), 'promised/false/Jefe Seguimiento Dos', 'último pedido con promesa pendiente y quién');
select is((select count(*)::int from jsonb_array_elements(pg_temp.fu(null) -> 'asks') a
           where (a ->> 'referrer_id')::smallint in (pg_temp.rid('ana'), pg_temp.rid('beto'), pg_temp.rid('tere'))), 4,
  'todas mis sucursales: los 4 pedidos');
select ok(exists (select 1 from jsonb_array_elements(pg_temp.fu(5::smallint) -> 'staff') s where s ->> 'full_name' = 'Jefe Seguimiento Dos'),
  'quién puede pedir: el jefe de la sucursal');

-- Cargar (016) anota «Pasó contactos» automático y cumple la promesa ---------------------------------------------
select public.referral_batch_save(jsonb_build_object('branch_id', 5, 'referrer_id', pg_temp.rid('ana'),
  'items', jsonb_build_array(jsonb_build_object('id', '01900000-0000-7000-8000-000000017001', 'full_name', 'Seg Cliente Uno', 'phone', '76517101'))));
select ok((pg_temp.fref(5::smallint, 'ana') ->> 'last_load_at') is not null, 'la carga queda como registro automático');
select is(pg_temp.fref(5::smallint, 'ana') #>> '{last_ask,kept}', 'true', 'y la promesa queda cumplida');
select is((select count(*)::int from jsonb_array_elements(pg_temp.fu(5::smallint) -> 'arrivals') a
           where (a ->> 'referrer_id')::smallint = pg_temp.rid('ana')), 1, 'llegada del referido en los datos');

-- Historial y unión ------------------------------------------------------------------------------------------------
select is(jsonb_array_length(public.referrer_history(pg_temp.rid('ana'))), 2, 'historial: pedido y carga');
insert into ids select 'ana2', public.referrer_save('{"branch_id":5,"name":"Seg Ana Dos","kind":"freelance"}');
select pg_temp.ask('ana2', 'message', 'none_now');
select public.referrer_merge(jsonb_build_object('from_id', pg_temp.rid('ana2'), 'into_id', pg_temp.rid('ana')));
select is(jsonb_array_length(public.referrer_history(pg_temp.rid('ana'))), 3, 'al unir, los pedidos pasan al que queda');

select * from finish();
rollback;
