begin;
select plan(11);

-- Spec 034: la meta de Captaciones del día sale de la Planificación; se agrega Compartidas.
-- Usuarios del seed: 2 gerente. Sucursales 5 (Verdolago) y 7 (Trinidad), vaciadas dentro de la transacción.
delete from public.org_assignments where branch_id in (5, 7);
delete from public.daily_goal_overrides where branch_id in (5, 7);
insert into public.daily_goal_base (branch_id, captures, contacts, potential, sales)
values (5, 99, 40, 8, 3), (7, 70, 30, 6, 2)
on conflict (branch_id) do update set captures = excluded.captures, contacts = excluded.contacts,
  potential = excluded.potential, sales = excluded.sales;

create temp table k as
select (now() at time zone 'America/La_Paz')::date as today,
       (select id from public.org_strategies where name = 'Tienda') as tienda,
       (select id from public.org_channels where name = 'Llamadas') as llamadas,
       (select id from public.org_subchannels where name = 'Llamadas a clientes de pedidos') as pedidos,
       (select id from public.org_channels where name = 'Compartidas y estados') as compartidas,
       (select id from public.org_subchannels where name = 'Compartidas WhatsApp') as sh_wa;
grant select on k to authenticated;

create function pg_temp.put(p_branch smallint, p_profile uuid, p_start time, p_channel smallint, p_sub smallint,
  p_goal int, p_share int, p_share_result int) returns void
language sql as $$
  insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
    channel_id, subchannel_id, goal, share_goal, share_result, created_by)
  values (p_branch, (select today from k), 'morning', p_start, p_start + interval '30 minutes', p_profile,
    (select tienda from k), p_channel, p_sub, p_goal, p_share, p_share_result, '00000000-0000-4000-8000-000000000002')
$$;

create function pg_temp.g(p_branch smallint) returns jsonb
language sql as $$ select public.goals_for_day(p_branch, (select today from k)) $$;
grant execute on function pg_temp.g(smallint) to authenticated;

-- Sin Planificación: como hoy -----------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000002');
select is((pg_temp.g(5::smallint) #>> '{goals,captures}')::int, 99, '1. sin Planificación, Captaciones = meta base');
select is(pg_temp.g(5::smallint) #> '{goals,shares}', 'null'::jsonb, '2. sin Planificación, Compartidas sin meta');
select is((pg_temp.g(5::smallint) ->> 'captures_from_plan')::boolean, false, '4. no viene de la Planificación');
select tests.logout();

-- Con Planificación en Verdolago ---------------------------------------------------------------------------------
select pg_temp.put(5::smallint, '00000000-0000-4000-8000-000000000004', '08:00', (select llamadas from k), (select pedidos from k), 10, null, null);
select pg_temp.put(5::smallint, '00000000-0000-4000-8000-000000000005', '09:00', (select llamadas from k), (select pedidos from k), 5, null, null);
select pg_temp.put(5::smallint, '00000000-0000-4000-8000-000000000004', '10:00', (select compartidas from k), (select sh_wa from k), null, 15, 4);
-- Un ajuste del día no le gana a la Planificación (criterio 1).
insert into public.daily_goal_overrides (branch_id, day, captures, contacts, note)
values (5, (select today from k), 50, 45, 'feria');

select tests.login_as('00000000-0000-4000-8000-000000000002');
select is((pg_temp.g(5::smallint) #>> '{goals,captures}')::int, 15, '1. Captaciones = suma de metas de la Planificación (10 + 5)');
select is((pg_temp.g(5::smallint) #>> '{goals,shares}')::int, 15, '2. Compartidas = suma de metas de compartidas');
select is((pg_temp.g(5::smallint) #>> '{actuals,shares}')::int, 4, '3. avance de Compartidas = suma de resultados');
select is((pg_temp.g(5::smallint) ->> 'captures_from_plan')::boolean, true, '4. viene de la Planificación');
select is((pg_temp.g(5::smallint) #>> '{goals,contacts}')::int, 45, '5. Contactos sigue a mano (el ajuste del día)');

-- Varias sucursales: cada una con su regla y el total es la suma de cada una -------------------------------------
select is((pg_temp.g(7::smallint) #>> '{goals,captures}')::int, 70, '1. Trinidad sin Planificación sigue a mano');
select is((public.goals_for_day(null, (select today from k)) #>> '{goals,captures}')::int,
  (select sum((pg_temp.g(b.id) #>> '{goals,captures}')::int)::int from public.branches b where b.active),
  '1. todas las sucursales: el total es la suma de la regla de cada una');
select tests.logout();

-- Sin permiso: igual que hoy --------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.goals_for_day(5::smallint, null) $$, 'P0001', 'forbidden', '5. el auxiliar no ve metas (sin cambio)');
select tests.logout();

select * from finish();
rollback;
