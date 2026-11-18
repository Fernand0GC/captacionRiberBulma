begin;
select plan(30);

-- Personas del seed: 03 encargado Verdolago, 04 auxiliar Verdolago, 05 supervisor Verdolago, 06 volantera Verdolago,
-- 07 encargado Trinidad, 09 jefe de ventas (Verdolago y Trinidad), 02 gerente.
-- Clientes (2025, para no chocar con datos de demo): a, b, c en Verdolago (5); d en Trinidad (7); e anulado en Verdolago.
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
  stage, assigned_to, status, void_reason, voided_by, voided_at)
values
  ('01900000-0000-7000-8000-0000000006a1', 'Act Cliente A', '79120001', '79120001', 5, '00000000-0000-4000-8000-000000000006', '2025-04-01 09:00-04', 'morning', 'followup', '00000000-0000-4000-8000-000000000004', 'active', null, null, null),
  ('01900000-0000-7000-8000-0000000006a2', 'Act Cliente B', '79120002', '79120002', 5, '00000000-0000-4000-8000-000000000006', '2025-04-01 09:00-04', 'morning', 'followup', '00000000-0000-4000-8000-000000000004', 'active', null, null, null),
  ('01900000-0000-7000-8000-0000000006a3', 'Act Cliente C', '79120003', '79120003', 5, '00000000-0000-4000-8000-000000000006', '2025-04-01 09:00-04', 'morning', 'followup', null, 'active', null, null, null),
  ('01900000-0000-7000-8000-0000000006a4', 'Act Cliente D', '79120004', '79120004', 7, '00000000-0000-4000-8000-000000000008', '2025-04-01 09:00-04', 'morning', 'followup', null, 'active', null, null, null),
  ('01900000-0000-7000-8000-0000000006a5', 'Act Cliente E', '79120005', '79120005', 5, '00000000-0000-4000-8000-000000000006', '2025-04-01 09:00-04', 'morning', 'capture', null, 'voided', 'prueba', '00000000-0000-4000-8000-000000000001', now());

