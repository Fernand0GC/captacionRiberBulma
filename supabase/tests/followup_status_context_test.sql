-- Spec 015: list_followup_status con filtro de producto y contexto por fila (producto, detalle del canal, cargo).
begin;
select plan(10);

-- Verdolago (5), fechas de 2025 para no chocar con demo. Dos con producto distinto, una sin producto.
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
  stage, contact_attempts, product_id, channel_detail, status)
values
  ('01900000-0000-7000-8000-0000000015a1', 'Ctx Uno', '79150001', '79150001', 5, '00000000-0000-4000-8000-000000000006',
   '2025-04-10 09:00:00-04', 'morning', 'capture', 0, (select min(id) from public.products), 'Colegio Central', 'active'),
  ('01900000-0000-7000-8000-0000000015a2', 'Ctx Dos', '79150002', '79150002', 5, '00000000-0000-4000-8000-000000000006',
   '2025-04-10 10:00:00-04', 'morning', 'interested', 0, (select max(id) from public.products), null, 'active'),
  ('01900000-0000-7000-8000-0000000015a3', 'Ctx Tres', '79150003', '79150003', 5, '00000000-0000-4000-8000-000000000006',
   '2025-04-10 11:00:00-04', 'morning', 'capture', 0, null, null, 'active');

create temp table r (k text primary key, v jsonb);
grant all on r to authenticated;

select tests.login_as('00000000-0000-4000-8000-000000000003'); -- encargado Verdolago
insert into r values ('all', public.list_followup_status('{"from":"2025-04-10","to":"2025-04-10"}'));
insert into r values ('prod', public.list_followup_status(jsonb_build_object('from', '2025-04-10', 'to', '2025-04-10',
  'product_id', (select min(id) from public.products))));
insert into r values ('empty', public.list_followup_status('{"from":"2025-04-10","to":"2025-04-10","product_id":""}'));

select is((select (v ->> 'total')::int from r where k = 'all'), 3, 'sin product_id: los 3 (como antes)');
select is((select (v ->> 'total')::int from r where k = 'empty'), 3, 'product_id vacío: sin filtro');
select is((select (v ->> 'total')::int from r where k = 'prod'), 1, 'con product_id: solo el de ese producto');
select is((select v -> 'by_tab' from r where k = 'prod'),
  '{"sin_contactar":1,"seguimiento":0,"potencial":0,"venta":0,"sin_interes":0,"todos":1}'::jsonb, 'las pestañas respetan el producto');
select is((select v -> 'rows' -> 0 ->> 'full_name' from r where k = 'prod'), 'Ctx Uno', 'la fila es la del producto');

select is((select x ->> 'product_name' from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Ctx Uno'),
  (select name from public.products order by id limit 1), 'product_name');
select is((select x ->> 'product_name' from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Ctx Tres'),
  null, 'sin producto: null');
select is((select x ->> 'channel_detail' from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Ctx Uno'),
  'Colegio Central', 'channel_detail');
select is((select x ->> 'created_by_role' from r, jsonb_array_elements(v -> 'rows') x where k = 'all' and x ->> 'full_name' = 'Ctx Uno'),
  (select role::text from public.profiles where id = '00000000-0000-4000-8000-000000000006'), 'created_by_role');

select throws_ok($$ select public.list_followup_status('{"from":"2025-04-10","product_id":"abc"}') $$,
  '22P02', null, 'product_id no numérico: error de entrada');

select * from finish();
rollback;
