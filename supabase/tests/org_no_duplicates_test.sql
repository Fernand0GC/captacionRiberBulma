begin;
select plan(9);

-- Spec 011: org_upsert rechaza asignaciones iguales (20261121000100).
-- «Igual» = misma sucursal, día, persona, turno, inicio, fin, canal y subcanal.
-- Usuarios del seed: 3 enc.verdolago (5), 4 aux.verdolago (5).
create temp table k as
select (now() at time zone 'America/La_Paz')::date + 21 as d,
       (select id from public.org_strategies where name = 'Tienda') as tienda,
       (select id from public.org_channels where name = 'Llamadas') as llamadas,
       (select id from public.org_subchannels where name = 'Llamadas a clientes de pedidos') as pedidos;
grant select on k to authenticated;
create temp table ids (name text, id uuid);
grant all on ids to authenticated;

create function pg_temp.p(extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('branch_id', 5, 'work_date', (select d from k), 'shift', 'morning',
    'start_time', '10:00', 'end_time', '11:00', 'profile_id', '00000000-0000-4000-8000-000000000004',
    'strategy_id', (select tienda from k), 'channel_id', (select llamadas from k),
    'subchannel_id', (select pedidos from k), 'goal', 10) || extra
$$;
grant execute on function pg_temp.p(jsonb) to authenticated;

-- Un duplicado viejo (como el de producción del 19/11): dos filas iguales cargadas antes de la regla.
with x as (
  insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
    channel_id, subchannel_id, goal, lead_id)
  select 5, d, 'afternoon', '15:00', '16:00', '00000000-0000-4000-8000-000000000004', tienda, llamadas, pedidos, 2, null
  from k, generate_series(1, 2)
  returning id)
insert into ids select 'old', id from x;

select tests.login_as('00000000-0000-4000-8000-000000000003');

-- Primera vez se guarda; la segunda igual se rechaza (doble clic o «guardar igual») -------------------------------
select lives_ok(format($$ insert into ids select 'first', public.org_save(%L) $$, pg_temp.p()), 'la primera se guarda');
select throws_ok(format($$ select public.org_save(%L) $$, pg_temp.p('{"goal": 20}')),
  'P0001', 'duplicate_assignment', 'otra igual (aunque cambie la meta) se rechaza');
select throws_ok(format($$ select public.org_save_many(%L) $$,
  pg_temp.p(jsonb_build_object('subchannel_id', null, 'items',
    jsonb_build_array(jsonb_build_object('subchannel_id', (select pedidos from k), 'goal', 5))))),
  'P0001', 'duplicate_assignment', 'carga múltiple con un subcanal ya cargado se rechaza');

-- Lo que NO es igual sigue permitido -------------------------------------------------------------------------------
select lives_ok(format($$ select public.org_save(%L) $$, pg_temp.p('{"start_time": "12:00", "end_time": "12:30"}')),
  'misma persona y canal en otro horario se guarda (dos bloques)');
select lives_ok(format($$ select public.org_save(%L) $$,
  pg_temp.p('{"profile_id": "00000000-0000-4000-8000-000000000003"}')), 'otra persona en el mismo horario se guarda');

-- Editar ------------------------------------------------------------------------------------------------------------
select lives_ok(format($$ select public.org_save(%L) $$,
  pg_temp.p(jsonb_build_object('id', (select id from ids where name = 'first'), 'goal', 15))),
  'editar la propia sin cambiar el horario se guarda');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.p(jsonb_build_object('id', (select id from ids where name = 'first'), 'start_time', '12:00', 'end_time', '12:30'))),
  'P0001', 'duplicate_assignment', 'editar hasta quedar igual a otra se rechaza');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.p(jsonb_build_object('id', (select id from ids where name = 'old' limit 1), 'shift', 'afternoon',
    'start_time', '15:00', 'end_time', '16:00', 'goal', 3))),
  'P0001', 'duplicate_assignment', 'un duplicado viejo no se puede guardar mientras exista su gemelo');
reset role;
select is((select count(*)::int from public.org_assignments a, k where a.work_date = k.d and a.branch_id = 5), 5,
  'quedan 5: los 2 viejos + 3 guardadas (nada borrado)');

select * from finish();
rollback;
