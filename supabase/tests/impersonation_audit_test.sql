-- Actuar como (spec 027) · corrección de la auditoría 2026-11-24 (H1 y H2):
-- volver después de vencer, altas auditadas, acting_by por defecto y bitácora de peticiones.
begin;
select plan(19);

-- Simula una petición de PostgREST: claims, cabeceras, método y ruta; corre la pre-request.
create or replace function pg_temp.request_as(uid uuid, act_header text, method text default 'POST',
  path text default '/rpc/submit_capture') returns void language plpgsql as $$
begin
  perform tests.login_as(uid);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.method', method, true);
  perform set_config('request.path', path, true);
  perform set_config('request.headers',
    case when act_header is null then '{}' else json_build_object('x-actuar-como', act_header)::text end, true);
  perform public.apply_impersonation();
end $$;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000d1', 'authenticated',
        'authenticated', 'admin2@captacion.riberbulma.local', now(), now());
insert into public.profiles (id, username, full_name, role, branch_id, contract_type, active) values
  ('00000000-0000-4000-8000-0000000000d1', 'admin2', 'Admin Dos', 'admin', null, 'permanent', true);

-- Uso normal (CA-8): el auxiliar registra solo; no se agrega auditoría de alta ni bitácora.
-- (La base local guarda filas de corridas anteriores: se compara contra el conteo de antes.)
create temp table antes on commit drop as select count(*) as n from public.impersonation_requests;
select pg_temp.request_as('00000000-0000-4000-8000-000000000004', null);
select is(public.submit_capture(jsonb_build_object(
  'id', '01900000-0000-7000-8000-0000000000e0', 'full_name', 'Cliente Normal', 'phone', '73340010',
  'product_id', 1, 'channel_id', 1, 'interest', 'high')) ->> 'result', 'accepted', 'sin suplantación: registra');
select tests.logout();
select is((select count(*) from public.audit_log where row_id = '01900000-0000-7000-8000-0000000000e0')::int, 0,
  'sin suplantación: el alta no agrega auditoría');
select is((select count(*) from public.impersonation_requests), (select n from antes),
  'sin suplantación: la bitácora no suma filas');

-- El admin empieza a actuar como el auxiliar de Verdolago.
select pg_temp.request_as('00000000-0000-4000-8000-000000000001', null);
create temp table s on commit drop as select public.impersonation_start('00000000-0000-4000-8000-000000000004') as r;
select tests.logout();

-- CA-4 · Alta auditada SIN editarla después.
select pg_temp.request_as('00000000-0000-4000-8000-000000000001', (select r ->> 'id' from s));
select is(public.submit_capture(jsonb_build_object(
  'id', '01900000-0000-7000-8000-0000000000e1', 'full_name', 'Cliente Suplantado', 'phone', '73340011',
  'product_id', 1, 'channel_id', 1, 'interest', 'high')) ->> 'result', 'accepted', 'actuando: registra');
select tests.logout();
select is((select actor_id from public.audit_log where table_name = 'prospects' and row_id = '01900000-0000-7000-8000-0000000000e1'),
  '00000000-0000-4000-8000-000000000004'::uuid, 'el alta queda auditada a nombre del auxiliar');
select is((select acting_by from public.audit_log where table_name = 'prospects' and row_id = '01900000-0000-7000-8000-0000000000e1'),
  '00000000-0000-4000-8000-000000000001'::uuid, 'y con el admin como autor real');

-- CA-4 · Contacto registrado actuando (como lo hacen las RPC: dueño de la tabla con los claims de la petición).
select pg_temp.request_as('00000000-0000-4000-8000-000000000001', (select r ->> 'id' from s));
select set_config('role', 'postgres', true);
insert into public.followups (id, prospect_id, result, effective, actor_id)
values ('01900000-0000-7000-8000-0000000000f1', '01900000-0000-7000-8000-0000000000e1', 'no_answer', false,
        '00000000-0000-4000-8000-000000000004');
