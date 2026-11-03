begin;
select plan(12);

-- Jefe de ventas con Verdolago (5) y Trinidad (7); no San José (6)
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated',
        'jefe.test@captacion.riberbulma.local', now(), now());
insert into public.profiles (id, username, full_name, role, branch_id, contract_type)
values ('00000000-0000-4000-8000-0000000000a1', 'jefe.test', 'Jefe Prueba', 'sales_lead', null, 'permanent');
insert into public.profile_branches values ('00000000-0000-4000-8000-0000000000a1', 5), ('00000000-0000-4000-8000-0000000000a1', 7);

select throws_ok($$insert into public.profiles (id, username, full_name, role, branch_id, contract_type)
  values (gen_random_uuid(), 'x.sinsucursal', 'Sin Sucursal', 'branch_manager', null, 'permanent')$$,
  '23514', null, 'el encargado sigue necesitando sucursal');

select tests.login_as('00000000-0000-4000-8000-0000000000a1');
select ok(public.is_manager(), 'el jefe es gestor');
select ok(public.manages_branch(5::smallint) and public.manages_branch(7::smallint), 'gestiona sus dos sucursales');
select ok(not public.manages_branch(6::smallint), 'no gestiona San José');
select is(public.scoped_branch(null), 5::smallint, 'sin elegir: la primera de las suyas');
select is(public.scoped_branch(7::smallint), 7::smallint, 'elige otra de las suyas');
select throws_ok($$select public.scoped_branch(6::smallint)$$, 'P0001', 'forbidden', 'sucursal ajena: prohibido');
select throws_ok($$select public.list_prospects('{"branch_id":6}')$$, 'P0001', 'forbidden', 'Captaciones de sucursal ajena: prohibido');
select lives_ok($$select public.dashboard_metrics('{"branch_id":7}')$$, 'Panel de una de sus sucursales');
select ok((select bool_and(s ->> 'branch_id' in ('5', '7')) from jsonb_array_elements(public.staff_options()) s),
  'solo ve al personal de sus sucursales');
select is((select count(*)::int from public.profile_branches), 2, 've solo sus sucursales asignadas');

-- El encargado sigue igual
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$select public.scoped_branch(7::smallint)$$, 'P0001', 'forbidden', 'el encargado no ve otra sucursal');

select * from finish();
rollback;
