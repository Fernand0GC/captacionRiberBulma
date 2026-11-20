begin;
select plan(32);

-- Spec 010: referidor escrito al registrar (20261120000200).
-- Usuarios del seed: 1 admin, 6 vol.verdolago (5), 8 vol.trinidad (7).
create function pg_temp.cap(p_id text, p_phone text, p_extra jsonb) returns jsonb
language sql as $$
  select public.submit_capture(jsonb_build_object('id', '01900000-0000-7000-8000-0000000100' || p_id,
    'full_name', 'Cliente ' || p_id, 'phone', p_phone, 'client_created_at', now()) || p_extra)
$$;
grant execute on function pg_temp.cap(text, text, jsonb) to authenticated;
-- security definer: el volantero no lee prospects por RLS; las comprobaciones miran la tabla directo.
create function pg_temp.ref_of(p_id text) returns smallint language sql security definer as $$
  select referrer_id from public.prospects where id = ('01900000-0000-7000-8000-0000000100' || p_id)::uuid
$$;
grant execute on function pg_temp.ref_of(text) to authenticated;
create function pg_temp.susi() returns public.referrers language sql as $$
  select r from public.referrers r where r.branch_id = 5 and r.name = 'Doña Susi'
$$;
grant execute on function pg_temp.susi() to authenticated;

-- Sucursal sin ese referidor: se crea y se asigna (US1) ------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000006');
select is(pg_temp.cap('01', '76010001', '{"referrer_new":{"name":"  Doña   Susi ","kind":"client"}}') ->> 'result', 'accepted', 'la captación entra');
select is((pg_temp.susi()).name, 'Doña Susi', 'crea el referidor con el nombre limpio');
select is((pg_temp.susi()).kind, 'client', 'con el tipo elegido');
select is((pg_temp.susi()).source, 'capture', 'marcado como nacido en el registro');
select is((pg_temp.susi()).created_by, '00000000-0000-4000-8000-000000000006'::uuid, 'con quién lo agregó');
select ok((pg_temp.susi()).active, 'queda activo para los demás');
select is(pg_temp.ref_of('01'), (pg_temp.susi()).id, 'el cliente queda con ese referidor');

-- Mismo nombre con otras mayúsculas, tildes y espacios: se reutiliza (US2, FR-007) ----------------------
select is(pg_temp.cap('02', '76010002', '{"referrer_new":{"name":"dona  SUSÍ","kind":"staff"}}') ->> 'result', 'accepted', 'segundo cliente');
select is(pg_temp.ref_of('02'), (pg_temp.susi()).id, 'usa el referidor existente');
select is((select count(*)::int from public.referrers where branch_id = 5 and public.referrer_key(name) = 'dona susi'), 1, 'no crea otro');
select is((pg_temp.susi()).kind, 'client', 'no cambia el tipo del existente');

-- Reenvío del mismo id: no duplica nada (FR-008) ----------------------------------------------------
select is(pg_temp.cap('01', '76010001', '{"referrer_new":{"name":"Otro Nombre","kind":"client"}}') ->> 'result', 'accepted', 'reenvío idempotente');
select is((select count(*)::int from public.referrers where branch_id = 5 and name = 'Otro Nombre'), 0, 'el reenvío no crea referidor');

-- Tipo inválido o ausente → other; referrer_id válido gana ---------------------------------------------
select is(pg_temp.cap('03', '76010003', '{"referrer_new":{"name":"Prueba Canal","kind":"channel"}}') ->> 'referrer', null, 'tipo no permitido no marca skipped');
select is((select kind from public.referrers where branch_id = 5 and name = 'Prueba Canal'), 'other', 'tipo no permitido se guarda como other');
select is(pg_temp.ref_of('04') is null and (pg_temp.cap('04', '76010004',
  jsonb_build_object('referrer_id', (pg_temp.susi()).id, 'referrer_new', '{"name":"No Debe Crearse","kind":"client"}'::jsonb)) ->> 'result') = 'accepted', true, 'con referrer_id válido entra');
