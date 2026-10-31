begin;
select plan(17);

-- Datos: 2 captaciones en Verdolago (volantera y encargado), 1 en Trinidad, 1 duplicada, 1 anulada.
select tests.login_as('00000000-0000-4000-8000-000000000006');
select public.submit_capture(jsonb_build_object('id','01900000-0000-7000-8000-0000000000c1','full_name','Rosa Verdolago','phone','76000001',
  'channel_id',(select id from public.channels where name = 'Volantes')));
select tests.login_as('00000000-0000-4000-8000-000000000003');
select public.submit_capture('{"id":"01900000-0000-7000-8000-0000000000c2","full_name":"Mario Encargado","phone":"76000002"}');
select tests.login_as('00000000-0000-4000-8000-000000000008');
select public.submit_capture('{"id":"01900000-0000-7000-8000-0000000000c3","full_name":"Tito Trinidad","phone":"76000003"}');
select public.submit_capture('{"id":"01900000-0000-7000-8000-0000000000c4","full_name":"Repetido Trinidad","phone":"76000001"}');
select tests.logout();
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
  status, void_reason, voided_by, voided_at)
values ('01900000-0000-7000-8000-0000000000c5', 'Anulada Verdolago', '76000005', '76000005', 5,
  '00000000-0000-4000-8000-000000000006', now(), 'morning', 'voided', 'prueba', '00000000-0000-4000-8000-000000000001', now());
-- Fechas conocidas (hora de La Paz)
update public.prospects set client_created_at = '2026-10-20 09:15:00-04' where id = '01900000-0000-7000-8000-0000000000c1';
update public.prospects set client_created_at = '2026-10-21 15:40:00-04' where id = '01900000-0000-7000-8000-0000000000c2';
update public.prospects set client_created_at = '2026-10-21 10:00:00-04' where id = '01900000-0000-7000-8000-0000000000c3';
update public.prospects set client_created_at = '2026-10-21 23:30:00-04' where id = '01900000-0000-7000-8000-0000000000c5';

create temp table r as select 1;
grant all on r to authenticated;

-- Encargado Verdolago: solo su sucursal
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is((public.list_prospects('{"from":"2026-10-20","to":"2026-10-21"}') ->> 'total')::int, 2, 'encargado: 2 de su sucursal (sin anuladas ni de otra sucursal)');
select is(public.list_prospects('{"from":"2026-10-20","to":"2026-10-21"}') -> 'rows' -> 0 ->> 'full_name', 'Mario Encargado', 'orden: más reciente primero');
select is(public.list_prospects('{"from":"2026-10-20","to":"2026-10-21"}') -> 'rows' -> 1 ->> 'created_by_name', 'Volantera Verdolago', 'incluye quién lo registró');
select is(public.list_prospects('{"from":"2026-10-20","to":"2026-10-21"}') -> 'rows' -> 1 ->> 'branch_name', 'VERDOLAGO', 'incluye la sucursal');
select is(public.list_prospects('{"from":"2026-10-20","to":"2026-10-21"}') -> 'rows' -> 1 ->> 'channel_name', 'Volantes', 'incluye el canal');
select throws_ok($$ select public.list_prospects('{"branch_id":7,"from":"2026-10-20","to":"2026-10-21"}') $$, 'P0001', 'forbidden', 'encargado no consulta otra sucursal');
select is((public.list_prospects('{"from":"2026-10-21","to":"2026-10-21"}') ->> 'total')::int, 1, 'filtro por día en hora de La Paz');
select is((public.list_prospects('{"from":"2026-10-20","to":"2026-10-21","created_by":"00000000-0000-4000-8000-000000000006"}') ->> 'total')::int, 1, 'filtro por quién registró');
select is((public.list_prospects('{"from":"2026-10-20","to":"2026-10-21","q":"rosa"}') ->> 'total')::int, 1, 'búsqueda por nombre sin mayúsculas');
select is((public.list_prospects('{"from":"2026-10-20","to":"2026-10-21","q":"+591 7600-0002"}') ->> 'total')::int, 1, 'búsqueda por celular con otro formato');
select is(jsonb_array_length(public.list_prospects('{"from":"2026-10-20","to":"2026-10-21"}', 1, 1) -> 'rows'), 1, 'paginación: limit/offset');
select ok((select bool_and((x ->> 'branch_id')::int = 5) from jsonb_array_elements(public.staff_options()) x), 'staff_options del encargado: solo su sucursal');

-- Gerente: todas; puede filtrar sucursal
select tests.login_as('00000000-0000-4000-8000-000000000002');
select is((public.list_prospects('{"from":"2026-10-20","to":"2026-10-21"}') ->> 'total')::int, 3, 'gerente: todas las sucursales');
select is((public.list_prospects('{"branch_id":7,"from":"2026-10-20","to":"2026-10-21"}') ->> 'total')::int, 1, 'gerente filtra por sucursal');
select ok(jsonb_array_length(public.staff_options()) >= 8, 'staff_options del gerente: todos');

-- Campo: prohibido
select tests.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.list_prospects('{}') $$, 'P0001', 'forbidden', 'volantero no lista');
select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.staff_options() $$, 'P0001', 'forbidden', 'auxiliar no ve el personal');

select * from finish();
rollback;
