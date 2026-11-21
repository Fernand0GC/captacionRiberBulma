begin;
select plan(25);

-- Spec 016: cargar y asignar referidos en lote, responsables con pendientes, aviso de celulares, Mis contactos y
-- contactos en el reporte por rango.
-- Jefes de prueba: d5 con Verdolago (5) y Trinidad (7); d7 solo con Trinidad (7).
-- Responsables de prueba: e1 y e2 auxiliares de Verdolago, e3 auxiliar de Verdolago desactivada, e7 auxiliar de Trinidad.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email, now(), now()
from (values
  ('00000000-0000-4000-8000-0000000000d5', 'jefe.lote5@captacion.riberbulma.local'),
  ('00000000-0000-4000-8000-0000000000d7', 'jefe.lote7@captacion.riberbulma.local'),
  ('00000000-0000-4000-8000-0000000000e1', 'aux.lote1@captacion.riberbulma.local'),
  ('00000000-0000-4000-8000-0000000000e2', 'aux.lote2@captacion.riberbulma.local'),
  ('00000000-0000-4000-8000-0000000000e3', 'aux.lote3@captacion.riberbulma.local'),
  ('00000000-0000-4000-8000-0000000000e7', 'aux.lote7@captacion.riberbulma.local')) as u(id, email);
insert into public.profiles (id, username, full_name, role, branch_id, contract_type, active, deactivated_at) values
  ('00000000-0000-4000-8000-0000000000d5', 'jefe.lote5', 'Jefe Lote Dos', 'sales_lead', null, 'permanent', true, null),
  ('00000000-0000-4000-8000-0000000000d7', 'jefe.lote7', 'Jefe Lote Trinidad', 'sales_lead', null, 'permanent', true, null),
  ('00000000-0000-4000-8000-0000000000e1', 'aux.lote1', 'Aux Lote Uno', 'field_assistant', 5, 'permanent', true, null),
  ('00000000-0000-4000-8000-0000000000e2', 'aux.lote2', 'Aux Lote Dos', 'field_assistant', 5, 'permanent', true, null),
  ('00000000-0000-4000-8000-0000000000e3', 'aux.lote3', 'Aux Lote Baja', 'field_assistant', 5, 'permanent', false, now()),
  ('00000000-0000-4000-8000-0000000000e7', 'aux.lote7', 'Aux Lote Trinidad', 'field_assistant', 7, 'permanent', true, null);
insert into public.profile_branches values
  ('00000000-0000-4000-8000-0000000000d5', 5), ('00000000-0000-4000-8000-0000000000d5', 7),
  ('00000000-0000-4000-8000-0000000000d7', 7);

create function pg_temp.pid(n text) returns text language sql as $$ select '01900000-0000-7000-8000-0000000160' || n $$;
grant execute on function pg_temp.pid(text) to authenticated;
create function pg_temp.item(n text, phone text, who text) returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.pid(n), 'full_name', 'Lote Cliente ' || n, 'phone', phone,
    'assigned_to', case when who is null then null else '00000000-0000-4000-8000-0000000000' || who end)
$$;
grant execute on function pg_temp.item(text, text, text) to authenticated;
create function pg_temp.save(p jsonb) returns jsonb language sql as $$ select public.referral_batch_save(p) $$;
grant execute on function pg_temp.save(jsonb) to authenticated;
create function pg_temp.pending(p_branch smallint, p_user text) returns int language sql as $$
  select (a ->> 'pending')::int from jsonb_array_elements(public.referral_assignees(p_branch)) a
  where a ->> 'id' = '00000000-0000-4000-8000-0000000000' || p_user
$$;
grant execute on function pg_temp.pending(smallint, text) to authenticated;
create temp table res (k text primary key, v jsonb);
grant all on res to authenticated;

