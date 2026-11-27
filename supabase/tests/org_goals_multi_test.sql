begin;
select plan(32);
-- Spec 032: sin resultados pendientes heredados de otras corridas (la transacción se deshace al final).
delete from public.org_assignments where branch_id in (5, 7);

-- Spec 004: dos metas, selección múltiple y subcanales agregados por ventas (20261118000100).
-- Usuarios del seed: 3 enc.verdolago, 4 aux.verdolago, 5 sup.verdolago, 6 vol.verdolago, 7 enc.trinidad, 1 admin.
-- 008: un canal de prueba sin subcanales (solo compartidas) para las asignaciones sin subcanal; los canales reales
-- pueden tener subcanales agregados y desde la 008 exigen elegir uno.
insert into public.org_channels (strategy_id, name, sort, uses_goal, uses_share_goal)
select id, 'Sin subcanales (test)', 99, false, true from public.org_strategies where name = 'Tienda';
create temp table k as
select (now() at time zone 'America/La_Paz')::date + 1 as tomorrow,
       (select id from public.org_strategies where name = 'Tienda') as tienda,
       (select id from public.org_channels where name = 'RRSS-Mensajería') as mensajeria,
       (select id from public.org_channels where name = 'Compartidas y estados') as compartidas,
       (select id from public.org_channels where name = 'Tareas administrativas') as admin_tasks,
       (select id from public.org_channels where name = 'Sin subcanales (test)') as no_subs,
       (select id from public.org_channels where name = 'Llamadas') as llamadas,
       (select id from public.org_subchannels where name = 'Mensajería WhatsApp') as whatsapp,
       (select id from public.org_subchannels where name = 'Barrios chinos - grupos') as barrios_chinos,
       (select id from public.org_subchannels where name = 'Mensajería TikTok') as tiktok,
       (select id from public.org_subchannels where name = 'Compartidas y estados') as compartidas_sub,
       (select id from public.org_subchannels where name = 'Llamadas a clientes de pedidos') as pedidos;
grant select on k to authenticated;
create temp table ids (name text, id uuid);
grant all on ids to authenticated;

create function pg_temp.base(extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('branch_id', 5, 'work_date', (select tomorrow from k), 'shift', 'morning',
    'start_time', '08:30', 'end_time', '12:30', 'profile_id', '00000000-0000-4000-8000-000000000004',
    'strategy_id', (select tienda from k), 'channel_id', (select mensajeria from k), 'place', '') || extra
$$;
grant execute on function pg_temp.base(jsonb) to authenticated;

create function pg_temp.row_of(p_id uuid) returns jsonb
language sql as $$
  select r from jsonb_array_elements(public.org_list((select tomorrow - 1 from k), (select tomorrow + 3 from k)) -> 'rows') r
  where r ->> 'id' = p_id::text
$$;
grant execute on function pg_temp.row_of(uuid) to authenticated;

-- Marcas iniciales (FR-005)
select ok((select uses_goal and uses_share_goal from public.org_subchannels where id = (select whatsapp from k)),
  'WhatsApp: captación y compartidas');
select ok((select not uses_goal and uses_share_goal from public.org_subchannels where id = (select compartidas_sub from k)),
  'Compartidas y estados: solo compartidas');
select ok((select not uses_goal and not uses_share_goal from public.org_subchannels where id = (select tiktok from k)),
  'Mensajería TikTok: sin metas');
select ok((select uses_goal and not uses_share_goal from public.org_subchannels where id = (select pedidos from k)),
  'Llamadas: solo captación, como su canal');
select ok((select not uses_goal and not uses_share_goal from public.org_channels where id = (select admin_tasks from k)),
  'Tareas administrativas: sin metas');

-- Metas obligatorias y metas que no aplican (FR-003, FR-004)
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.base(jsonb_build_object('subchannel_id', (select whatsapp from k), 'share_goal', 15))),
  'P0001', 'invalid_input', 'WhatsApp sin meta de captación rechazado');
-- 030: la meta de compartidas vuelve a ser obligatoria donde se pide (reemplaza la FR-011 de la 007).
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.base(jsonb_build_object('subchannel_id', (select whatsapp from k), 'goal', 20))),
  'P0001', 'invalid_input', 'WhatsApp sin meta de compartidas rechazado (030)');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.base(jsonb_build_object('subchannel_id', (select whatsapp from k), 'goal', 20, 'share_goal', 10000))),
  'P0001', 'invalid_input', 'meta de compartidas fuera de rango rechazada');
