begin;
select plan(12);

-- Encargado Verdolago
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(public.app_role(), 'branch_manager'::public.app_role, 'rol del encargado');
select is(public.app_branch(), 5::smallint, 'sucursal del encargado');
select ok(public.app_is_active(), 'encargado activo');
select ok(public.manages_branch(5::smallint) and not public.manages_branch(7::smallint), 'encargado gestiona solo su sucursal');
select tests.logout();
create temp table expected_branch5 as select count(*)::int as n from public.profiles where branch_id = 5;
grant select on expected_branch5 to authenticated;
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is((select count(*) from public.profiles)::int, (select n from expected_branch5),
  'encargado ve exactamente los perfiles de su sucursal');
select ok(not exists (select 1 from public.profiles where branch_id is distinct from 5), 'encargado no ve perfiles de otras sucursales ni globales');

-- Volantero: solo su perfil, sí lee catálogos
select tests.login_as('00000000-0000-4000-8000-000000000006');
select is((select count(*) from public.profiles)::int, 1, 'volantero ve solo su perfil');
select ok((select count(*) from public.channels) > 0, 'volantero activo lee catálogos');
select throws_ok($$ insert into public.channels (name) values ('X') $$, '42501', null, 'volantero no escribe catálogos');

-- Volantero desactivado: pierde catálogos pero ve su perfil
select tests.logout();
update public.profiles set active = false, deactivated_at = now() where id = '00000000-0000-4000-8000-000000000006';
select tests.login_as('00000000-0000-4000-8000-000000000006');
select ok(not public.app_is_active(), 'desactivado: inactivo');
select is((select count(*) from public.channels)::int, 0, 'desactivado no lee catálogos');
select is((select count(*) from public.profiles)::int, 1, 'desactivado sigue viendo su perfil (pantalla Usuario desactivado)');

select * from finish();
rollback;
