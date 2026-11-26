begin;
select plan(46);

-- Spec 029 · Permisos por persona (replan_past, referrals) para la encargada.
-- Usuarios del seed: 1 admin, 2 gerente, 3 enc.verdolago (5), 4 aux.verdolago (5), 5 sup.verdolago (5),
-- 6 vol.verdolago (5), 7 enc.trinidad (7), 9 jefe.ventas (5 y 7), 10 cobros.verdolago (5).
-- De este test: e1 = encargada de la sucursal 1, que el jefe no gestiona.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated',
   'enc.perm1@captacion.riberbulma.local', now(), now());
insert into public.profiles (id, username, full_name, role, branch_id, contract_type) values
  ('00000000-0000-4000-8000-0000000000e1', 'enc.perm1', 'Encargada Sucursal Uno', 'branch_manager', 1, 'permanent');

create temp table k as
select (now() at time zone 'America/La_Paz')::date - 1 as ayer;
grant select on k to authenticated;

-- Simula una petición de PostgREST (como impersonation_audit_test): claims, cabecera y pre-request.
create function pg_temp.request_as(uid uuid, act_header text) returns void language plpgsql as $$
begin
  perform tests.login_as(uid);
  perform set_config('request.method', 'POST', true);
  perform set_config('request.path', '/rpc/permission_set', true);
  perform set_config('request.headers',
    case when act_header is null then '{}' else json_build_object('x-actuar-como', act_header)::text end, true);
  perform public.apply_impersonation();
end $$;

create function pg_temp.audits(p_profile uuid) returns int language sql as $$
  select count(*)::int from public.audit_log where table_name = 'profile_permissions' and row_id = p_profile and at >= now()
$$;

-- Sin nada otorgado, nadie tiene permisos (criterio 16) ------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(public.has_permission('replan_past'), false, 'recién desplegado: la encargada no tiene replan_past');
select is(public.has_permission('referrals'), false, 'recién desplegado: la encargada no tiene referrals');

-- 1 · El gerente otorga -----------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000002');
select is(public.permission_set('00000000-0000-4000-8000-000000000003', 'replan_past', true) ->> 'changed', 'true',
  'gerente otorga replan_past a la encargada de Verdolago');
select tests.logout();
select is((select granted_by from public.profile_permissions
           where profile_id = '00000000-0000-4000-8000-000000000003' and permission = 'replan_past'),
  '00000000-0000-4000-8000-000000000002'::uuid, 'queda quién lo otorgó');
select is(pg_temp.audits('00000000-0000-4000-8000-000000000003'), 1, 'queda en la auditoría');
select is((select actor_id from public.audit_log where table_name = 'profile_permissions'
           and row_id = '00000000-0000-4000-8000-000000000003' and at >= now()),
  '00000000-0000-4000-8000-000000000002'::uuid, 'la auditoría nombra al gerente');

-- 4 · Otorgar dos veces no duplica
select tests.login_as('00000000-0000-4000-8000-000000000002');
select is(public.permission_set('00000000-0000-4000-8000-000000000003', 'replan_past', true) ->> 'changed', 'false',
  'otorgar de nuevo: sin cambios y sin error');
select tests.logout();
select is((select count(*)::int from public.profile_permissions where profile_id = '00000000-0000-4000-8000-000000000003'), 1,
  'no hay fila duplicada');
select is(pg_temp.audits('00000000-0000-4000-8000-000000000003'), 1, 'sin cambio no se audita');

-- 2 · El jefe de ventas otorga en sus sucursales; 5 · no en las ajenas ------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000009');
select is(public.permission_set('00000000-0000-4000-8000-000000000007', 'referrals', true) ->> 'changed', 'true',
  'jefe otorga referrals a la encargada de Trinidad (su sucursal)');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-0000000000e1', 'referrals', true) $$,
  'P0001', 'forbidden', 'jefe NO otorga a la encargada de una sucursal ajena');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-0000000000e1', 'referrals', false) $$,
  'P0001', 'forbidden', 'jefe NO quita en una sucursal ajena');

-- 6 · Roles sin acceso ----------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-000000000007', 'referrals', true) $$,
  'P0001', 'forbidden', 'encargada NO otorga');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-000000000003', 'referrals', true) $$,
  'P0001', 'forbidden', 'encargada NO se otorga a sí misma');
select tests.login_as('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-000000000003', 'referrals', true) $$,
  'P0001', 'forbidden', 'supervisor NO otorga');
select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-000000000003', 'referrals', true) $$,
  'P0001', 'forbidden', 'auxiliar NO otorga');
select tests.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-000000000003', 'referrals', true) $$,
  'P0001', 'forbidden', 'volantera NO otorga');
select tests.login_as('00000000-0000-4000-8000-000000000010');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-000000000003', 'referrals', true) $$,
  'P0001', 'forbidden', 'Cobros NO otorga');
select throws_ok($$ insert into public.profile_permissions (profile_id, permission)
                    values ('00000000-0000-4000-8000-000000000010', 'referrals') $$,
  '42501', null, 'nadie escribe la tabla directo');

