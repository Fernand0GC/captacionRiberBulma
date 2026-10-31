begin;
select plan(14);
create temp table d as select (now() at time zone 'America/La_Paz')::date + 30 as day; -- un día sin datos
grant select on d to authenticated;

-- Encargado Verdolago arma la mañana
select tests.login_as('00000000-0000-4000-8000-000000000003');
create temp table ids (k text, id uuid);
grant all on ids to authenticated;
insert into ids select 'neg', public.save_activity(jsonb_build_object('branch_id', 5, 'activity_date', (select day from d), 'shift', 'morning',
  'start_time', '10:00', 'end_time', '12:00', 'strategy_id', (select id from public.agenda_strategies where name = 'Negociación'),
  'description', 'Negociación a clientes independientes barrio Litoral', 'responsibles', 'Claudia y volantera', 'goal', '5 ventas',
  'places', 'Ferretería La Paz, Ferretería Mi Casa'));
insert into ids select 'msg', public.save_activity(jsonb_build_object('branch_id', 5, 'activity_date', (select day from d), 'shift', 'morning',
  'start_time', '08:30', 'end_time', '09:00', 'description', 'Mensajería: dejar bandeja vacía', 'responsibles', 'Jean'));

select is(jsonb_array_length(public.agenda_day(5::smallint, (select day from d)) -> 'activities'), 2, 'dos actividades en el día');
select is(public.agenda_day(5::smallint, (select day from d)) -> 'activities' -> 0 ->> 'start_time', '08:30', 'ordenadas por hora');
select is(public.agenda_day(5::smallint, (select day from d)) -> 'activities' -> 1 ->> 'strategy', 'Negociación', 'con su estrategia');
select is((public.agenda_day(5::smallint, (select day from d)) ->> 'can_edit')::boolean, true, 'el encargado puede editar');
select throws_ok($$ select public.agenda_day(7::smallint, current_date) $$, 'P0001', 'forbidden', 'encargado no ve otra sucursal');
select throws_ok(format($$ select public.save_activity('{"branch_id":7,"activity_date":"%s","shift":"morning","start_time":"09:00","description":"X actividad"}') $$, current_date),
  'P0001', 'forbidden', 'encargado no planifica otra sucursal');

-- Cierre
select lives_ok($$ select public.set_activity_result((select id from ids where k = 'neg'), 'done', '3 ventas, 2 visitas pactadas') $$, 'marcar cumplida con lo logrado');
select is(public.agenda_day(5::smallint, (select day from d)) -> 'activities' -> 1 ->> 'result', '3 ventas, 2 visitas pactadas', 'guarda lo logrado');

-- Copiar al día siguiente: pendiente y sin resultado
select is(public.copy_agenda(5::smallint, (select day from d), (select day + 1 from d)), 2, 'copia las 2 actividades');
select is(public.agenda_day(5::smallint, (select day + 1 from d)) -> 'activities' -> 1 ->> 'status', 'pending', 'la copia queda pendiente');
select is(public.agenda_day(5::smallint, (select day + 1 from d)) -> 'activities' -> 1 ->> 'result', null, 'sin resultado');

-- El personal de la sucursal ve, no edita
select tests.login_as('00000000-0000-4000-8000-000000000006');
select is((public.agenda_day(5::smallint, (select day from d)) ->> 'can_edit')::boolean, false, 'volantero ve el plan, no edita');
select throws_ok($$ select public.delete_activity((select id from ids where k = 'msg')) $$, 'P0001', 'forbidden', 'volantero no borra');

-- Gerente edita cualquier sucursal
select tests.login_as('00000000-0000-4000-8000-000000000002');
select lives_ok($$ select public.delete_activity((select id from ids where k = 'msg')) $$, 'gerente borra una actividad');

select * from finish();
rollback;
