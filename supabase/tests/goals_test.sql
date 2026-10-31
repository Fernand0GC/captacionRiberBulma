begin;
select plan(16);
create temp table d as select (now() at time zone 'America/La_Paz')::date as today;
grant select on d to authenticated;

-- Encargado Verdolago: base 50 captaciones / 20 potenciales
select tests.login_as('00000000-0000-4000-8000-000000000003');
select lives_ok($$ select public.set_daily_base(5::smallint, '{"captures":50,"potential":20}') $$, 'encargado guarda la base de su sucursal');
select is((public.goals_for_day(5::smallint) -> 'goals' ->> 'captures')::int, 50, 'hoy: meta de captación = base');
select is(public.goals_for_day(5::smallint) -> 'goals' ->> 'sales', null, 'ventas sin meta (opcional)');
select is((public.goals_for_day(5::smallint) ->> 'adjusted')::boolean, false, 'sin ajuste');
select throws_ok($$ select public.set_daily_base(7::smallint, '{"captures":10}') $$, 'P0001', 'forbidden', 'encargado no pone metas de otra sucursal');

-- Ajuste de hoy: feria → 80 captaciones
select lives_ok($$ select public.set_daily_override(5::smallint, (select today from d), '{"captures":80,"potential":20,"note":"Feria"}') $$, 'ajuste de un día');
select is((public.goals_for_day(5::smallint) -> 'goals' ->> 'captures')::int, 80, 'el ajuste reemplaza la base ese día');
select is(public.goals_for_day(5::smallint) ->> 'note', 'Feria', 'guarda la nota del ajuste');
select is((public.goals_for_day(5::smallint, (select today + 1 from d)) -> 'goals' ->> 'captures')::int, 50, 'mañana vuelve a la base');
select lives_ok($$ select public.set_daily_override(5::smallint, (select today from d), null) $$, 'quitar el ajuste');
select is((public.goals_for_day(5::smallint) -> 'goals' ->> 'captures')::int, 50, 'sin ajuste: vuelve a la base');

-- Lo logrado: +1 captación hoy
create temp table before as select (public.goals_for_day(5::smallint) -> 'actuals' ->> 'captures')::int as n;
grant select on before to authenticated;
select tests.login_as('00000000-0000-4000-8000-000000000006');
select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000501","full_name":"Meta Uno","phone":"75000501"}');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is((public.goals_for_day(5::smallint) -> 'actuals' ->> 'captures')::int, (select n + 1 from before), 'logrado: +1 captación');

-- Mensual por línea
select lives_ok($$ select public.set_monthly_goal(5::smallint, 'phones', (select today from d), 230) $$, 'meta mensual de celulares');
select is((select (x ->> 'goal')::int from jsonb_array_elements(public.monthly_goals_progress((select today from d))) x where x ->> 'line' = 'phones'), 230, 'avance mensual con la meta');

-- Gerente ve la suma de todas; volantero no ve metas
select tests.login_as('00000000-0000-4000-8000-000000000002');
select ok((public.goals_for_day() -> 'goals' ->> 'captures')::int >= 50, 'gerente: suma de sucursales');
select tests.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.goals_for_day() $$, 'P0001', 'forbidden', 'volantero no ve metas');

select * from finish();
rollback;
