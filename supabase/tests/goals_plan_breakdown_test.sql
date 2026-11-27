begin;
select plan(9);

-- Spec 037: el avance de Captaciones sale de los Captados de la Planificación y hay desglose por canal.
-- Usuario del seed: 2 gerente. Sucursales 5 (con Planificación) y 7 (sin), vaciadas dentro de la transacción.
delete from public.org_assignments where branch_id in (5, 7);
delete from public.daily_goal_overrides where branch_id in (5, 7);
insert into public.daily_goal_base (branch_id, captures) values (5, 99), (7, 70)
on conflict (branch_id) do update set captures = excluded.captures;

create temp table k as
select (now() at time zone 'America/La_Paz')::date as today,
       (select id from public.org_strategies where name = 'Tienda') as tienda,
       (select id from public.org_channels where name = 'Llamadas') as llamadas,
       (select id from public.org_subchannels where name = 'Llamadas a clientes de pedidos') as pedidos,
       (select id from public.org_channels where name = 'RRSS-Mensajería') as mensajeria,
       (select id from public.org_subchannels where name = 'Mensajería WhatsApp') as msg_wa,
       (select id from public.org_channels where name = 'Compartidas y estados') as compartidas,
       (select id from public.org_subchannels where name = 'Compartidas WhatsApp') as sh_wa,
       (select id from public.org_channels where name = 'Tareas administrativas') as admin_tasks;
grant select on k to authenticated;

create function pg_temp.put(p_start time, p_channel smallint, p_sub smallint, p_goal int, p_result int,
  p_share int, p_share_result int) returns void
language sql as $$
  insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
    channel_id, subchannel_id, goal, result, share_goal, share_result, created_by)
  values (5, (select today from k), 'morning', p_start, p_start + interval '30 minutes',
    '00000000-0000-4000-8000-000000000004', (select tienda from k), p_channel, p_sub, p_goal, p_result, p_share,
    p_share_result, '00000000-0000-4000-8000-000000000002')
$$;

select pg_temp.put('08:00', (select llamadas from k), (select pedidos from k), 10, 4, null, null);
select pg_temp.put('09:00', (select llamadas from k), (select pedidos from k), 5, null, null, null);
select pg_temp.put('10:00', (select mensajeria from k), (select msg_wa from k), 20, 6, 10, 2);
select pg_temp.put('11:00', (select compartidas from k), (select sh_wa from k), null, null, 15, 4);
select pg_temp.put('12:00', (select admin_tasks from k), null, null, null, null, null);

create function pg_temp.g(p_branch smallint) returns jsonb
language sql as $$ select public.goals_for_day(p_branch, (select today from k)) $$;
grant execute on function pg_temp.g(smallint) to authenticated;

-- Registros nuevos de hoy en Trinidad, calculados sin sesión (day_actuals es interna).
create temp table exp as select (public.day_actuals(7::smallint, (select today from k)) ->> 'captures')::int as c7;
grant select on exp to authenticated;

select tests.login_as('00000000-0000-4000-8000-000000000002');

-- Criterio 1 ------------------------------------------------------------------------------------------------------
select is((pg_temp.g(5::smallint) #>> '{goals,captures}')::int, 35, '1. meta de Captaciones = 10 + 5 + 20 (spec 034)');
select is((pg_temp.g(5::smallint) #>> '{actuals,captures}')::int, 10, '1. avance = Captados de la Planificación (4 + 6)');
select is((pg_temp.g(7::smallint) #>> '{actuals,captures}')::int,
  (select c7 from exp),
  '1. sin Planificación, el avance siguen siendo los registros nuevos');
select is((public.goals_for_day(null, (select today from k)) #>> '{actuals,captures}')::int,
  (select sum((pg_temp.g(b.id) #>> '{actuals,captures}')::int)::int from public.branches b where b.active),
  '1. todas las sucursales: el avance es la suma de cada una');

-- Criterio 2 ------------------------------------------------------------------------------------------------------
select is(jsonb_array_length(pg_temp.g(5::smallint) -> 'by_channel'), 3, '2. tres canales con meta (sin Tareas administrativas)');
select is(pg_temp.g(5::smallint) -> 'by_channel' -> 0,
  jsonb_build_object('channel', 'RRSS-Mensajería', 'goal', 20, 'result', 6, 'share_goal', 10, 'share_result', 2),
  '2. primero el de mayor meta, con sus sumas');
select is(pg_temp.g(5::smallint) -> 'by_channel' -> 1,
  jsonb_build_object('channel', 'Llamadas', 'goal', 15, 'result', 4, 'share_goal', 0, 'share_result', 0),
  '2. Llamadas suma sus dos asignaciones; sin resultado cuenta 0');
select is(pg_temp.g(5::smallint) -> 'by_channel' -> 2,
  jsonb_build_object('channel', 'Compartidas y estados', 'goal', 0, 'result', 0, 'share_goal', 15, 'share_result', 4),
  '2. un canal solo de compartidas aparece con meta 0');
select is(pg_temp.g(7::smallint) -> 'by_channel', '[]'::jsonb, '2. sin Planificación, lista vacía');

select tests.logout();
select * from finish();
rollback;