insert into public.followups (id, prospect_id, contacted_at, result, method, effective, note, visit_at, callback_at, actor_id) values
  -- Auxiliar, 10/04 (hora La Paz)
  ('01900000-0000-7000-8000-0000000006b1', '01900000-0000-7000-8000-0000000006a1', '2025-04-10 10:00-04', 'no_answer', 'whatsapp_call', false, null, null, null, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-0000000006b2', '01900000-0000-7000-8000-0000000006a1', '2025-04-10 11:00-04', 'visit_store', 'call', true, 'pasa el sábado', '2025-04-12 10:00-04', null, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-0000000006b3', '01900000-0000-7000-8000-0000000006a2', '2025-04-10 12:00-04', 'sold', 'message', true, 'compró', null, null, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-0000000006b4', '01900000-0000-7000-8000-0000000006a2', '2025-04-10 23:50-04', 'looking_product', 'store', true, null, null, null, '00000000-0000-4000-8000-000000000004'),
  -- Fuera del día (11/04 00:10 La Paz), en otra sucursal y en un anulado
  ('01900000-0000-7000-8000-0000000006b5', '01900000-0000-7000-8000-0000000006a1', '2025-04-11 00:10-04', 'no_answer', 'whatsapp_call', false, null, null, null, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-0000000006b6', '01900000-0000-7000-8000-0000000006a4', '2025-04-10 15:00-04', 'looking_product', 'message', true, null, null, null, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-0000000006b7', '01900000-0000-7000-8000-0000000006a5', '2025-04-10 15:00-04', 'looking_product', 'message', true, null, null, null, '00000000-0000-4000-8000-000000000004'),
  -- Encargado contacta un cliente
  ('01900000-0000-7000-8000-0000000006b8', '01900000-0000-7000-8000-0000000006a3', '2025-04-10 16:00-04', 'call_later', 'whatsapp_call', true, null, null, '2025-04-15 10:00-04', '00000000-0000-4000-8000-000000000003');

-- El cliente B pasa al supervisor después: los contactos siguen contando para la auxiliar.
update public.prospects set assigned_to = '00000000-0000-4000-8000-000000000005' where id = '01900000-0000-7000-8000-0000000006a2';

create temp table r (k text primary key, v jsonb);
grant all on r to authenticated;
create function pg_temp.row_of(k text, actor uuid) returns jsonb language sql as $$
  select x from r, jsonb_array_elements(r.v -> 'rows') x where r.k = $1 and x ->> 'actor_id' = $2::text
$$;
grant execute on function pg_temp.row_of(text, uuid) to authenticated;

select tests.login_as('00000000-0000-4000-8000-000000000003');
insert into r values ('v', public.agent_activity('{"from":"2025-04-10","to":"2025-04-10"}'));

select is((pg_temp.row_of('v', '00000000-0000-4000-8000-000000000004') ->> 'calls')::int, 2, 'llamadas: WhatsApp + telefónica antigua');
select is((pg_temp.row_of('v', '00000000-0000-4000-8000-000000000004') ->> 'messages')::int, 1, 'mensajes (sin otra sucursal ni anulados)');
select is((pg_temp.row_of('v', '00000000-0000-4000-8000-000000000004') ->> 'store')::int, 1, 'en tienda (23:50 cuenta ese día)');
select is((pg_temp.row_of('v', '00000000-0000-4000-8000-000000000004') ->> 'effective')::int, 3, 'efectivos');
select is((pg_temp.row_of('v', '00000000-0000-4000-8000-000000000004') ->> 'no_answer')::int, 1, 'no contestó (00:10 del día siguiente no cuenta)');
select is((pg_temp.row_of('v', '00000000-0000-4000-8000-000000000004') ->> 'visits')::int, 1, 'visitas pactadas');
select is((pg_temp.row_of('v', '00000000-0000-4000-8000-000000000004') ->> 'sales')::int, 1, 'ventas (aunque el cliente se reasignó)');
select is((pg_temp.row_of('v', '00000000-0000-4000-8000-000000000004') ->> 'clients')::int, 2, 'clientes distintos');
select is((pg_temp.row_of('v', '00000000-0000-4000-8000-000000000004') ->> 'total')::int, 4, 'total');
select ok((select bool_and(((x ->> 'calls')::int + (x ->> 'messages')::int + (x ->> 'store')::int) = (x ->> 'total')::int
             and ((x ->> 'effective')::int + (x ->> 'no_answer')::int) = (x ->> 'total')::int)
           from r, jsonb_array_elements(v -> 'rows') x where k = 'v'), 'invariantes: formas y efectivos suman el total');
select is((pg_temp.row_of('v', '00000000-0000-4000-8000-000000000005') ->> 'total')::int, 0, 'supervisor activo sin contactos: aparece en cero');
select is((pg_temp.row_of('v', '00000000-0000-4000-8000-000000000003') ->> 'total')::int, 1, 'encargado con contactos: aparece');
select is(pg_temp.row_of('v', '00000000-0000-4000-8000-000000000006'), null, 'volantera sin contactos: no aparece');
select is((pg_temp.row_of('v', '00000000-0000-4000-8000-000000000004') ->> 'role'), 'field_assistant', 'trae el rol');

-- Detalle: cada métrica da el mismo número que su celda
select is((public.list_agent_contacts('{"from":"2025-04-10","to":"2025-04-10","actor_id":"00000000-0000-4000-8000-000000000004"}') ->> 'total')::int, 4, 'detalle: todos');
select is((public.list_agent_contacts('{"from":"2025-04-10","to":"2025-04-10","actor_id":"00000000-0000-4000-8000-000000000004","metric":"calls"}') ->> 'total')::int, 2, 'detalle: llamadas');
select is((public.list_agent_contacts('{"from":"2025-04-10","to":"2025-04-10","actor_id":"00000000-0000-4000-8000-000000000004","metric":"messages"}') ->> 'total')::int, 1, 'detalle: mensajes');
select is((public.list_agent_contacts('{"from":"2025-04-10","to":"2025-04-10","actor_id":"00000000-0000-4000-8000-000000000004","metric":"effective"}') ->> 'total')::int, 3, 'detalle: efectivos');
select is((public.list_agent_contacts('{"from":"2025-04-10","to":"2025-04-10","actor_id":"00000000-0000-4000-8000-000000000004","metric":"visits"}') -> 'rows' -> 0 ->> 'note'), 'pasa el sábado', 'detalle: visitas, con su observación');
select is((public.list_agent_contacts('{"from":"2025-04-10","to":"2025-04-10","actor_id":"00000000-0000-4000-8000-000000000004","metric":"sales"}') -> 'rows' -> 0 ->> 'full_name'), 'Act Cliente B', 'detalle: ventas, con el cliente');
select is((public.list_agent_contacts('{"from":"2025-04-10","to":"2025-04-10","actor_id":"00000000-0000-4000-8000-000000000004"}') -> 'rows' -> 0 ->> 'result'), 'looking_product', 'detalle: más reciente primero');
select throws_ok($$ select public.list_agent_contacts('{"from":"2025-04-10","to":"2025-04-10"}') $$, 'P0001', 'invalid_input', 'detalle: sin persona → invalid_input');
select throws_ok($$ select public.list_agent_contacts('{"actor_id":"00000000-0000-4000-8000-000000000004","metric":"x"}') $$, 'P0001', 'invalid_input', 'detalle: métrica inválida');
select throws_ok($$ select public.agent_activity('{"branch_id":7}') $$, 'P0001', 'forbidden', 'encargado: otra sucursal prohibida');

-- Encargado Trinidad: el contacto que la auxiliar de Verdolago hizo sobre un cliente de Trinidad cuenta allá
select tests.login_as('00000000-0000-4000-8000-000000000007');
insert into r values ('t', public.agent_activity('{"from":"2025-04-10","to":"2025-04-10"}'));
select is((pg_temp.row_of('t', '00000000-0000-4000-8000-000000000004') ->> 'total')::int, 1, 'alcance por sucursal del cliente');

-- Gerente: todas las sucursales, sin anulados
select tests.login_as('00000000-0000-4000-8000-000000000002');
insert into r values ('g', public.agent_activity('{"from":"2025-04-10","to":"2025-04-10"}'));
select is((pg_temp.row_of('g', '00000000-0000-4000-8000-000000000004') ->> 'total')::int, 5, 'gerente: todas (sin el anulado)');

-- Jefe de ventas: sin elegir = su primera sucursal (Verdolago)
select tests.login_as('00000000-0000-4000-8000-000000000009');
insert into r values ('j', public.agent_activity('{"from":"2025-04-10","to":"2025-04-10"}'));
select is((pg_temp.row_of('j', '00000000-0000-4000-8000-000000000004') ->> 'total')::int, 4, 'jefe de ventas: su primera sucursal');

-- Persona inactiva: sin contactos no aparece; con contactos aparece marcada
select tests.logout();
update public.profiles set active = false, deactivated_at = now() where id = '00000000-0000-4000-8000-000000000005';
select tests.login_as('00000000-0000-4000-8000-000000000003');
insert into r values ('i1', public.agent_activity('{"from":"2025-04-10","to":"2025-04-10"}'));
select is(pg_temp.row_of('i1', '00000000-0000-4000-8000-000000000005'), null, 'inactivo sin contactos: no aparece');
select tests.logout();
insert into public.followups (id, prospect_id, contacted_at, result, method, effective, actor_id)
values ('01900000-0000-7000-8000-0000000006b9', '01900000-0000-7000-8000-0000000006a2', '2025-04-10 17:00-04', 'looking_product', 'message', true, '00000000-0000-4000-8000-000000000005');
select tests.login_as('00000000-0000-4000-8000-000000000003');
insert into r values ('i2', public.agent_activity('{"from":"2025-04-10","to":"2025-04-10"}'));
select is((pg_temp.row_of('i2', '00000000-0000-4000-8000-000000000005') ->> 'active')::boolean, false, 'inactivo con contactos: aparece marcado');

-- Auxiliar: no es una pantalla suya
select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.agent_activity('{}') $$, 'P0001', 'forbidden', 'auxiliar: prohibido');

select * from finish();
rollback;