insert into ids select 'whatsapp', public.org_save(
  pg_temp.base(jsonb_build_object('subchannel_id', (select whatsapp from k), 'goal', 20, 'share_goal', 15)));
select is((select (r ->> 'goal')::int * 100 + (r ->> 'share_goal')::int from pg_temp.row_of((select id from ids where name = 'whatsapp')) r),
  2015, 'WhatsApp guarda las dos metas');
select ok((select (r ->> 'uses_goal')::boolean and (r ->> 'uses_share_goal')::boolean
  from pg_temp.row_of((select id from ids where name = 'whatsapp')) r), 'org_list devuelve las marcas efectivas');
insert into ids select 'tiktok', public.org_save(
  pg_temp.base(jsonb_build_object('subchannel_id', (select tiktok from k), 'goal', 20, 'share_goal', 15)));
select ok((select r ->> 'goal' is null and r ->> 'share_goal' is null
  from pg_temp.row_of((select id from ids where name = 'tiktok')) r), 'TikTok guarda vacías las metas aunque lleguen');
insert into ids select 'compartidas', public.org_save(pg_temp.base(jsonb_build_object(
  'channel_id', (select no_subs from k), 'goal', 5, 'share_goal', 40)));
select ok((select r ->> 'goal' is null and r ->> 'share_goal' = '40'
  from pg_temp.row_of((select id from ids where name = 'compartidas')) r), 'canal sin subcanal usa la marca del canal');
select throws_ok(format($$ select public.org_save(%L) $$,
  pg_temp.base(jsonb_build_object('channel_id', (select llamadas from k), 'subchannel_id', (select pedidos from k)))),
  'P0001', 'invalid_input', 'Llamadas sin meta de captación rechazado');

-- Selección múltiple (FR-010, FR-012)
-- 011: horario propio para no quedar igual a 'whatsapp' y 'tiktok' (08:30–12:30).
insert into ids select 'many', unnest(public.org_save_many(pg_temp.base(jsonb_build_object('start_time', '13:00', 'end_time', '14:00', 'items', jsonb_build_array(
  jsonb_build_object('subchannel_id', (select whatsapp from k), 'goal', 20, 'share_goal', 15),
  jsonb_build_object('subchannel_id', (select barrios_chinos from k), 'goal', 10, 'share_goal', 30),
  jsonb_build_object('subchannel_id', (select tiktok from k)))))));
select is((select count(*)::int from ids where name = 'many'), 3, 'org_save_many crea una fila por subcanal');
select tests.logout(); -- org_assignments solo se lee por RPC
select is((select count(distinct batch_id)::int from public.org_assignments where id in (select id from ids where name = 'many')),
  1, 'las tres comparten batch_id');
select ok((select bool_and(batch_id is not null) from public.org_assignments where id in (select id from ids where name = 'many')),
  'el batch_id no es nulo');
select is((select share_goal from public.org_assignments a where a.id in (select id from ids where name = 'many')
  and a.subchannel_id = (select barrios_chinos from k)), 30::smallint, 'cada subcanal guarda sus metas');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select throws_ok(format($$ select public.org_save_many(%L) $$, pg_temp.base(jsonb_build_object('items', jsonb_build_array(
  jsonb_build_object('subchannel_id', (select whatsapp from k), 'goal', 20, 'share_goal', 15),
  jsonb_build_object('subchannel_id', (select whatsapp from k), 'goal', 20, 'share_goal', 15))))),
  'P0001', 'invalid_input', 'subcanal repetido rechazado');
select throws_ok(format($$ select public.org_save_many(%L) $$, pg_temp.base(jsonb_build_object('profile_id',
  '00000000-0000-4000-8000-000000000005', 'items', jsonb_build_array(
  jsonb_build_object('subchannel_id', (select whatsapp from k), 'goal', 20, 'share_goal', 15),
  jsonb_build_object('subchannel_id', (select barrios_chinos from k), 'share_goal', 30))))),
  'P0001', 'invalid_input', 'un ítem sin meta de captación rechaza la carga'); -- 007: la de compartidas es opcional
select tests.logout(); -- org_assignments solo se lee por RPC
select is((select count(*)::int from public.org_assignments where profile_id = '00000000-0000-4000-8000-000000000005'
  and work_date = (select tomorrow from k)), 0, 'todo o nada: no quedó ninguna fila de la carga fallida');
