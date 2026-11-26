begin;
select plan(27);

-- Spec 029 · Caracterización: fija lo que hacen HOY las funciones que la spec va a tocar (org_can_replan,
-- can_see_referrals, referral_branches, branch_lead), antes de cambiarlas. Sin permisos otorgados, todo esto
-- debe seguir igual después (criterios 9, 12, 16 y 18).
-- Usuarios del seed: 1 admin, 2 gerente, 3 enc.verdolago (5), 4 aux.verdolago (5), 5 sup.verdolago (5),
-- 7 enc.trinidad (7), 9 jefe.ventas (5 y 7), 10 cobros.verdolago (5).

create temp table k as
select (now() at time zone 'America/La_Paz')::date - 1 as ayer,
       (now() at time zone 'America/La_Paz')::date as hoy,
       (now() at time zone 'America/La_Paz')::date + 1 as manana;
grant select on k to authenticated;

-- Planificación: encargada ----------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(public.org_can_replan(5::smallint, (select ayer from k)), false, 'encargada: su sucursal, ayer NO');
select is(public.org_can_replan(5::smallint, (select hoy from k)), true, 'encargada: su sucursal, hoy sí');
select is(public.org_can_replan(5::smallint, (select manana from k)), true, 'encargada: su sucursal, mañana sí');
select is(public.org_can_replan(7::smallint, (select hoy from k)), false, 'encargada: otra sucursal NO');

-- Planificación: supervisor y auxiliar
select tests.login_as('00000000-0000-4000-8000-000000000005');
select is(public.org_can_replan(5::smallint, (select ayer from k)), false, 'supervisor: ayer NO');
select is(public.org_can_replan(5::smallint, (select hoy from k)), true, 'supervisor: hoy sí');
select tests.login_as('00000000-0000-4000-8000-000000000004');
select is(public.org_can_replan(5::smallint, (select hoy from k)), false, 'auxiliar: NO planifica');

-- Planificación: jefe de ventas, gerente y Sistemas
select tests.login_as('00000000-0000-4000-8000-000000000009');
select is(public.org_can_replan(5::smallint, (select ayer from k)), true, 'jefe: su sucursal, ayer sí');
select is(public.org_can_replan(7::smallint, (select ayer from k)), true, 'jefe: su otra sucursal, ayer sí');
select is(public.org_can_replan(1::smallint, (select hoy from k)), false, 'jefe: sucursal ajena NO');
select tests.login_as('00000000-0000-4000-8000-000000000002');
select is(public.org_can_replan(1::smallint, (select ayer from k)), true, 'gerente: cualquier sucursal, ayer sí');
select tests.login_as('00000000-0000-4000-8000-000000000001');
select is(public.org_can_replan(1::smallint, (select ayer from k)), true, 'Sistemas: cualquier sucursal, ayer sí');

-- Referidos ---------------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(public.can_see_referrals(5::smallint), false, 'encargada: NO ve referidos de su sucursal');
select throws_ok($$ select public.referral_branches(null) $$, 'P0001', 'forbidden', 'encargada: «todas» prohibido');
select throws_ok($$ select public.referral_branches(5::smallint) $$, 'P0001', 'forbidden', 'encargada: su sucursal prohibido');
select tests.login_as('00000000-0000-4000-8000-000000000005');
select is(public.can_see_referrals(5::smallint), false, 'supervisor: NO ve referidos');
select tests.login_as('00000000-0000-4000-8000-000000000010');
select is(public.can_see_referrals(5::smallint), false, 'Cobros: NO ve referidos');

select tests.login_as('00000000-0000-4000-8000-000000000009');
select is(public.can_see_referrals(5::smallint), true, 'jefe: su sucursal sí');
select is(public.can_see_referrals(1::smallint), false, 'jefe: sucursal ajena NO');
select is(public.referral_branches(null), array[5, 7]::smallint[], 'jefe: «todas» = sus sucursales');
select throws_ok($$ select public.referral_branches(1::smallint) $$, 'P0001', 'forbidden', 'jefe: sucursal ajena prohibida');

select tests.login_as('00000000-0000-4000-8000-000000000002');
select is(public.can_see_referrals(1::smallint), true, 'gerente: cualquier sucursal');
select is(public.referral_branches(null), (select array_agg(id order by id) from public.branches), 'gerente: «todas» = todas');
select tests.login_as('00000000-0000-4000-8000-000000000001');
select is(public.can_see_referrals(1::smallint), true, 'Sistemas: cualquier sucursal');

-- Gerente a cargo de la planificación: siempre un jefe de ventas, nunca la encargada ------------------
select tests.logout();
select is((select role::text from public.profiles where id = public.branch_lead(5::smallint)), 'sales_lead',
  'el gerente a cargo de Verdolago es un jefe de ventas');
select isnt(public.branch_lead(5::smallint), '00000000-0000-4000-8000-000000000003'::uuid,
  'la encargada no figura como gerente a cargo');
select is(public.branch_lead(1::smallint), null, 'sucursal sin jefe: sin gerente a cargo');

select * from finish();
rollback;