-- CA-5 · Auditoría manual (como org_delete) sin nombrar acting_by: la columna lo completa sola.
insert into public.audit_log (table_name, row_id, actor_id, old, new)
values ('org_assignments', '01900000-0000-7000-8000-0000000000aa', auth.uid(), '{}', '{}');
select tests.logout();
select is((select acting_by from public.audit_log where table_name = 'followups' and row_id = '01900000-0000-7000-8000-0000000000f1'),
  '00000000-0000-4000-8000-000000000001'::uuid, 'el contacto queda auditado con el admin');
select is((select acting_by from public.audit_log where row_id = '01900000-0000-7000-8000-0000000000aa'),
  '00000000-0000-4000-8000-000000000001'::uuid, 'una auditoría manual guarda al admin sin nombrarlo');

-- CA-6 · Bitácora: las peticiones que escriben quedan anotadas; las lecturas no.
select is((select count(*) from public.impersonation_requests
           where impersonation_id = (select (r ->> 'id')::uuid from s) and method = 'POST'
             and path = '/rpc/submit_capture')::int, 2, 'cada petición que escribe actuando queda en la bitácora');
-- PostgREST corre en solo lectura los GET y las RPC STABLE (aunque vengan por POST): la pre-request no debe
-- intentar escribir ahí (fallaría la consulta entera con 25006).
savepoint lectura;
set transaction read only;
select lives_ok($$select pg_temp.request_as('00000000-0000-4000-8000-000000000001', (select r ->> 'id' from s),
  'POST', '/rpc/my_contacts')$$, 'una lectura en transacción de solo lectura no falla por la bitácora');
rollback to savepoint lectura;
select tests.logout();
select is((select count(*) from public.impersonation_requests
           where impersonation_id = (select (r ->> 'id')::uuid from s) and path = '/rpc/my_contacts')::int, 0,
  'y no se anota');

-- CA-7 · Nadie lee la bitácora directo (solo Sistemas por SQL).
select pg_temp.request_as('00000000-0000-4000-8000-000000000001', null);
select throws_ok($$select count(*) from public.impersonation_requests$$, '42501', null, 'ni el admin lee la bitácora directo');
select tests.logout();

-- CA-1 · Vencida: cualquier consulta normal se rechaza (no corre como el admin).
update public.impersonations set expires_at = now() - interval '1 second' where id = (select (r ->> 'id')::uuid from s);
select throws_ok($$select pg_temp.request_as('00000000-0000-4000-8000-000000000001', (select r ->> 'id' from s))$$,
  'P0001', 'impersonation_invalid', 'vencida: una escritura se rechaza');

-- CA-7 · Volver con la cabecera de OTRO admin: rechazado.
select throws_ok($$select pg_temp.request_as('00000000-0000-4000-8000-0000000000d1', (select r ->> 'id' from s),
  'POST', '/rpc/impersonation_end')$$, 'P0001', 'impersonation_invalid', 'otro admin no puede usar la ruta de volver');

-- CA-2 · Volver con la propia cabecera vencida: pasa como el admin y la cierra como vencida.
select lives_ok($$select pg_temp.request_as('00000000-0000-4000-8000-000000000001', (select r ->> 'id' from s),
  'POST', '/rpc/impersonation_end')$$, 'vencida: la ruta de volver pasa');
select is(auth.uid(), '00000000-0000-4000-8000-000000000001'::uuid, 'y corre como el admin, no como el auxiliar');
select public.impersonation_end();
select tests.logout();
select is((select end_reason from public.impersonations where id = (select (r ->> 'id')::uuid from s)), 'expired',
  'queda cerrada como vencida');
-- Ya cerrada, volver otra vez no falla (doble clic, dos pestañas).
select lives_ok($$select pg_temp.request_as('00000000-0000-4000-8000-000000000001', (select r ->> 'id' from s),
  'POST', '/rpc/impersonation_end')$$, 'cerrada: volver de nuevo no falla');
select tests.logout();
-- La excepción es solo para volver: cualquier otra ruta con la cerrada sigue rechazada.
select throws_ok($$select pg_temp.request_as('00000000-0000-4000-8000-000000000001', (select r ->> 'id' from s),
  'POST', '/rpc/impersonation_start')$$, 'P0001', 'impersonation_invalid', 'cerrada: otra ruta sigue rechazada');

select * from finish();
rollback;
