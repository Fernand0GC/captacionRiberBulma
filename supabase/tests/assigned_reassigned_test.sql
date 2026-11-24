begin;
select plan(30);

-- Spec 024: un reasignado que la persona NO contactó deja de contar en sus «Asignados»; el que sí contactó sigue
-- contando. «A qué proceso pasaron» usa la etapa en que la persona dejó al cliente, no la de hoy. El resumen lo
-- calcula el servidor (antes se sumaban las primeras 500 filas en la pantalla).
-- Personas del seed (Verdolago, sucursal 5): 04 auxiliar («Nayara»), 05 supervisor («Ana»), 03 encargado («Luis»),
-- 02 gerente, 07 encargado de Trinidad. Fechas 2025-06-10 y 2025-06-11 para no chocar con otros datos.
--   q1 Nayara 09:00, no lo contacta; 15:00 pasa a Ana                → no cuenta a Nayara; cuenta a Ana
--   q2 Nayara 09:00, lo contacta 10:00 y lo deja en Seguimiento; 12:00 pasa a Ana, que lo deja en Cliente potencial
--      a las 13:00; 14:00 pasa a Luis, que vende a las 16:00        → cuenta a los tres, cada uno con su etapa
--   q3 Nayara 09:00 → Ana 11:00 → Nayara 12:00, nadie lo contacta    → cuenta a Nayara (sigue a su cargo); no a Ana
--   q4 Nayara 09:00, no lo contacta; 15:00 queda sin responsable     → no cuenta a nadie
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
  stage, assigned_to, sold_at, product_id)
values
  ('01900000-0000-7000-8000-0000000024a1', 'Rsg Cliente 1', '79240001', '79240001', 5, '00000000-0000-4000-8000-000000000006', '2025-06-09 09:00-04', 'morning', 'capture', '00000000-0000-4000-8000-000000000005', null, null),
  ('01900000-0000-7000-8000-0000000024a2', 'Rsg Cliente 2', '79240002', '79240002', 5, '00000000-0000-4000-8000-000000000006', '2025-06-09 09:00-04', 'morning', 'sale', '00000000-0000-4000-8000-000000000003', '2025-06-10 16:00-04', (select min(id) from public.products)),
  ('01900000-0000-7000-8000-0000000024a3', 'Rsg Cliente 3', '79240003', '79240003', 5, '00000000-0000-4000-8000-000000000006', '2025-06-09 09:00-04', 'morning', 'capture', '00000000-0000-4000-8000-000000000004', null, null),
  ('01900000-0000-7000-8000-0000000024a4', 'Rsg Cliente 4', '79240004', '79240004', 5, '00000000-0000-4000-8000-000000000006', '2025-06-09 09:00-04', 'morning', 'capture', null, null, null);

insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at) values
  ('01900000-0000-7000-8000-0000000024a1', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-06-10 09:00-04'),
  ('01900000-0000-7000-8000-0000000024a1', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', '2025-06-10 15:00-04'),
  ('01900000-0000-7000-8000-0000000024a2', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-06-10 09:00-04'),
  ('01900000-0000-7000-8000-0000000024a2', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', '2025-06-10 12:00-04'),
  ('01900000-0000-7000-8000-0000000024a2', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', '2025-06-10 14:00-04'),
  ('01900000-0000-7000-8000-0000000024a3', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-06-10 09:00-04'),
  ('01900000-0000-7000-8000-0000000024a3', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', '2025-06-10 11:00-04'),
  ('01900000-0000-7000-8000-0000000024a3', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-06-10 12:00-04'),
  ('01900000-0000-7000-8000-0000000024a4', null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '2025-06-10 09:00-04'),
  ('01900000-0000-7000-8000-0000000024a4', '00000000-0000-4000-8000-000000000004', null, '00000000-0000-4000-8000-000000000003', '2025-06-10 15:00-04');

insert into public.stage_events (prospect_id, from_stage, to_stage, actor_id, created_at) values
  ('01900000-0000-7000-8000-0000000024a2', 'capture', 'followup', '00000000-0000-4000-8000-000000000004', '2025-06-10 10:00-04'),
  ('01900000-0000-7000-8000-0000000024a2', 'followup', 'interested', '00000000-0000-4000-8000-000000000005', '2025-06-10 13:00-04'),
  ('01900000-0000-7000-8000-0000000024a2', 'interested', 'sale', '00000000-0000-4000-8000-000000000003', '2025-06-10 16:00-04');

insert into public.followups (id, prospect_id, contacted_at, result, method, effective, note, visit_at, callback_at, actor_id) values
  ('01900000-0000-7000-8000-0000000024b1', '01900000-0000-7000-8000-0000000024a2', '2025-06-10 10:00-04', 'looking_product', 'call', true, null, null, null, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-0000000024b2', '01900000-0000-7000-8000-0000000024a2', '2025-06-10 13:00-04', 'looking_product', 'call', true, null, null, null, '00000000-0000-4000-8000-000000000005'),
  ('01900000-0000-7000-8000-0000000024b3', '01900000-0000-7000-8000-0000000024a2', '2025-06-10 16:00-04', 'sold', 'store', true, null, null, null, '00000000-0000-4000-8000-000000000003');

create temp table r (k text primary key, v jsonb);
grant all on r to authenticated;
-- Fila de un cliente en la lista de una persona (k = 'nayara' | 'ana' | 'luis').
create function pg_temp.row_of(p_k text, p_name text) returns jsonb language sql as $$
  select x from r, jsonb_array_elements(r.v -> 'rows') x where r.k = p_k and x ->> 'full_name' = p_name
$$;
-- Fila de una persona en Actividad.
create function pg_temp.act_of(p_actor text) returns jsonb language sql as $$
  select x from r, jsonb_array_elements(r.v -> 'rows') x where r.k = 'act' and x ->> 'actor_id' = p_actor
$$;
grant execute on function pg_temp.row_of(text, text), pg_temp.act_of(text) to authenticated;

select tests.login_as('00000000-0000-4000-8000-000000000002');
insert into r values
  ('act', public.agent_activity('{"from":"2025-06-10","to":"2025-06-10"}')),
  ('nayara', public.list_agent_assigned('{"from":"2025-06-10","to":"2025-06-10","actor_id":"00000000-0000-4000-8000-000000000004"}')),
  ('ana', public.list_agent_assigned('{"from":"2025-06-10","to":"2025-06-10","actor_id":"00000000-0000-4000-8000-000000000005"}')),
  ('luis', public.list_agent_assigned('{"from":"2025-06-10","to":"2025-06-10","actor_id":"00000000-0000-4000-8000-000000000003"}'));

-- Criterio 1: reasignado sin contactar → no cuenta a Nayara y aparece en la nota ------------------------------------
select is((select (v ->> 'total')::int from r where k = 'nayara'), 2, '1: Nayara cuenta 2 (q2 contactado, q3 sigue suyo)');
select is((select (v ->> 'reassigned_uncontacted')::int from r where k = 'nayara'), 2, '1: nota gris de Nayara: 2 (q1 y q4)');
select is((pg_temp.row_of('nayara', 'Rsg Cliente 1') ->> 'counted')::boolean, false, '1: q1 viene en la lista marcado «no cuenta»');
select is((pg_temp.row_of('nayara', 'Rsg Cliente 4') ->> 'counted')::boolean, false, '1: q4 (quedó sin responsable) tampoco cuenta');
select is((select v -> 'summary' ->> 'contacted' from r where k = 'nayara'), '1', '1: contactados de Nayara: 1');

-- Criterio 2: reasignado pero contactado → sigue contando -----------------------------------------------------------
select is((pg_temp.row_of('nayara', 'Rsg Cliente 2') ->> 'counted')::boolean, true, '2: q2 cuenta a Nayara aunque ya no es suyo');

-- Criterio 3: el nuevo responsable lo cuenta ------------------------------------------------------------------------
select is((pg_temp.row_of('ana', 'Rsg Cliente 1') ->> 'counted')::boolean, true, '3: q1 cuenta a Ana (sigue a su cargo)');
select is((select (v ->> 'total')::int from r where k = 'ana'), 2, '3: Ana cuenta 2 (q1 y q2)');
select is((select (v ->> 'reassigned_uncontacted')::int from r where k = 'ana'), 1, '3: nota gris de Ana: 1 (q3 volvió a Nayara sin contactar)');
select is((select (v ->> 'total')::int from r where k = 'luis'), 1, '3: Luis cuenta 1 (q2)');

-- Criterio 4: Actividad igual al modal y sucursal = suma de las personas --------------------------------------------
select is(pg_temp.act_of('00000000-0000-4000-8000-000000000004') ->> 'assigned', '2', '4: Actividad de Nayara = 2, igual que el modal');
select is(pg_temp.act_of('00000000-0000-4000-8000-000000000004') ->> 'assigned_contacted', '1', '4: y 1 contactado');
select is(pg_temp.act_of('00000000-0000-4000-8000-000000000005') ->> 'assigned', '2', '4: Actividad de Ana = 2');
select is(pg_temp.act_of('00000000-0000-4000-8000-000000000003') ->> 'assigned', '1', '4: Actividad de Luis = 1');
select is((select x ->> 'assigned' from r, jsonb_array_elements(r.v -> 'by_branch') x
           where r.k = 'act' and (x ->> 'branch_id')::int = 5), '5', '4: Verdolago = 2 + 2 + 1 (suma de las personas)');

-- Criterio 5: ida y vuelta → cuenta a quien lo tiene hoy -------------------------------------------------------------
select is((pg_temp.row_of('nayara', 'Rsg Cliente 3') ->> 'counted')::boolean, true, '5: q3 volvió a Nayara y le cuenta');
select is(pg_temp.row_of('nayara', 'Rsg Cliente 3') ->> 'outcome', 'none', '5: q3 sin contactar');

-- Criterio 10: etapa en que cada persona dejó al cliente --------------------------------------------------------------
select is(pg_temp.row_of('nayara', 'Rsg Cliente 2') ->> 'stage_left', 'followup', '10: Nayara dejó q2 en Seguimiento');
select is(pg_temp.row_of('nayara', 'Rsg Cliente 2') ->> 'outcome', 'followup', '10: a Nayara no le cuenta la venta de Luis');
select is(pg_temp.row_of('nayara', 'Rsg Cliente 2') ->> 'stage_now', 'sale', '10: la etapa de hoy sigue disponible (Venta)');
select is(pg_temp.row_of('ana', 'Rsg Cliente 2') ->> 'outcome', 'interested', '10: Ana lo dejó en Cliente potencial');
select is(pg_temp.row_of('luis', 'Rsg Cliente 2') ->> 'outcome', 'sale', '10: la venta es de Luis');
select is((select v -> 'summary' -> 'by_outcome' ->> 'sale' from r where k = 'nayara'), '0', '10: resumen de Nayara sin ventas');
select is((select v -> 'summary' -> 'by_outcome' ->> 'followup' from r where k = 'nayara'), '1', '10: resumen de Nayara: 1 en Seguimiento');
select is((select v -> 'summary' -> 'by_origin' -> 'capture' ->> 'n' from r where k = 'nayara'), '2', '10: de dónde vienen: 2 de Captación (solo los que cuentan)');

-- Límite de 500 filas: el resumen cuenta todo ------------------------------------------------------------------------
reset role;
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift, stage, assigned_to)
select ('01900000-0000-7000-8000-' || lpad(to_hex(4096 + g), 12, '0'))::uuid, 'Rsg Masivo ' || g, '7925' || lpad(g::text, 4, '0'),
       '7925' || lpad(g::text, 4, '0'), 5, '00000000-0000-4000-8000-000000000006', '2025-06-10 09:00-04', 'morning', 'capture',
       '00000000-0000-4000-8000-000000000004'
from generate_series(1, 501) g;
insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at)
select ('01900000-0000-7000-8000-' || lpad(to_hex(4096 + g), 12, '0'))::uuid, null, '00000000-0000-4000-8000-000000000004',
       '00000000-0000-4000-8000-000000000003', '2025-06-11 09:00-04'
from generate_series(1, 501) g;
select tests.login_as('00000000-0000-4000-8000-000000000002');
insert into r values ('big', public.list_agent_assigned('{"from":"2025-06-11","to":"2025-06-11","actor_id":"00000000-0000-4000-8000-000000000004"}'));
select is((select jsonb_array_length(v -> 'rows') from r where k = 'big'), 500, '500: la lista trae como mucho 500 filas');
select is((select (v ->> 'total')::int from r where k = 'big'), 501, '500: el total sigue siendo 501');
select is((select v -> 'summary' -> 'by_origin' -> 'capture' ->> 'n' from r where k = 'big'), '501',
  '500: el resumen cuenta los 501 (no solo las filas que llegan)');

-- Criterio 7: permisos ------------------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.list_agent_assigned('{"from":"2025-06-10","to":"2025-06-10","actor_id":"00000000-0000-4000-8000-000000000004"}') $$,
  'P0001', 'forbidden', '7: una auxiliar no puede ver «Clientes asignados»');
select tests.login_as('00000000-0000-4000-8000-000000000007');
select is((public.list_agent_assigned('{"from":"2025-06-10","to":"2025-06-10","actor_id":"00000000-0000-4000-8000-000000000004"}') ->> 'reassigned_uncontacted')::int,
  0, '7: el encargado de Trinidad no ve los reasignados de Verdolago');

select * from finish();
rollback;
