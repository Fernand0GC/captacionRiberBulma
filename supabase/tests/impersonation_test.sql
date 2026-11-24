-- Actuar como (spec 027): solo admin, con permisos de la persona, vence a los 30 min y deja al autor real.
begin;
select plan(25);

-- Simula una petición de PostgREST: claims del JWT + cabeceras, y corre la función pre-request.
create or replace function pg_temp.request_as(uid uuid, act_header text) returns void language plpgsql as $$
begin
  perform tests.login_as(uid);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.headers',
    case when act_header is null then '{}' else json_build_object('x-actuar-como', act_header)::text end, true);
  perform public.apply_impersonation();
end $$;

-- Personas: admin (seed 001), otro admin, auxiliar de Verdolago (seed 004), gerente (seed 002), un inactivo.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, now(), now()
from (values ('00000000-0000-4000-8000-0000000000d1'::uuid, 'admin2@captacion.riberbulma.local'),
             ('00000000-0000-4000-8000-0000000000d2'::uuid, 'inactivo@captacion.riberbulma.local')) u(id, email);
insert into public.profiles (id, username, full_name, role, branch_id, contract_type, active, deactivated_at) values
  ('00000000-0000-4000-8000-0000000000d1', 'admin2', 'Admin Dos', 'admin', null, 'permanent', true, null),
  ('00000000-0000-4000-8000-0000000000d2', 'aux.inactivo', 'Auxiliar Inactivo', 'field_assistant', 5, 'permanent', false, now());

-- Sin cabecera: nada cambia (es el camino de TODAS las consultas normales).
select pg_temp.request_as('00000000-0000-4000-8000-000000000004', null);
select is(auth.uid(), '00000000-0000-4000-8000-000000000004'::uuid, 'sin cabecera: la identidad no cambia');

-- CA-4 · Quien no es admin no puede empezar.
select throws_ok($$select public.impersonation_start('00000000-0000-4000-8000-000000000006')$$, 'P0001', 'forbidden',
  'auxiliar: no puede actuar como otro');
select pg_temp.request_as('00000000-0000-4000-8000-000000000002', null);
select throws_ok($$select public.impersonation_start('00000000-0000-4000-8000-000000000004')$$, 'P0001', 'forbidden',
  'gerente: tampoco (solo Sistemas)');

-- CA-6 · Destinos no válidos.
select pg_temp.request_as('00000000-0000-4000-8000-000000000001', null);
select throws_ok($$select public.impersonation_start('00000000-0000-4000-8000-000000000001')$$, 'P0001', 'invalid_input',
  'no puede actuar como sí mismo');
select throws_ok($$select public.impersonation_start('00000000-0000-4000-8000-0000000000d1')$$, 'P0001', 'invalid_input',
  'no puede actuar como otro admin');
select throws_ok($$select public.impersonation_start('00000000-0000-4000-8000-0000000000d2')$$, 'P0001', 'invalid_input',
  'no puede actuar como un usuario inactivo');
select throws_ok($$select public.impersonation_start(gen_random_uuid())$$, 'P0001', 'invalid_input',
  'no puede actuar como alguien que no existe');

-- CA-1 · El admin empieza a actuar como el auxiliar de Verdolago.
create temp table s on commit drop as
  select public.impersonation_start('00000000-0000-4000-8000-000000000004') as r;
select is((select r -> 'target' ->> 'full_name' from s), 'Auxiliar Verdolago', 'devuelve a quién suplanta');
select ok((select (r ->> 'expires_at')::timestamptz between now() + interval '29 minutes' and now() + interval '31 minutes' from s),
  'vence en 30 minutos');

select pg_temp.request_as('00000000-0000-4000-8000-000000000001', (select r ->> 'id' from s));
select is(auth.uid(), '00000000-0000-4000-8000-000000000004'::uuid, 'con la cabecera, la base ve al auxiliar');
select is(public.acting_actor(), '00000000-0000-4000-8000-000000000001'::uuid, 'y sabe que el autor real es el admin');
select is(public.app_role(), 'field_assistant'::public.app_role, 'con el rol del auxiliar');
select is(public.app_branch(), 5::smallint, 'y su sucursal');
select throws_ok($$select public.list_prospects('{}')$$, 'P0001', 'forbidden',
  'con sus permisos: el auxiliar no ve el listado de gestión');