-- Permisos -------------------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-0000000000d7');
select throws_ok($$ select public.referral_assignees(5::smallint) $$, 'forbidden', 'jefe sin la sucursal: no ve responsables');
select throws_ok($$ select pg_temp.save(jsonb_build_object('branch_id', 5, 'referrer_new', '{"name":"Lote Ajeno","kind":"staff"}'::jsonb,
  'items', jsonb_build_array(pg_temp.item('01', '76516001', null)))) $$, 'forbidden', 'jefe sin la sucursal: no carga');

select tests.login_as('00000000-0000-4000-8000-0000000000d5');
select throws_ok($$ select pg_temp.save('{"branch_id":5,"referrer_new":{"name":"Lote Ana","kind":"staff"},"items":[]}') $$,
  'invalid_input', 'sin filas: invalid_input');
select throws_ok($$ select pg_temp.save(jsonb_build_object('branch_id', 5, 'referrer_new', '{"name":"Lote Ana","kind":"staff"}'::jsonb,
  'items', jsonb_build_array(pg_temp.item('01', '76516001', 'e7')))) $$, 'invalid_input', 'responsable de otra sucursal: invalid_input');
select throws_ok($$ select pg_temp.save(jsonb_build_object('branch_id', 5, 'referrer_new', '{"name":"Lote Ana","kind":"staff"}'::jsonb,
  'items', jsonb_build_array(pg_temp.item('01', '76516001', 'e3')))) $$, 'invalid_input', 'responsable desactivado: invalid_input');
select is((select count(*)::int from public.prospects where phone_norm = '76516001'), 0, 'un rechazo no deja nada a medias');
select is((select count(*)::int from public.referrers where name = 'Lote Ana'), 0, 'ni crea el referidor');
select throws_ok($$ select pg_temp.save(jsonb_build_object('branch_id', 5, 'referrer_new', '{"name":"Lote Ana","kind":"jefe"}'::jsonb,
  'items', jsonb_build_array(pg_temp.item('01', '76516001', null)))) $$, 'invalid_input', 'tipo de referidor inválido');

-- Carga con referidor nuevo y responsables -----------------------------------------------------------------
insert into res select 'a', pg_temp.save(jsonb_build_object('branch_id', 5, 'referrer_new', '{"name":"Lote  Ana","kind":"staff"}'::jsonb,
  'items', jsonb_build_array(pg_temp.item('01', '76516001', 'e1'), pg_temp.item('02', '7651 6002', 'e2'), pg_temp.item('03', '76516003', null))));
