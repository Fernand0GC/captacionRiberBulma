begin;
select plan(10);
-- Spec 032: sin resultados pendientes heredados de otras corridas (la transacción se deshace al final).
delete from public.org_assignments where branch_id in (5, 7);

-- Spec 008: subcanal y horario obligatorios en org_upsert (20261119000200).
-- Usuarios del seed: 3 enc.verdolago (5), 4 aux.verdolago (5).
-- Canales de prueba: uno sin subcanales y otro con un solo subcanal inactivo (cuentan como «sin subcanales»).
insert into public.org_channels (strategy_id, name, sort, uses_goal, uses_share_goal)
select id, x.name, 98, false, false from public.org_strategies, (values ('Sin subcanales 008'), ('Solo inactivo 008')) as x(name)
where org_strategies.name = 'Tienda';
insert into public.org_subchannels (channel_id, name, sort, active)
select id, 'Inactivo 008', 1, false from public.org_channels where name = 'Solo inactivo 008';

create temp table k as
select (now() at time zone 'America/La_Paz')::date + 20 as d,
       (select id from public.org_strategies where name = 'Tienda') as tienda,
       (select id from public.org_channels where name = 'Llamadas') as llamadas,
       (select id from public.org_subchannels where name = 'Llamadas a clientes de pedidos') as pedidos,
       (select id from public.org_channels where name = 'Sin subcanales 008') as no_subs,
       (select id from public.org_channels where name = 'Solo inactivo 008') as only_inactive;
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

-- Una asignación vieja sin horas ni subcanal (como las que quedaron antes de la 008).
with x as (
  insert into public.org_assignments (branch_id, work_date, shift, profile_id, strategy_id, channel_id, goal, lead_id)
  select 5, d, 'morning', '00000000-0000-4000-8000-000000000004', tienda, llamadas, 10, null from k
  returning id)
insert into ids select 'old', id from x;

select tests.login_as('00000000-0000-4000-8000-000000000003');

-- Subcanal obligatorio si el canal tiene subcanales activos (FR-001) ---------------------------------------------
select throws_ok(format($$ select public.org_save(%L) $$, pg_temp.p('{"subchannel_id": null}')),
  'P0001', 'invalid_input', 'Llamadas sin subcanal rechazado');
select throws_ok(format($$ select public.org_save_many(%L) $$, pg_temp.p('{"subchannel_id": null}')),
  'P0001', 'invalid_input', 'carga sin subcanales en un canal con subcanales rechazada');
select lives_ok(format($$ select public.org_save(%L) $$,
  pg_temp.p(jsonb_build_object('channel_id', (select no_subs from k), 'subchannel_id', null, 'goal', null))),
  'canal sin subcanales: se guarda sin subcanal');
select lives_ok(format($$ select public.org_save(%L) $$,
  pg_temp.p(jsonb_build_object('channel_id', (select only_inactive from k), 'subchannel_id', null, 'goal', null))),
  'canal con solo subcanales inactivos: se guarda sin subcanal');

-- Horario obligatorio (FR-003) ------------------------------------------------------------------------------------
select throws_ok(format($$ select public.org_save(%L) $$, pg_temp.p('{"end_time": ""}')),
  'P0001', 'invalid_input', 'sin hora de fin rechazado');
select throws_ok(format($$ select public.org_save(%L) $$, pg_temp.p('{"start_time": null, "end_time": null}')),
  'P0001', 'invalid_input', 'sin horas rechazado');
select lives_ok(format($$ select public.org_save(%L) $$, pg_temp.p()), 'con subcanal y horas se guarda');

-- Asignaciones viejas: «Resultado» sigue; al editar hay que completar (FR-007, US1 escenario 4) ----------------------
select lives_ok(format($$ select public.org_set_result(%L, 7, 'ok') $$, (select id from ids where name = 'old')),
  'resultado de una vieja sin horas ni subcanal');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.p(jsonb_build_object('id', (select id from ids where name = 'old'), 'subchannel_id', null))),
  'P0001', 'invalid_input', 'al editar una vieja sin subcanal se pide completarlo');
select lives_ok(format($$ select public.org_save(%L) $$, pg_temp.p(jsonb_build_object('id', (select id from ids where name = 'old'),
  'start_time', '11:00', 'end_time', '12:00'))), -- 011: otro horario que la de arriba (si no, sería igual)
  'al editar con subcanal y horas se guarda');

select * from finish();
rollback;