select is(pg_temp.ref_of('04'), (pg_temp.susi()).id, 'referrer_id válido gana');
select is((select count(*)::int from public.referrers where name = 'No Debe Crearse'), 0, 'y no crea el escrito');

-- Nombre inválido: entra sin referidor y avisa (R4) ---------------------------------------------------
select is(pg_temp.cap('05', '76010005', '{"referrer_new":{"name":"X","kind":"client"}}'), jsonb_build_object(
  'id', '01900000-0000-7000-8000-000000010005', 'result', 'accepted', 'referrer', 'skipped'), 'nombre corto: aceptada con skipped');
select is(pg_temp.ref_of('05'), null, 'queda sin referidor');
select is(pg_temp.cap('06', '76010006', '{"referrer_new":"texto"}') ? 'referrer', false, 'referrer_new que no es objeto se ignora');
select is(pg_temp.cap('07', '76010007', '{}') ? 'referrer', false, 'app anterior: sin campo, respuesta igual que antes');

-- Coincide con un desactivado: se usa y sigue desactivado (R9) ----------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000001');
select ok(public.referrer_save('{"branch_id":5,"name":"Vieja Lista","kind":"staff","active":false}') is not null, 'admin deja uno desactivado');
select throws_ok($$ select public.referrer_save('{"branch_id":5,"name":"DOÑA  susí","kind":"client"}') $$, 'P0001', 'invalid_input',
  'referrer_save: nombre repetido también por tildes y espacios');
select tests.login_as('00000000-0000-4000-8000-000000000006');
select is((pg_temp.cap('08', '76010008', '{"referrer_new":{"name":"vieja lista","kind":"client"}}') ->> 'result'), 'accepted', 'registra con el desactivado');
select is((select r.active from public.referrers r where r.id = pg_temp.ref_of('08')), false, 'lo usa y sigue desactivado');

-- Otra sucursal: su propia lista ------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000008');
select is(pg_temp.cap('09', '76010009', '{"referrer_new":{"name":"Doña Susi","kind":"client"}}') ->> 'result', 'accepted', 'Trinidad registra el mismo nombre');
select is((select branch_id from public.referrers where id = pg_temp.ref_of('09')), 7::smallint, 'crea el suyo, sin mezclar sucursales');

-- Tope diario: 10 nuevos por persona (R5). El vol. de Verdolago lleva 2 (Doña Susi, Prueba Canal). ---------
select tests.login_as('00000000-0000-4000-8000-000000000006');
select is((select count(*) filter (where pg_temp.cap((20 + g)::text, '760102' || (20 + g)::text,
  jsonb_build_object('referrer_new', jsonb_build_object('name', 'Tope ' || g, 'kind', 'other'))) ? 'referrer')::int
  from generate_series(1, 8) g), 0, 'hasta 10 nuevos en el día se crean');
select is(pg_temp.cap('40', '76010240', '{"referrer_new":{"name":"El Once","kind":"other"}}') ->> 'referrer', 'skipped', 'el 11.º no se crea y avisa');
select tests.logout();
select is(pg_temp.ref_of('40') is null and exists (select 1 from public.prospects where id = '01900000-0000-7000-8000-000000010040' and status = 'active'),
  true, 'la captación del 11.º entra igual, sin referidor');

-- El reporte de la 005 cuenta a esos clientes sin cambios (FR-014): 01, 02 y 04 son de Doña Susi.
select tests.login_as('00000000-0000-4000-8000-000000000001');
select is((select (r ->> 'arrived')::int from jsonb_array_elements(public.referral_report(5::smallint, (now() at time zone 'America/La_Paz')::date) -> 'referrers') r
  where r ->> 'name' = 'Doña Susi'), 3, 'el reporte de referidos cuenta los clientes registrados así');

select * from finish();
rollback;
