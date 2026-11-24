-- Santa Cruz Contado (sucursal 12): queda separada de Santa Cruz crédito (10) y gerencia ve las dos.
begin;
select plan(16);

-- Personas de prueba: ejecutiva de contado, encargado de Santa Cruz crédito y jefa con Cobija + Santa Cruz.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, now(), now()
from (values ('00000000-0000-4000-8000-0000000000c1'::uuid, 'aux.contado@captacion.riberbulma.local'),
             ('00000000-0000-4000-8000-0000000000c2'::uuid, 'enc.scz@captacion.riberbulma.local'),
             ('00000000-0000-4000-8000-0000000000c3'::uuid, 'jefe.scz@captacion.riberbulma.local')) u(id, email);

-- CA-1 · La sucursal existe y está activa (si no existe, el insert de abajo falla por la FK: test en rojo).
select is((select name from public.branches where id = 12), 'SANTA CRUZ CONTADO', 'existe la sucursal 12 SANTA CRUZ CONTADO');
select is((select code from public.branches where id = 12), 'SANTACRUZCONTADO', 'su código es SANTACRUZCONTADO');
select ok((select active from public.branches where id = 12), 'está activa');
select ok((select name from public.branches where id = 10) = 'SANTA CRUZ', 'Santa Cruz crédito (10) no cambia');

insert into public.profiles (id, username, full_name, role, branch_id, contract_type) values
  ('00000000-0000-4000-8000-0000000000c1', 'aux.contado', 'Auxiliar Contado', 'field_assistant', 12, 'permanent'),
  ('00000000-0000-4000-8000-0000000000c2', 'enc.scz', 'Encargado SCZ', 'branch_manager', 10, 'permanent'),
  ('00000000-0000-4000-8000-0000000000c3', 'jefe.scz', 'Jefa SCZ', 'sales_lead', null, 'permanent');
insert into public.profile_branches values ('00000000-0000-4000-8000-0000000000c3', 2), ('00000000-0000-4000-8000-0000000000c3', 10);

-- CA-2 · La ejecutiva de contado registra: el cliente queda en la sucursal 12.
select tests.login_as('00000000-0000-4000-8000-0000000000c1');
select is(public.submit_capture(jsonb_build_object(
  'id', '01900000-0000-7000-8000-0000000000c1', 'full_name', 'Cliente Contado', 'phone', '73330001',
  'product_id', 1, 'channel_id', 1, 'interest', 'high')) ->> 'result', 'accepted', 'contado: registro aceptado');
select tests.logout();
select is((select branch_id from public.prospects where id = '01900000-0000-7000-8000-0000000000c1'), 12::smallint,
  'el cliente de contado queda en la sucursal 12');

-- Un cliente de Santa Cruz crédito, registrado por su encargado.
select tests.login_as('00000000-0000-4000-8000-0000000000c2');
select public.submit_capture(jsonb_build_object(
  'id', '01900000-0000-7000-8000-0000000000c2', 'full_name', 'Cliente Credito', 'phone', '73330002',
  'product_id', 1, 'channel_id', 1, 'interest', 'high'));

-- CA-4 · Crédito no ve contado.
select ok(not public.manages_branch(12::smallint), 'encargado de Santa Cruz crédito: no gestiona contado');
select throws_ok($$select public.list_prospects('{"branch_id":12}')$$, 'P0001', 'forbidden',
  'encargado de Santa Cruz crédito: Captaciones de contado prohibido');
select ok(not (public.list_prospects('{}') -> 'rows') @> '[{"id":"01900000-0000-7000-8000-0000000000c1"}]',
  'encargado de Santa Cruz crédito: su listado no trae clientes de contado');

select tests.login_as('00000000-0000-4000-8000-0000000000c3');
select ok(not public.manages_branch(12::smallint), 'jefa de Cobija + Santa Cruz: no gestiona contado');
select throws_ok($$select public.scoped_branch(12::smallint)$$, 'P0001', 'forbidden', 'jefa: elegir contado está prohibido');

-- CA-3 · Contado no ve crédito (la auxiliar no lee la tabla ni el listado de gestión).
select tests.login_as('00000000-0000-4000-8000-0000000000c1');
select is((select count(*)::int from public.prospects), 0, 'ejecutiva de contado: 0 filas directas');
select throws_ok($$select public.list_prospects('{"branch_id":10}')$$, 'P0001', 'forbidden',
  'ejecutiva de contado: Captaciones de crédito prohibido');

-- CA-6 · Teléfono repetido entre sucursales: sigue rechazado como hoy.
select is(public.submit_capture(jsonb_build_object(
  'id', '01900000-0000-7000-8000-0000000000c3', 'full_name', 'Repetido Credito', 'phone', '73330002',
  'product_id', 1, 'channel_id', 1, 'interest', 'high')) ->> 'result', 'duplicate',
  'contado: un teléfono ya registrado en crédito se rechaza');

-- CA-5 · Gerencia ve las dos.
select tests.login_as('00000000-0000-4000-8000-000000000002');
select ok(public.manages_branch(12::smallint) and public.manages_branch(10::smallint), 'gerente: gestiona contado y crédito');
select ok((public.list_prospects('{"branch_id":12}') -> 'rows') @> '[{"id":"01900000-0000-7000-8000-0000000000c1"}]',
  'gerente: ve el cliente de contado');

select * from finish();
rollback;