-- 7 · Solo a encargados, y solo permisos conocidos ------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-000000000005', 'referrals', true) $$,
  'P0001', 'invalid_input', 'no se otorga a un supervisor');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-000000000009', 'referrals', true) $$,
  'P0001', 'invalid_input', 'no se otorga a un jefe de ventas');
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-000000000003', 'ver_todo', true) $$,
  'P0001', 'invalid_input', 'permiso desconocido rechazado');

-- 8 · Sistemas actuando como otra persona: sin restricciones, con el admin real en la auditoría -----------------
select pg_temp.request_as('00000000-0000-4000-8000-000000000001', null);
create temp table s on commit drop as select public.impersonation_start('00000000-0000-4000-8000-000000000004') as r;
select pg_temp.request_as('00000000-0000-4000-8000-000000000001', (select r ->> 'id' from s));
select is(auth.uid(), '00000000-0000-4000-8000-000000000004'::uuid, 'actuando: la base ve al auxiliar');
select is(public.permission_set('00000000-0000-4000-8000-0000000000e1', 'referrals', true) ->> 'changed', 'true',
  'actuando como el auxiliar, Sistemas otorga igual');
-- La pre-request deja la persona actuada en request.jwt.claim.sub (auth.uid() lo lee primero): se limpia para
-- que los login_as de abajo valgan.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.headers', '{}', true);
select tests.logout();
select is((select acting_by from public.audit_log where table_name = 'profile_permissions'
           and row_id = '00000000-0000-4000-8000-0000000000e1' and at >= now()),
  '00000000-0000-4000-8000-000000000001'::uuid, 'la auditoría guarda al admin real');
-- Una marca de suplantación sin suplantación abierta no sirve (token armado a mano).
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000003', 'role', 'authenticated',
  'act', json_build_object('sub', '00000000-0000-4000-8000-000000000001'))::text, true);
select throws_ok($$ select public.permission_set('00000000-0000-4000-8000-000000000007', 'replan_past', true) $$,
  'P0001', 'forbidden', 'marca de suplantación sin suplantación vigente: rechazado');

-- 9-11 · Efecto de replan_past ---------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(public.has_permission('replan_past'), true, 'la encargada ahora tiene replan_past');
select is(public.org_can_replan(5::smallint, (select ayer from k)), true, 'con replan_past: su sucursal, ayer sí');
select is(public.org_can_replan(7::smallint, (select ayer from k)), false, 'con replan_past: otra sucursal, NO');
select tests.login_as('00000000-0000-4000-8000-000000000007');
select is(public.org_can_replan(7::smallint, (select ayer from k)), false, 'otra encargada sin replan_past: ayer NO');

-- 12-14 · Efecto de referrals -------------------------------------------------------------------------------------
select is(public.can_see_referrals(7::smallint), true, 'con referrals: ve referidos de su sucursal');
select is(public.can_see_referrals(5::smallint), false, 'con referrals: NO ve otra sucursal');
select is(public.referral_branches(null), array[7]::smallint[], 'con referrals: «todas» = solo la suya');
select throws_ok($$ select public.referral_branches(5::smallint) $$, 'P0001', 'forbidden', 'con referrals: otra sucursal prohibida');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(public.can_see_referrals(5::smallint), false, 'sin referrals: sigue sin ver referidos');

-- Cada uno lee solo sus permisos
select tests.login_as('00000000-0000-4000-8000-000000000007');
select is((select array_agg(permission) from public.profile_permissions), array['referrals'],
  'la encargada lee solo los suyos');

-- Lista para la pantalla «Permisos» ------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000009');
select ok(public.permissions_list(null) @> '[{"id":"00000000-0000-4000-8000-000000000007","permissions":["referrals"]}]',
  'jefe: ve a la encargada de Trinidad con su permiso');
select ok(not (public.permissions_list(null) @> '[{"id":"00000000-0000-4000-8000-0000000000e1"}]'),
  'jefe: no ve encargadas de sucursales ajenas');
select tests.login_as('00000000-0000-4000-8000-000000000002');
select ok(public.permissions_list(null) @> '[{"id":"00000000-0000-4000-8000-0000000000e1"}]', 'gerente: ve a todas');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.permissions_list(null) $$, 'P0001', 'forbidden', 'encargada: no ve la lista');

-- 3 · Quitar -----------------------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000002');
select is(public.permission_set('00000000-0000-4000-8000-000000000003', 'replan_past', false) ->> 'changed', 'true',
  'gerente quita replan_past');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(public.org_can_replan(5::smallint, (select ayer from k)), false, 'al quitarlo: ayer NO, de inmediato');
select tests.logout();
select is(pg_temp.audits('00000000-0000-4000-8000-000000000003'), 2, 'quitar también queda en la auditoría');

-- 15 · Cambio de rol: los permisos guardados dejan de valer ------------------------------------------------------
update public.profiles set role = 'field_assistant' where id = '00000000-0000-4000-8000-000000000007';
select tests.login_as('00000000-0000-4000-8000-000000000007');
select is(public.has_permission('referrals'), false, 'ya no es encargada: referrals sin efecto');
select is(public.can_see_referrals(7::smallint), false, 'ya no es encargada: no ve referidos');

-- 18 · Jefe y gerencia siguen igual sin permisos marcados
select tests.login_as('00000000-0000-4000-8000-000000000009');
select is(public.can_see_referrals(5::smallint), true, 'jefe: sigue viendo referidos sin permisos');

select * from finish();
rollback;
