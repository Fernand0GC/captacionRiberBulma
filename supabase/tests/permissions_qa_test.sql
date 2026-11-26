begin;
select plan(16);

-- Spec 029 · Correcciones de QA (criterios 20, 21 y 23). Escrito por QA antes de la corrección: debe quedar en verde
-- sin modificar este archivo.
-- Usuarios del seed: 2 gerente, 3 enc.verdolago (5), 7 enc.trinidad (7), 9 jefe.ventas (5 y 7).
-- De este test: f1, f2, f3, f4 = encargadas de la sucursal 1 (el jefe no la gestiona).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', u || '@captacion.riberbulma.local', now(), now()
from (values ('00000000-0000-4000-8000-0000000000f1'::uuid, 'enc.qa1'), ('00000000-0000-4000-8000-0000000000f2'::uuid, 'enc.qa2'),
             ('00000000-0000-4000-8000-0000000000f3'::uuid, 'enc.qa3'), ('00000000-0000-4000-8000-0000000000f4'::uuid, 'enc.qa4')) v(id, u);
insert into public.profiles (id, username, full_name, role, branch_id, contract_type) values
  ('00000000-0000-4000-8000-0000000000f1', 'enc.qa1', 'Encargada QA Uno', 'branch_manager', 1, 'permanent'),
  ('00000000-0000-4000-8000-0000000000f2', 'enc.qa2', 'Encargada QA Dos', 'branch_manager', 1, 'permanent'),
  ('00000000-0000-4000-8000-0000000000f3', 'enc.qa3', 'Encargada QA Tres', 'branch_manager', 1, 'permanent'),
  ('00000000-0000-4000-8000-0000000000f4', 'enc.qa4', 'Encargada QA Cuatro', 'branch_manager', 1, 'permanent');

-- Permisos ya otorgados (se cargan directo como postgres: el test mira qué pasa DESPUÉS de otorgarlos).
insert into public.profile_permissions (profile_id, permission) values
  ('00000000-0000-4000-8000-000000000003', 'referrals'), ('00000000-0000-4000-8000-000000000003', 'replan_past'),
  ('00000000-0000-4000-8000-000000000007', 'referrals'),
  ('00000000-0000-4000-8000-0000000000f1', 'referrals'), ('00000000-0000-4000-8000-0000000000f2', 'referrals');

create function pg_temp.perms(p uuid) returns int language sql as $$
  select count(*)::int from public.profile_permissions where profile_id = p
$$;
create function pg_temp.audits(p uuid) returns int language sql as $$
  select count(*)::int from public.audit_log where table_name = 'profile_permissions' and row_id = p
$$;

-- 23 · Privilegios de la tabla ---------------------------------------------------------------------------------
select ok(not has_table_privilege('anon', 'public.profile_permissions', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
  'anon: ningún privilegio sobre profile_permissions');
select ok(not has_table_privilege('authenticated', 'public.profile_permissions', 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
  'authenticated: no escribe, no trunca, no referencia ni crea triggers');
select ok(has_table_privilege('authenticated', 'public.profile_permissions', 'SELECT'),
  'authenticated: puede leer (la RLS deja solo sus filas)');

-- 20 · Cambio de sucursal, de rol o baja: los permisos se borran solos y queda auditoría -------------------------
create temp table antes as select pg_temp.audits('00000000-0000-4000-8000-000000000003') as n;
update public.profiles set branch_id = 7 where id = '00000000-0000-4000-8000-000000000003';
select is(pg_temp.perms('00000000-0000-4000-8000-000000000003'), 0, 'cambio de sucursal: se borran sus permisos');
select ok(pg_temp.audits('00000000-0000-4000-8000-000000000003') > (select n from antes), 'cambio de sucursal: queda en la auditoría');

update public.profiles set role = 'field_supervisor' where id = '00000000-0000-4000-8000-000000000007';
select is(pg_temp.perms('00000000-0000-4000-8000-000000000007'), 0, 'cambio de rol: se borran sus permisos');
update public.profiles set role = 'branch_manager' where id = '00000000-0000-4000-8000-000000000007';
select is(pg_temp.perms('00000000-0000-4000-8000-000000000007'), 0, 'volver a ser encargada no los revive');

update public.profiles set active = false, deactivated_at = now() where id = '00000000-0000-4000-8000-0000000000f1';
select is(pg_temp.perms('00000000-0000-4000-8000-0000000000f1'), 0, 'baja: se borran sus permisos');
update public.profiles set active = true, deactivated_at = null where id = '00000000-0000-4000-8000-0000000000f1';
select is(pg_temp.perms('00000000-0000-4000-8000-0000000000f1'), 0, 'reactivarla no los revive');

-- Otros cambios del perfil no tocan los permisos
update public.profiles set full_name = 'Encargada QA Dos (editada)' where id = '00000000-0000-4000-8000-0000000000f2';
select is(pg_temp.perms('00000000-0000-4000-8000-0000000000f2'), 1, 'cambiar el nombre no borra permisos');
update public.profiles set role = 'branch_manager', branch_id = 1 where id = '00000000-0000-4000-8000-0000000000f2';
select is(pg_temp.perms('00000000-0000-4000-8000-0000000000f2'), 1, 'guardar el mismo rol y sucursal no borra permisos');

-- 21 · Quitar funciona aunque ya no sea encargada o esté inactiva (filas que quedaron de antes del trigger) -----------
update public.profiles set role = 'field_assistant' where id = '00000000-0000-4000-8000-0000000000f3';
insert into public.profile_permissions (profile_id, permission) values ('00000000-0000-4000-8000-0000000000f3', 'referrals');
update public.profiles set active = false, deactivated_at = now() where id = '00000000-0000-4000-8000-0000000000f4';
insert into public.profile_permissions (profile_id, permission) values ('00000000-0000-4000-8000-0000000000f4', 'referrals');

select tests.login_as('00000000-0000-4000-8000-000000000009');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-0000000000f3', 'referrals', false) $$,
  'P0001', 'forbidden', 'quitar sigue respetando el alcance: el jefe no quita en sucursal ajena');
select tests.login_as('00000000-0000-4000-8000-000000000002');
select is(public.permission_set('00000000-0000-4000-8000-0000000000f3', 'referrals', false) ->> 'changed', 'true',
  'gerente quita a quien ya no es encargada');
select is(public.permission_set('00000000-0000-4000-8000-0000000000f4', 'referrals', false) ->> 'changed', 'true',
  'gerente quita a una encargada inactiva');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-0000000000f3', 'referrals', true) $$,
  'P0001', 'invalid_input', 'otorgar a quien no es encargada sigue rechazado');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-0000000000f4', 'referrals', true) $$,
  'P0001', 'invalid_input', 'otorgar a una inactiva sigue rechazado');

select * from finish();
rollback;
