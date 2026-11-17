begin;
select plan(8);
-- Planificación anterior como historial de solo lectura (spec 003, FR-017).
create temp table d as select (now() at time zone 'America/La_Paz')::date + 30 as day; -- un día sin datos
grant select on d to authenticated;

-- Una actividad cargada antes del cambio (se inserta directo, como historial).
insert into public.agenda_activities (branch_id, activity_date, shift, start_time, end_time, description, responsibles)
values (5, (select day from d), 'morning', '08:30', '09:00', 'Mensajería: dejar bandeja vacía', 'Jean');

-- El encargado la ve, sin poder editar
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(jsonb_array_length(public.agenda_day(5::smallint, (select day from d)) -> 'activities'), 1, 'el historial se sigue viendo');
select is((public.agenda_day(5::smallint, (select day from d)) ->> 'can_edit')::boolean, false, 'nadie edita el historial');
select throws_ok($$ select public.agenda_day(7::smallint, current_date) $$, 'P0001', 'forbidden', 'encargado no ve otra sucursal');
select throws_ok(format($$ select public.save_activity('{"branch_id":5,"activity_date":"%s","shift":"morning","start_time":"09:00","description":"X actividad"}') $$, current_date),
  '42501', null, 'ya no se crean actividades');
select throws_ok($$ select public.copy_agenda(5::smallint, current_date, current_date + 1) $$, '42501', null, 'ya no se copian');

-- Auxiliar la ve; volantera no
select tests.login_as('00000000-0000-4000-8000-000000000004');
select is(jsonb_array_length(public.agenda_day(5::smallint, (select day from d)) -> 'activities'), 1, 'el auxiliar ve el historial');
select tests.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.agenda_day(5::smallint, current_date) $$, 'P0001', 'forbidden', 'la volantera ya no ve la planificación');

-- Ni la gerencia borra
select tests.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.delete_activity(gen_random_uuid()) $$, '42501', null, 'la gerencia tampoco borra');

select * from finish();
rollback;
