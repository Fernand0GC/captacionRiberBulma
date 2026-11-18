begin;
select plan(23);

-- Volantera Verdolago (sucursal 5)
select tests.login_as('00000000-0000-4000-8000-000000000006');

select is(
  public.submit_capture(jsonb_build_object(
    'id', '01900000-0000-7000-8000-000000000001', 'full_name', 'Juan Pérez', 'phone', '+591 7123-4567',
    'product_id', 1, 'channel_id', 3, 'interest', 'high', 'branch_id', 7,
    'client_created_at', '2026-10-28T09:14:03-04:00')) ->> 'result',
  'accepted', 'acepta una captación válida');

select is(
  public.submit_capture(jsonb_build_object(
    'id', '01900000-0000-7000-8000-000000000001', 'full_name', 'Juan Pérez', 'phone', '+591 7123-4567',
    'product_id', 1, 'channel_id', 3, 'interest', 'high')) ->> 'result',
  'accepted', 'idempotente: reenviar el mismo id devuelve accepted');

select tests.logout();
select is((select count(*) from public.prospects where id = '01900000-0000-7000-8000-000000000001')::int, 1, 'no duplica por reintento');
select is((select branch_id from public.prospects where id = '01900000-0000-7000-8000-000000000001'), 5::smallint,
  'el campo usa la sucursal del perfil aunque mande otra');
select is((select phone_norm from public.prospects where id = '01900000-0000-7000-8000-000000000001'), '71234567', 'teléfono normalizado');
select is((select shift from public.prospects where id = '01900000-0000-7000-8000-000000000001'), 'morning'::public.shift, 'turno por hora de registro');
select is((select count(*) from public.stage_events where prospect_id = '01900000-0000-7000-8000-000000000001'
  and from_stage is null and to_stage = 'capture')::int, 1, 'crea el evento inicial de etapa');

-- Duplicado desde otra sucursal (Trinidad), con otro formato
select tests.login_as('00000000-0000-4000-8000-000000000008');
select is(
  public.submit_capture(jsonb_build_object(
    'id', '01900000-0000-7000-8000-000000000002', 'full_name', 'Otro Nombre', 'phone', '71234567',
    'product_id', 2, 'channel_id', 1, 'interest', 'low')),
  '{"id": "01900000-0000-7000-8000-000000000002", "result": "duplicate"}'::jsonb,
  'duplicado global: devuelve duplicate sin datos de la ficha existente');
select tests.logout();
select is((select status from public.prospects where id = '01900000-0000-7000-8000-000000000002'),
  'duplicate_rejected'::public.prospect_status, 'se guarda como duplicado rechazado');
select is((select duplicate_of from public.prospects where id = '01900000-0000-7000-8000-000000000002'),
  '01900000-0000-7000-8000-000000000001'::uuid, 'apunta al original');

-- Mínimo: solo nombre y teléfono (FR-011)
select tests.login_as('00000000-0000-4000-8000-000000000006');
select is(public.submit_capture(jsonb_build_object(
  'id', '01900000-0000-7000-8000-000000000009', 'full_name', 'Solo Nombre', 'phone', '71111119')) ->> 'result',
  'accepted', 'acepta solo nombre y teléfono');
select tests.logout();
select ok((select product_id is null and channel_id is null and interest is null from public.prospects
  where id = '01900000-0000-7000-8000-000000000009'), 'producto, canal e interés quedan vacíos');
select tests.login_as('00000000-0000-4000-8000-000000000006');

-- Producto por categoría (Celulares es una sola opción)
select tests.login_as('00000000-0000-4000-8000-000000000006');
select is(public.submit_capture(jsonb_build_object(
  'id', '01900000-0000-7000-8000-00000000000a', 'full_name', 'Quiere Celular', 'phone', '71111120',
  'product_id', (select id from public.products where name = 'Celulares'))) ->> 'result',
  'accepted', 'acepta la categoría Celulares');
select tests.logout();

-- Fecha futura se recorta
select tests.login_as('00000000-0000-4000-8000-000000000006');
select public.submit_capture(jsonb_build_object(
  'id', '01900000-0000-7000-8000-000000000003', 'full_name', 'Ana Futura', 'phone', '61234567',
  'product_id', 5, 'channel_id', 2, 'interest', 'medium', 'client_created_at', '2030-01-01T00:00:00Z'));
select tests.logout();
select ok((select client_created_at <= now() + interval '10 minutes' from public.prospects
  where id = '01900000-0000-7000-8000-000000000003'), 'recorta fechas futuras');

-- Validaciones
select tests.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000004","full_name":"Pedro","phone":"81234567","product_id":1,"channel_id":1,"interest":"high"}') $$,
  'P0001', 'invalid_phone', 'teléfono inválido');
select throws_ok($$ select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000004","full_name":"Pe","phone":"71111111","product_id":1,"channel_id":1,"interest":"high"}') $$,
  'P0001', 'invalid_input', 'nombre corto');
select throws_ok($$ select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000004","full_name":"Pedro","phone":"71111111","product_id":1,"channel_id":1,"interest":"altisimo"}') $$,
  'P0001', 'invalid_input', 'interés inválido');

-- Encargado Verdolago no puede registrar en Trinidad
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000005","full_name":"Pedro Paz","phone":"71111112","product_id":1,"channel_id":1,"interest":"high","branch_id":7}') $$,
  'P0001', 'forbidden', 'encargado solo su sucursal');

-- Traslado: la captación conserva la sucursal original (analyze G4)
select tests.logout();
update public.profiles set branch_id = 7 where id = '00000000-0000-4000-8000-000000000006';
select is((select branch_id from public.prospects where id = '01900000-0000-7000-8000-000000000001'), 5::smallint,
  'traslado del autor no cambia la sucursal de la captación');
update public.profiles set branch_id = 5 where id = '00000000-0000-4000-8000-000000000006';

-- Baja (R9): dentro de la ventana y antes de la baja → acepta y marca; después de la baja → forbidden
update public.profiles set active = false, deactivated_at = now() - interval '1 day' where id = '00000000-0000-4000-8000-000000000006';
select tests.login_as('00000000-0000-4000-8000-000000000006');
select is(public.submit_capture(jsonb_build_object(
  'id', '01900000-0000-7000-8000-000000000006', 'full_name', 'Antes De Baja', 'phone', '71111113',
  'product_id', 1, 'channel_id', 1, 'interest', 'high', 'client_created_at', (now() - interval '2 days')::text)) ->> 'result',
  'accepted', 'inactivo: acepta lo creado antes de la baja');
select throws_ok(format($$ select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000007","full_name":"Despues Baja","phone":"71111114","product_id":1,"channel_id":1,"interest":"high","client_created_at":"%s"}') $$, now()::text),
  'P0001', 'forbidden', 'inactivo: rechaza lo creado después de la baja');
select tests.logout();
select ok((select late_after_deactivation from public.prospects where id = '01900000-0000-7000-8000-000000000006'),
  'marca late_after_deactivation');

update public.profiles set deactivated_at = now() - interval '8 days' where id = '00000000-0000-4000-8000-000000000006';
select tests.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.submit_capture(jsonb_build_object('id','01900000-0000-7000-8000-000000000008','full_name','Muy Tarde','phone','71111115','product_id',1,'channel_id',1,'interest','high','client_created_at',(now() - interval '9 days')::text)) $$,
  'P0001', 'forbidden', 'inactivo: fuera de la ventana de 7 días');

select * from finish();
rollback;