-- CA-6 · Sin encadenar.
select throws_ok($$select public.impersonation_start('00000000-0000-4000-8000-000000000006')$$, 'P0001', 'forbidden',
  'mientras actúa no puede actuar como un tercero');

-- CA-2 · Guarda con los permisos del auxiliar y la auditoría guarda al admin.
select is(public.submit_capture(jsonb_build_object(
  'id', '01900000-0000-7000-8000-0000000000d1', 'full_name', 'Cliente Suplantado', 'phone', '73340001',
  'product_id', 1, 'channel_id', 1, 'interest', 'high')) ->> 'result', 'accepted', 'registra como el auxiliar');
select tests.logout();
select is((select created_by from public.prospects where id = '01900000-0000-7000-8000-0000000000d1'),
  '00000000-0000-4000-8000-000000000004'::uuid, 'el cliente queda a nombre del auxiliar');
-- Edición auditada hecha durante la suplantación (las RPC editan como dueño de la tabla con los claims de la
-- petición; acá se imita igual: claims de la suplantación + rol dueño).
select pg_temp.request_as('00000000-0000-4000-8000-000000000001', (select r ->> 'id' from s));
select set_config('role', 'postgres', true);
update public.prospects set full_name = 'Cliente Suplantado Editado' where id = '01900000-0000-7000-8000-0000000000d1';
select tests.logout();
select is((select acting_by from public.audit_log where row_id = '01900000-0000-7000-8000-0000000000d1' order by id desc limit 1),
  '00000000-0000-4000-8000-000000000001'::uuid, 'la auditoría guarda al admin como autor real');

-- CA-4 · La suplantación de un admin no sirve con la sesión de otro (cabecera copiada).
select throws_ok($$select pg_temp.request_as('00000000-0000-4000-8000-0000000000d1', (select r ->> 'id' from s))$$,
  'P0001', 'impersonation_invalid', 'otro admin no puede usar una suplantación ajena');
select throws_ok($$select pg_temp.request_as('00000000-0000-4000-8000-000000000001', 'no-es-un-uuid')$$,
  'P0001', 'impersonation_invalid', 'cabecera con basura: rechazada');

-- CA-5 · Vencida: se rechaza.
select tests.logout();
update public.impersonations set expires_at = now() - interval '1 second' where id = (select (r ->> 'id')::uuid from s);
select throws_ok($$select pg_temp.request_as('00000000-0000-4000-8000-000000000001', (select r ->> 'id' from s))$$,
  'P0001', 'impersonation_invalid', 'vencida: rechazada');

-- CA-3 · Volver: cierra la abierta; empezar otra reemplaza la anterior.
select pg_temp.request_as('00000000-0000-4000-8000-000000000001', null);
create temp table s2 on commit drop as
  select public.impersonation_start('00000000-0000-4000-8000-000000000002') as r;
select tests.logout();
select is((select end_reason from public.impersonations where id = (select (r ->> 'id')::uuid from s)), 'expired',
  'la anterior vencida queda cerrada como vencida');
-- Volver se llama CON la cabecera puesta (así lo hace la app): el autor real sale de act.sub.
select pg_temp.request_as('00000000-0000-4000-8000-000000000001', (select r ->> 'id' from s2));
select public.impersonation_end();
select tests.logout();
select is((select end_reason from public.impersonations where id = (select (r ->> 'id')::uuid from s2)), 'returned',
  'volver a mi cuenta la cierra');
select throws_ok($$select pg_temp.request_as('00000000-0000-4000-8000-000000000001', (select r ->> 'id' from s2))$$,
  'P0001', 'impersonation_invalid', 'cerrada: rechazada');

-- La tabla no se lee directo (solo por RPC).
select pg_temp.request_as('00000000-0000-4000-8000-000000000001', null);
select throws_ok($$select count(*) from public.impersonations$$, '42501', null, 'ni el admin lee la tabla directo');

select * from finish();
rollback;
