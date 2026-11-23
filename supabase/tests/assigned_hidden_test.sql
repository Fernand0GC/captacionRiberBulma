begin;
select plan(30);

-- Spec 021: ocultar asignados en «Clientes asignados» (20261123002100).
-- Personas del seed: 02 gerente, 03 encargado Verdolago (5), 04 auxiliar Verdolago, 05 supervisor Verdolago,
-- 07 encargado Trinidad (7), 09 jefe de ventas (5 y 7), 10 Cobros. Fecha 2025-06-10 para no chocar con otros datos.
-- Clientes asignados a la auxiliar (04) el 10/06:
--   h1 Verdolago, la llama (contactado); a las 18:00 pasa también al supervisor (05)
--   h2 Verdolago, la llama (contactado); sigue a su cargo
--   h3 Verdolago, sin contactar
--   h5 Trinidad, sin contactar (para «todo o nada» de la encargada de Verdolago)
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
  stage, assigned_to)
values
  ('01900000-0000-7000-8000-0000000021a1', 'Ocu Cliente 1', '79210001', '79210001', 5, '00000000-0000-4000-8000-000000000006', '2025-06-09 09:00-04', 'morning', 'recapture', '00000000-0000-4000-8000-000000000005'),
  ('01900000-0000-7000-8000-0000000021a2', 'Ocu Cliente 2', '79210002', '79210002', 5, '00000000-0000-4000-8000-000000000006', '2025-06-09 09:00-04', 'morning', 'followup', '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-0000000021a3', 'Ocu Cliente 3', '79210003', '79210003', 5, '00000000-0000-4000-8000-000000000006', '2025-06-09 09:00-04', 'morning', 'capture', '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-0000000021a5', 'Ocu Cliente 5', '79210005', '79210005', 7, '00000000-0000-4000-8000-000000000008', '2025-06-09 09:00-04', 'morning', 'capture', '00000000-0000-4000-8000-000000000004');

insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at) values
  ('01900000-0000-7000-8000-0000000021a1', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-06-10 09:00-04'),
  ('01900000-0000-7000-8000-0000000021a1', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', '2025-06-10 18:00-04'),
  ('01900000-0000-7000-8000-0000000021a2', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-06-10 09:00-04'),
  ('01900000-0000-7000-8000-0000000021a3', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-06-10 09:00-04'),
  ('01900000-0000-7000-8000-0000000021a5', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', '2025-06-10 09:00-04');

insert into public.stage_events (prospect_id, from_stage, to_stage, actor_id, created_at) values
  ('01900000-0000-7000-8000-0000000021a1', 'capture', 'recapture', '00000000-0000-4000-8000-000000000004', '2025-06-10 10:00-04'),
  ('01900000-0000-7000-8000-0000000021a2', 'capture', 'followup', '00000000-0000-4000-8000-000000000004', '2025-06-10 10:00-04');

insert into public.followups (id, prospect_id, contacted_at, result, method, effective, note, visit_at, callback_at, actor_id) values
  ('01900000-0000-7000-8000-0000000021b1', '01900000-0000-7000-8000-0000000021a1', '2025-06-10 10:00-04', 'no_answer', 'call', false, null, null, null, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-0000000021b2', '01900000-0000-7000-8000-0000000021a2', '2025-06-10 10:00-04', 'looking_product', 'call', true, null, null, null, '00000000-0000-4000-8000-000000000004');

create temp table r (k text primary key, v jsonb);
grant all on r to authenticated;
create function pg_temp.row_of(p_key text, p_name text) returns jsonb language sql as $$
  select x from r, jsonb_array_elements(r.v -> 'rows') x where r.k = p_key and x ->> 'full_name' = p_name
$$;
grant execute on function pg_temp.row_of(text, text) to authenticated;
create function pg_temp.reload() returns void language sql as $$
  delete from r where k in ('list', 'act');
  insert into r values ('list', public.list_agent_assigned('{"from":"2025-06-10","to":"2025-06-10","actor_id":"00000000-0000-4000-8000-000000000004"}'));
  insert into r values ('act', public.agent_activity('{"from":"2025-06-10","to":"2025-06-10"}'));
$$;
grant execute on function pg_temp.reload() to authenticated;
create function pg_temp.act(p_field text) returns text language sql as $$
  select x ->> p_field from r, jsonb_array_elements(r.v -> 'rows') x
  where r.k = 'act' and x ->> 'actor_id' = '00000000-0000-4000-8000-000000000004'
$$;
grant execute on function pg_temp.act(text) to authenticated;

-- Tabla protegida ---------------------------------------------------------------------------------------------------
select has_table('public', 'assigned_hidden', 'existe la tabla de ocultos');
select ok((select relrowsecurity from pg_class where oid = 'public.assigned_hidden'::regclass), 'RLS activo en assigned_hidden');
select tests.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$ select * from public.assigned_hidden $$, '42501', null, 'ni el gerente lee la tabla directo (solo por RPC)');

-- Antes de ocultar ---------------------------------------------------------------------------------------------------
select pg_temp.reload();
insert into r select 'act0', v from r where k = 'act';
select is((select (v ->> 'contacted_visible')::int from r where k = 'list'), 2, 'aviso: 2 contactados sin ocultar');
select is((select (v ->> 'hidden_total')::int from r where k = 'list'), 0, 'sin ocultos al empezar');
select is(pg_temp.row_of('list', 'Ocu Cliente 2') ->> 'hidden', 'false', 'cada fila trae hidden');
select is(pg_temp.row_of('list', 'Ocu Cliente 2') ->> 'phone_raw' || '/' || (pg_temp.row_of('list', 'Ocu Cliente 2') ->> 'phone_norm')
          || '/' || (pg_temp.row_of('list', 'Ocu Cliente 2') ->> 'branch_id'), '79210002/79210002/5',
  'conserva celular y sucursal de la 020');

-- Sin permiso ------------------------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.set_assigned_hidden('00000000-0000-4000-8000-000000000004', array['01900000-0000-7000-8000-0000000021a2']::uuid[], true) $$,
  'P0001', 'forbidden', 'la auxiliar no puede ocultar');
select tests.login_as('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.hide_assigned_contacted('{"from":"2025-06-10","actor_id":"00000000-0000-4000-8000-000000000004"}') $$,
  'P0001', 'forbidden', 'el supervisor no puede ocultar');
select tests.login_as('00000000-0000-4000-8000-000000000010');
select throws_ok($$ select public.set_assigned_hidden('00000000-0000-4000-8000-000000000004', array['01900000-0000-7000-8000-0000000021a2']::uuid[], true) $$,
  'P0001', 'forbidden', 'Cobros no puede ocultar');
select tests.login_as('00000000-0000-4000-8000-000000000007');
select throws_ok($$ select public.set_assigned_hidden('00000000-0000-4000-8000-000000000004', array['01900000-0000-7000-8000-0000000021a3']::uuid[], true) $$,
  'P0001', 'forbidden', 'la encargada de Trinidad no oculta clientes de Verdolago');
select throws_ok($$ select public.hide_assigned_contacted('{"from":"2025-06-10","branch_id":5,"actor_id":"00000000-0000-4000-8000-000000000004"}') $$,
  'P0001', 'forbidden', 'ni con el aviso pidiendo la sucursal 5');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.set_assigned_hidden('00000000-0000-4000-8000-000000000004',
    array['01900000-0000-7000-8000-0000000021a3', '01900000-0000-7000-8000-0000000021a5']::uuid[], true) $$,
  'P0001', 'forbidden', 'la encargada de Verdolago con un cliente de Trinidad en la lista → forbidden');
select throws_ok($$ select public.set_assigned_hidden('00000000-0000-4000-8000-000000000004', array[]::uuid[], true) $$,
  'P0001', 'invalid_input', 'lista vacía → invalid_input');

-- La encargada acepta el aviso: oculta los contactados ---------------------------------------------------------------
select is(public.hide_assigned_contacted('{"from":"2025-06-10","to":"2025-06-10","actor_id":"00000000-0000-4000-8000-000000000004"}'),
  2, 'la encargada oculta los 2 contactados');
select is(public.hide_assigned_contacted('{"from":"2025-06-10","to":"2025-06-10","actor_id":"00000000-0000-4000-8000-000000000004"}'),
  0, 'repetir no da error ni oculta de nuevo');

select tests.login_as('00000000-0000-4000-8000-000000000002');
select pg_temp.reload();
select is((select (v ->> 'hidden_total')::int || '/' || (v ->> 'contacted_visible') from r where k = 'list'), '2/0',
  '2 ocultos y ningún contactado visible');
select is((select (v ->> 'total')::int from r where k = 'list'), 4, 'la lista sigue trayendo todos (también ocultos)');
select is((select count(*)::int from r, jsonb_array_elements(r.v -> 'rows') x
           where r.k = 'list' and (x ->> 'hidden')::boolean <> ((x ->> 'contacts')::int > 0)), 0,
  'lo oculto coincide exactamente con los contactados de la lista');
select is(pg_temp.row_of('list', 'Ocu Cliente 3') ->> 'hidden', 'false', 'el sin contactar no se ocultó');
select is(pg_temp.act('assigned') || '/' || pg_temp.act('assigned_contacted'),
  (select x ->> 'assigned' || '/' || (x ->> 'assigned_contacted') from r, jsonb_array_elements(r.v -> 'rows') x
   where r.k = 'act0' and x ->> 'actor_id' = '00000000-0000-4000-8000-000000000004'),
  'Actividad: Asignados y Contactados no cambian');
select tests.logout();
select is((select hidden_by from public.assigned_hidden where prospect_id = '01900000-0000-7000-8000-0000000021a2'),
  '00000000-0000-4000-8000-000000000003'::uuid, 'la marca guarda quién ocultó');

-- La marca es por persona: en la lista del supervisor h1 no está oculto ------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000002');
insert into r values ('sup', public.list_agent_assigned('{"from":"2025-06-10","to":"2025-06-10","actor_id":"00000000-0000-4000-8000-000000000005"}'));
select is(pg_temp.row_of('sup', 'Ocu Cliente 1') ->> 'hidden', 'false', 'ocultar en la auxiliar no oculta en el supervisor');

-- Mis contactos de la auxiliar no cambia ------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000004');
select ok(exists (select 1 from jsonb_array_elements(public.my_contacts()) x where x ->> 'full_name' = 'Ocu Cliente 2'),
  'la auxiliar sigue viendo al oculto en Mis contactos');

-- El jefe de ventas oculta a mano un sin contactar; el gerente muestra uno ----------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000009');
select is(public.set_assigned_hidden('00000000-0000-4000-8000-000000000004', array['01900000-0000-7000-8000-0000000021a3']::uuid[], true),
  1, 'el jefe de ventas oculta a mano un sin contactar');
select is(public.set_assigned_hidden('00000000-0000-4000-8000-000000000004', array['01900000-0000-7000-8000-0000000021a3']::uuid[], true),
  0, 'ocultar lo ya oculto no da error');
select tests.login_as('00000000-0000-4000-8000-000000000002');
select is(public.set_assigned_hidden('00000000-0000-4000-8000-000000000004', array['01900000-0000-7000-8000-0000000021a1']::uuid[], false),
  1, 'el gerente vuelve a mostrar h1');
select is(public.set_assigned_hidden('00000000-0000-4000-8000-000000000004', array['01900000-0000-7000-8000-0000000021a1']::uuid[], false),
  0, 'mostrar lo ya visible no da error');
select pg_temp.reload();
select is((select (v ->> 'hidden_total')::int || '/' || (v ->> 'contacted_visible') from r where k = 'list'), '2/1',
  'quedan 2 ocultos (h2, h3) y 1 contactado visible (h1)');
select is(pg_temp.act('assigned') || '/' || pg_temp.act('assigned_contacted'),
  (select x ->> 'assigned' || '/' || (x ->> 'assigned_contacted') from r, jsonb_array_elements(r.v -> 'rows') x
   where r.k = 'act0' and x ->> 'actor_id' = '00000000-0000-4000-8000-000000000004'),
  'Actividad sigue igual después de ocultar y mostrar');

select * from finish();
rollback;