select tests.login_as('00000000-0000-4000-8000-000000000003');
insert into ids select 'single', unnest(public.org_save_many(pg_temp.base(jsonb_build_object('channel_id', (select no_subs from k), 'start_time', '14:00', 'end_time', '15:00', 'share_goal', 40)))); -- 030: el canal pide compartidas
select tests.logout(); -- org_assignments solo se lee por RPC
select ok((select batch_id is null and subchannel_id is null from public.org_assignments where id = (select id from ids where name = 'single')),
  'sin ítems: una asignación sin subcanal y sin batch_id');
select tests.login_as('00000000-0000-4000-8000-000000000003');

-- Resultado de compartidas (sobrecarga de 4 argumentos; la de 3 no toca share_result)
select public.org_set_result((select id from ids where name = 'whatsapp'), 18, 'ok', 15);
select is((select r ->> 'result' || '/' || (r ->> 'share_result') from pg_temp.row_of((select id from ids where name = 'whatsapp')) r),
  '18/15', 'guarda captados y compartidas');
select public.org_set_result((select id from ids where name = 'whatsapp'), 19, 'ok');
select tests.logout(); -- org_assignments solo se lee por RPC
select is((select share_result from public.org_assignments where id = (select id from ids where name = 'whatsapp')),
  15::smallint, 'la versión de 3 argumentos conserva share_result');
select tests.login_as('00000000-0000-4000-8000-000000000003');

-- Copia de día: share_goal y batch_id nuevo
select tests.logout();
-- 007: la copia salta las repetidas del origen; se esperan las distintas (persona, turno, horario, canal, subcanal).
create temp table n as select count(distinct (profile_id, shift, start_time, end_time, channel_id, subchannel_id))::int as n
from public.org_assignments where branch_id = 5 and work_date = (select tomorrow from k);
grant select on n to authenticated;
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(public.org_copy_day(5::smallint, (select tomorrow from k), (select tomorrow + 2 from k)), (select n from n), 'copia las asignaciones del día');
select tests.logout();
select ok((select count(distinct batch_id) = 1 and bool_and(share_goal is not null or subchannel_id = (select tiktok from k))
  and bool_and(batch_id not in (select batch_id from public.org_assignments where id in (select id from ids where name = 'many')))
  from public.org_assignments where work_date = (select tomorrow + 2 from k) and branch_id = 5 and batch_id is not null),
  'la copia lleva share_goal y un batch_id nuevo');
select tests.login_as('00000000-0000-4000-8000-000000000003');

-- Subcanales agregados por ventas (FR-013 a FR-015)
select is((public.org_add_subchannel(5::smallint, (select admin_tasks from k), '  Kardex   de ventas ') ->> 'existed')::boolean,
  false, 'el encargado agrega un subcanal');
select tests.logout();
-- Desde la 006 (FR-004) toma las marcas de su canal: Tareas administrativas no lleva metas.
select ok((select not uses_goal and not uses_share_goal and added_by = '00000000-0000-4000-8000-000000000003' and added_at is not null
  and morning_start is null
  from public.org_subchannels where channel_id = (select admin_tasks from k) and name = 'Kardex de ventas'), 'queda con las marcas del canal, sin horario y con quién y cuándo');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is((public.org_add_subchannel(5::smallint, (select admin_tasks from k), 'kárdex  DE VENTAS') ->> 'existed')::boolean,
  true, 'el mismo nombre escrito distinto usa el existente');
select tests.login_as('00000000-0000-4000-8000-000000000007');
select throws_ok(format($$ select public.org_add_subchannel(5::smallint, %s::smallint, 'Otra cosa') $$, (select admin_tasks from k)),
  'P0001', 'forbidden', 'el encargado de otra sucursal no agrega');
select tests.login_as('00000000-0000-4000-8000-000000000004');
select throws_ok(format($$ select public.org_add_subchannel(5::smallint, %s::smallint, 'Otra cosa') $$, (select admin_tasks from k)),
  'P0001', 'forbidden', 'el auxiliar no agrega');
select tests.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok(format($$ select public.org_add_subchannel(5::smallint, %s::smallint, 'Otra cosa') $$, (select admin_tasks from k)),
  'P0001', 'forbidden', 'la volantera no agrega');
select tests.login_as('00000000-0000-4000-8000-000000000001');
update public.org_subchannels set active = false where name = 'Kardex de ventas';
select tests.login_as('00000000-0000-4000-8000-000000000005');
select throws_ok(format($$ select public.org_add_subchannel(5::smallint, %s::smallint, 'Kardex de ventas') $$, (select admin_tasks from k)),
  'P0001', 'invalid_input', 'desactivado: avisa y no lo reactiva');

select * from finish();
rollback;
