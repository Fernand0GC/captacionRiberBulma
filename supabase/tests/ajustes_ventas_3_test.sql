begin;
select plan(12);
-- Spec 032: sin resultados pendientes heredados de otras corridas (la transacción se deshace al final).
delete from public.org_assignments where branch_id in (5, 7);

-- Spec 007: copia de día sin duplicados (org_copy_day_v2 y org_copy_day) y meta de compartidas opcional
-- (20261119000100). Usuarios del seed: 3 enc.verdolago (5), 4 aux.verdolago (5), 7 enc.trinidad (7).
create temp table k as
select (now() at time zone 'America/La_Paz')::date + 10 as d1,
       (select id from public.org_strategies where name = 'Tienda') as tienda,
       (select id from public.org_channels where name = 'Llamadas') as llamadas,
       (select id from public.org_subchannels where name = 'Llamadas a clientes de pedidos') as pedidos,
       (select id from public.org_channels where name = 'Compartidas y estados') as compartidas,
       (select id from public.org_subchannels where name = 'Compartidas WhatsApp') as sh_wa;
grant select on k to authenticated;
create temp table ids (name text, id uuid);
grant all on ids to authenticated;

-- Llamadas a clientes de pedidos (pide meta de captación) para el auxiliar de Verdolago.
create function pg_temp.call(p_day date, p_start text, p_end text, extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('branch_id', 5, 'work_date', p_day, 'shift', 'morning',
    'start_time', p_start, 'end_time', p_end, 'profile_id', '00000000-0000-4000-8000-000000000004',
    'strategy_id', (select tienda from k), 'channel_id', (select llamadas from k),
    'subchannel_id', (select pedidos from k), 'goal', 20) || extra
$$;
grant execute on function pg_temp.call(date, text, text, jsonb) to authenticated;
create function pg_temp.n_on(p_day date) returns int
language sql security definer as $$ select count(*)::int from public.org_assignments where branch_id = 5 and work_date = p_day $$;
grant execute on function pg_temp.n_on(date) to authenticated;

select tests.login_as('00000000-0000-4000-8000-000000000003');
-- Origen d1: dos asignaciones distintas y una repetida de la primera (como las que dejaba la copia doble).
select public.org_save(pg_temp.call((select d1 from k), '10:00', '11:00'));
select public.org_save(pg_temp.call((select d1 from k), '11:00', '12:00'));
-- Desde la 011 org_save rechaza la repetida: se inserta directo, como las que quedaron de antes.
reset role;
insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
  channel_id, subchannel_id, goal, lead_id, created_by)
select a.branch_id, a.work_date, a.shift, a.start_time, a.end_time, a.profile_id, a.strategy_id, a.channel_id,
  a.subchannel_id, a.goal, a.lead_id, a.created_by
from public.org_assignments a, k where a.branch_id = 5 and a.work_date = k.d1 and a.start_time = '10:00';
select tests.login_as('00000000-0000-4000-8000-000000000003');

-- Copia sin duplicar (FR-001, FR-002) -------------------------------------------------------------------------------
select is(public.org_copy_day_v2(5::smallint, (select d1 from k), (select d1 + 1 from k)),
  '{"copied": 2, "skipped": 1}'::jsonb, 'copia las distintas y salta la repetida del origen');
select is(public.org_copy_day_v2(5::smallint, (select d1 from k), (select d1 + 1 from k)),
  '{"copied": 0, "skipped": 3}'::jsonb, 'copiar otra vez no agrega nada');
select is(pg_temp.n_on((select d1 + 1 from k)), 2, 'el destino queda con 2, sin repetidas');

-- Destino con una cargada a mano: solo agrega la que falta y no toca la manual.
insert into ids select 'manual', public.org_save(pg_temp.call((select d1 + 2 from k), '10:00', '11:00'));
select is(public.org_copy_day_v2(5::smallint, (select d1 from k), (select d1 + 2 from k)),
  '{"copied": 1, "skipped": 2}'::jsonb, 'con una cargada a mano, copia solo la que falta');
select is(pg_temp.n_on((select d1 + 2 from k)), 2, 'la cargada a mano sigue y no se duplica');

-- La función vieja mantiene firma y retorno (entero) para la app publicada (research R1).
select is(public.org_copy_day(5::smallint, (select d1 from k), (select d1 + 3 from k)), 2, 'org_copy_day devuelve las copiadas');
select is(public.org_copy_day(5::smallint, (select d1 from k), (select d1 + 3 from k)), 0, 'org_copy_day tampoco duplica');

-- Permisos y validaciones sin cambio.
select throws_ok($$ select public.org_copy_day_v2(5::smallint, (select d1 from k), (select d1 from k)) $$,
  'P0001', 'invalid_input', 'mismo día de origen y destino rechazado');
select tests.login_as('00000000-0000-4000-8000-000000000007');
select throws_ok($$ select public.org_copy_day_v2(5::smallint, (select d1 from k), (select d1 + 4 from k)) $$,
  'P0001', 'forbidden', 'el encargado de otra sucursal no puede copiar');

-- Meta de compartidas: la FR-011 (opcional) la reemplaza la spec 030 → obligatoria donde se pide --------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok(format($$ select public.org_save(%L) $$, pg_temp.call((select d1 from k), '08:30', '08:45',
  jsonb_build_object('channel_id', (select compartidas from k), 'subchannel_id', (select sh_wa from k), 'goal', null))),
  'P0001', 'invalid_input', 'Compartidas WhatsApp sin meta de compartidas se rechaza (spec 030)');
select is(public.org_save(pg_temp.call((select d1 from k), '09:00', '09:30', '{"share_goal": 15}')) is not null, true,
  'captación con meta se guarda (sin cambio)');
select throws_ok(format($$ select public.org_save(%L) $$, pg_temp.call((select d1 from k), '09:30', '10:00', '{"goal": null}')),
  'P0001', 'invalid_input', 'la meta de captación sigue siendo obligatoria donde aplica');

select * from finish();
rollback;