select is((select v ->> 'accepted' from res where k = 'a')::int, 3, 'tres aceptadas');
select is((select v ->> 'referrer_name' from res where k = 'a'), 'Lote Ana', 'referidor nuevo con el nombre limpio');
select is((select source || '/' || kind from public.referrers where name = 'Lote Ana'), 'manager/staff', 'referidor nuevo: cargado por el jefe');
select is(pg_temp.pending(5::smallint, 'e1'), 1, 'pendientes: la auxiliar tiene 1');
select ok(not exists (select 1 from jsonb_array_elements(public.referral_assignees(5::smallint)) a
  where a ->> 'id' in ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000e7')), 'responsables: sin desactivados ni de otra sucursal');

-- Lo guardado (leído sin RLS)
select tests.logout();
select is((select count(*)::int from public.prospects
           where id::text in (pg_temp.pid('01'), pg_temp.pid('02'), pg_temp.pid('03'))
             and created_by = '00000000-0000-4000-8000-0000000000d5' and branch_id = 5
             and referrer_id = (select v ->> 'referrer_id' from res where k = 'a')::smallint), 3, 'registradas por el jefe, en la sucursal y con el referidor');
select is((select assigned_to::text from public.prospects where id::text = pg_temp.pid('02')), '00000000-0000-4000-8000-0000000000e2', 'asignada a la auxiliar elegida');
select is((select assigned_to from public.prospects where id::text = pg_temp.pid('03')), null, 'sin responsable si no se eligió');
select is((select actor_id::text from public.assignment_events where prospect_id::text = pg_temp.pid('01')), '00000000-0000-4000-8000-0000000000d5', 'historial de asignación con el jefe');

select tests.login_as('00000000-0000-4000-8000-0000000000d5');

-- Idempotencia: el mismo guardado no crea nada nuevo
select pg_temp.save(jsonb_build_object('branch_id', 5, 'referrer_new', '{"name":"Lote Ana","kind":"staff"}'::jsonb,
  'items', jsonb_build_array(pg_temp.item('01', '76516001', 'e1'), pg_temp.item('02', '76516002', 'e2'))));
select tests.logout();
select is((select count(*)::int from public.assignment_events where prospect_id::text in (pg_temp.pid('01'), pg_temp.pid('02'))), 2,
  'repetir el guardado no duplica clientes ni asignaciones');

-- Celular repetido: duplicado, sin asignar, con datos del original
select tests.login_as('00000000-0000-4000-8000-0000000000d5');
insert into res select 'd', pg_temp.save(jsonb_build_object('branch_id', 7, 'referrer_new', '{"name":"Lote Tere","kind":"client"}'::jsonb,
  'items', jsonb_build_array(pg_temp.item('04', '76516001', 'e7'))));
select is((select v #>> '{items,0,result}' || '/' || (v #>> '{items,0,full_name}') || '/' || (v #>> '{items,0,assigned_to_name}') from res where k = 'd'),
  'duplicate/Lote Cliente 01/Aux Lote Uno', 'duplicado: avisa el cliente y su responsable');
select tests.logout();
select is((select count(*)::int from public.assignment_events where prospect_id::text = pg_temp.pid('04')), 0, 'el duplicado no se asigna');
select tests.login_as('00000000-0000-4000-8000-0000000000d5');

-- Aviso de celulares antes de guardar
select is((select a ->> 'full_name' from jsonb_array_elements(public.referral_phone_check(5::smallint, array['7651 6002', '123', '76516999'])) a),
  'Lote Cliente 02', 'aviso: encuentra el repetido e ignora inválidos y libres');
select tests.login_as('00000000-0000-4000-8000-0000000000d7');
select is((select coalesce(a ->> 'full_name', 'oculto') || '/' || (a ->> 'branch_name') from jsonb_array_elements(public.referral_phone_check(7::smallint, array['76516002'])) a),
  'oculto/VERDOLAGO', 'aviso: no nombra clientes de sucursales ajenas');

-- Mis contactos: quién lo recomendó y quién lo asignó
select tests.login_as('00000000-0000-4000-8000-0000000000e1');
select is((select c ->> 'referrer_name' || '/' || (c ->> 'assigned_by_name') from jsonb_array_elements(public.my_contacts()) c where c ->> 'id' = pg_temp.pid('01')),
  'Lote Ana/Jefe Lote Dos', 'Mis contactos: referido por y asignado por');

-- Un contacto: baja pendientes y aparece en el reporte
select tests.logout();
insert into public.followups (id, prospect_id, result, method, effective, actor_id, note)
values ('01900000-0000-7000-8000-000000016099', pg_temp.pid('01')::uuid, 'no_answer', 'whatsapp_call', true,
        '00000000-0000-4000-8000-0000000000e1', 'Viene el sábado');
select tests.login_as('00000000-0000-4000-8000-0000000000d5');
select is(pg_temp.pending(5::smallint, 'e1'), 0, 'con un contacto deja de ser pendiente');
select is((select c ->> 'contacts' || '/' || (c ->> 'last_method') || '/' || (c ->> 'last_result') || '/' || (c ->> 'last_note')
           from jsonb_array_elements(public.referral_report_range(jsonb_build_object('branch_id', 5,
             'from', (now() at time zone 'America/La_Paz')::date, 'to', (now() at time zone 'America/La_Paz')::date)) -> 'contacts') c
           where c ->> 'id' = pg_temp.pid('01')),
  '1/whatsapp_call/no_answer/Viene el sábado', 'reporte: cantidad y último contacto');

select * from finish();
rollback;
