begin;
select plan(29);

-- Spec 019: «Acomodo de tienda» pasa de subcanal (hecho a mano) a canal de Tienda (20261123001900).
-- El subcanal real solo existe en producción: acá se arman subcanales de prueba y se vuelve a llamar la función.
-- Usuarios del seed: 1 admin, 3 enc.verdolago (5), 4 aux.verdolago (5), 6 vol.verdolago (5).

-- Lo que deja la migración en una base sin el subcanal -------------------------------------------------------
select has_function('public', 'org_subchannel_to_channel', array['text', 'text'], 'existe la función de conversión');
select ok(not has_function_privilege('authenticated', 'public.org_subchannel_to_channel(text, text)', 'execute'),
  'la app (authenticated) no puede ejecutarla');
select ok(not has_function_privilege('anon', 'public.org_subchannel_to_channel(text, text)', 'execute'),
  'anon no puede ejecutarla');
select is((select count(*)::int from public.org_channels c join public.org_strategies s on s.id = c.strategy_id
  where s.name = 'Tienda' and c.active and public.org_norm(c.name) = public.org_norm('Acomodo de tienda')), 1,
  'la migración dejó un solo canal activo Tienda → Acomodo de tienda');
select is((select count(*)::int from public.org_subchannels sc join public.org_channels c on c.id = sc.channel_id
  where public.org_norm(c.name) = public.org_norm('Acomodo de tienda')), 0, 'el canal nuevo no tiene subcanales');

-- Datos de prueba ---------------------------------------------------------------------------------------------
-- El canal que creó la migración se renombra para que la función vuelva a crearlo (camino «crear» con filas).
update public.org_channels set name = 'Acomodo previo 019'
where public.org_norm(name) = public.org_norm('Acomodo de tienda');

insert into public.org_subchannels (channel_id, name, sort, active, uses_goal, uses_share_goal, added_by, added_at)
select c.id, x.name, 90, x.active, x.goal, x.share, '00000000-0000-4000-8000-000000000003', now()
from (values
  ('Tienda', 'Llamadas', 'Acomodo de tienda', true, true, false),
  ('Calle', 'Volantes', 'acomodo  de Tiénda', false, false, true)   -- otra escritura, otra estrategia, inactivo
) as x(strategy, channel, name, active, goal, share)
join public.org_strategies s on s.name = x.strategy
join public.org_channels c on c.strategy_id = s.id and c.name = x.channel;

create temp table k as
select (now() at time zone 'America/La_Paz')::date + 20 as d,
       (select id from public.org_strategies where name = 'Tienda') as tienda,
       (select id from public.org_strategies where name = 'Calle') as calle,
       (select id from public.org_channels where name = 'Llamadas') as llamadas,
       (select id from public.org_channels where name = 'Volantes') as volantes,
       (select id from public.org_channels where name = 'Comentarios') as comentarios,
       (select id from public.org_subchannels where name = 'Acomodo de tienda') as sub_tienda,
       (select id from public.org_subchannels where name = 'acomodo  de Tiénda') as sub_calle,
       (select id from public.org_subchannels where name = 'Llamadas a clientes de pedidos') as pedidos;
grant select on k to authenticated;
create temp table ids (name text, id uuid);

-- a1 futura con todo cargado (metas, resultados, verificación de Cobros, volanteras, lote); a2 pasada bajo Calle;
-- control en otro subcanal de Llamadas. updated_at viejo para ver que no se toca.
with x as (
  insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
    channel_id, subchannel_id, goal, result, share_goal, share_result, share_verified, share_verified_note,
    share_verified_by, share_verified_at, flyer_ids, batch_id, notes, created_by, updated_by, updated_at)
  select 5, d, 'morning', '10:00', '11:00', '00000000-0000-4000-8000-000000000004', tienda, llamadas, sub_tienda,
    10, 7, 3, 2, 2, 'ok cobros', '00000000-0000-4000-8000-000000000001', '2026-11-01 10:00-04',
    array['00000000-0000-4000-8000-000000000006']::uuid[], gen_random_uuid(), 'nota 019',
    '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', '2026-11-01 09:00-04'
  from k returning id)
insert into ids select 'a1', id from x;
with x as (
  insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
    channel_id, subchannel_id, goal, result, updated_at)
  select 5, d - 50, 'afternoon', '16:00', '17:00', '00000000-0000-4000-8000-000000000004', calle, volantes, sub_calle,
    5, 4, '2026-10-01 09:00-04'
  from k returning id)
insert into ids select 'a2', id from x;
with x as (
  insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
    channel_id, subchannel_id, goal)
  select 5, d, 'morning', '11:00', '12:00', '00000000-0000-4000-8000-000000000004', tienda, llamadas, pedidos, 8
  from k returning id)
insert into ids select 'control', id from x;

-- Foto de «antes» sin los tres campos que deben cambiar.
create temp table snap as
select i.name, to_jsonb(a) - array['strategy_id', 'channel_id', 'subchannel_id'] as rest
from public.org_assignments a join ids i on i.id = a.id;

-- Primera llamada: crea el canal y mueve ------------------------------------------------------------------------
create temp table r1 as select public.org_subchannel_to_channel('Acomodo de tienda', 'Tienda') as j;
create temp table ch as select (j ->> 'channel_id')::smallint as id from r1;
grant select on ch to authenticated;

select is((select j - 'channel_id' - 'subchannels' from r1),
  '{"created": true, "reactivated": false, "moved": 2, "deactivated": 1}'::jsonb,
  'crea el canal, mueve las 2 asignaciones y desactiva el subcanal que estaba activo');
select is((select jsonb_array_length(j -> 'subchannels') from r1), 2,
  'encuentra los dos subcanales por nombre normalizado (otra escritura y otra estrategia)');
select is((select count(*)::int from public.org_assignments a join ids i on i.id = a.id
  where i.name in ('a1', 'a2') and a.strategy_id = (select tienda from k) and a.channel_id = (select id from ch)
    and a.subchannel_id is null), 2, 'las dos quedan en Tienda → Acomodo de tienda, sin subcanal (también la de Calle)');
select is((select (sum(goal), sum(result), sum(share_goal), sum(share_result), sum(share_verified))::text
  from public.org_assignments where channel_id = (select id from ch)), '(15,11,3,2,2)',
  'las sumas de metas, resultados, compartidas y verificadas son las de antes');
select is((select count(*)::int from public.org_assignments a join snap b on b.rest ->> 'id' = a.id::text
  where b.name in ('a1', 'a2')
    and to_jsonb(a) - array['strategy_id', 'channel_id', 'subchannel_id'] = b.rest), 2,
  'todo lo demás queda igual: verificación, volanteras, lote, notas, autores, updated_at/updated_by');
select is((select (a.channel_id, a.subchannel_id)::text from public.org_assignments a join ids i on i.id = a.id
  where i.name = 'control'), (select (llamadas, pedidos)::text from k), 'otro subcanal del mismo canal no se toca');
select is((select count(*)::int from public.org_subchannels
  where id in ((select sub_tienda from k), (select sub_calle from k)) and not active), 2,
  'los subcanales viejos siguen existiendo, inactivos');
select is((select (c.strategy_id = (select tienda from k), c.active, c.uses_goal, c.uses_share_goal, c.uses_flyers)::text
  from public.org_channels c where c.id = (select id from ch)), '(t,t,t,t,f)',
  'canal activo de Tienda con las marcas de meta de los subcanales combinadas y sin volanteras');
select is((select c.sort from public.org_channels c where c.id = (select id from ch)),
  (select max(c.sort) from public.org_channels c where c.strategy_id = (select tienda from k)), 'queda al final de Tienda');
select is((select count(*)::int from public.audit_log l join ids i on i.id = l.row_id
  where i.name in ('a1', 'a2') and l.table_name = 'org_assignments' and l.actor_id is null
    and l.new ->> 'channel_id' = (select id from ch)::text and l.new -> 'subchannel_id' = 'null'::jsonb), 2,
  'cada asignación movida queda en la auditoría');
select is((select (l.old ->> 'subchannel_id')::smallint from public.audit_log l join ids i on i.id = l.row_id
  where i.name = 'a1' and l.table_name = 'org_assignments'), (select sub_tienda from k),
  'la auditoría guarda el subcanal viejo');

-- Segunda llamada: no cambia nada (idempotencia) ------------------------------------------------------------------
create temp table r2 as select public.org_subchannel_to_channel('Acomodo de tienda', 'Tienda') as j;
select is((select j - 'subchannels' from r2),
  jsonb_build_object('channel_id', (select id from ch), 'created', false, 'reactivated', false, 'moved', 0, 'deactivated', 0),
  'repetir no crea, no mueve ni desactiva nada');
select is((select count(*)::int from public.org_channels where public.org_norm(name) = public.org_norm('Acomodo de tienda')), 1,
  'sigue habiendo un solo canal «Acomodo de tienda»');
select is((select count(*)::int from public.audit_log l join ids i on i.id = l.row_id where i.name in ('a1', 'a2')), 2,
  'repetir no agrega auditoría');

-- Canal existente inactivo: se reactiva; sin filas que mover, sus marcas no se tocan ----------------------------
update public.org_channels set active = false, uses_goal = false, uses_share_goal = false where id = (select id from ch);
create temp table r3 as select public.org_subchannel_to_channel('Acomodo de tienda', 'Tienda') as j;
select is((select j - 'subchannels' from r3),
  jsonb_build_object('channel_id', (select id from ch), 'created', false, 'reactivated', true, 'moved', 0, 'deactivated', 0),
  'un canal inactivo con ese nombre se reactiva y se reutiliza');
select is((select (active, uses_goal, uses_share_goal)::text from public.org_channels where id = (select id from ch)),
  '(t,f,f)', 'sin asignaciones que mover, las marcas que puso Catálogo se respetan');

-- Alguien volvió a crear el subcanal en otro canal: se mueve y el canal suma la marca que faltaba ---------------
insert into public.org_subchannels (channel_id, name, sort, uses_goal, uses_share_goal)
select comentarios, 'Acomodo de Tienda', 91, true, false from k;
insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
  channel_id, subchannel_id, goal)
select 5, d + 1, 'morning', '10:00', '11:00', '00000000-0000-4000-8000-000000000004', tienda, comentarios,
  (select id from public.org_subchannels where name = 'Acomodo de Tienda'), 4 from k;
create temp table r4 as select public.org_subchannel_to_channel('Acomodo de tienda', 'Tienda') as j;
select is((select ((j ->> 'moved')::int, (j ->> 'deactivated')::int)::text from r4), '(1,1)',
  'un subcanal recreado después se mueve en la siguiente corrida');
select is((select (uses_goal, uses_share_goal)::text from public.org_channels where id = (select id from ch)), '(t,f)',
  'con asignaciones que mover, el canal suma la meta de captación que usaban');

-- La Planificación usa el canal nuevo -------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select lives_ok(format($$ select public.org_save(%L) $$, jsonb_build_object('branch_id', 5,
  'work_date', (select d + 2 from k), 'shift', 'morning', 'start_time', '09:00', 'end_time', '10:00',
  'profile_id', '00000000-0000-4000-8000-000000000004', 'strategy_id', (select tienda from k),
  'channel_id', (select id from ch), 'goal', 6)),
  'la encargada guarda una asignación Tienda → Acomodo de tienda sin subcanal');
select throws_ok(format($$ select public.org_add_subchannel(5::smallint, %s::smallint, 'Acomodo de tienda') $$,
  (select llamadas from k)), 'P0001', 'invalid_input', '«+ Agregar otro…» no recrea el subcanal viejo (está inactivo)');
select tests.logout();

-- Sin subcanales con ese nombre: crea el canal con marcas por defecto ----------------------------------------------
create temp table r5 as select public.org_subchannel_to_channel('Canal prueba 019', 'Tienda') as j;
select is((select j - 'channel_id' from r5),
  '{"created": true, "reactivated": false, "subchannels": [], "moved": 0, "deactivated": 0}'::jsonb,
  'sin subcanal no falla: crea el canal y no mueve nada');
select is((select (uses_goal, uses_share_goal, uses_flyers)::text from public.org_channels
  where id = (select (j ->> 'channel_id')::smallint from r5)), '(t,f,f)', 'marcas por defecto: captación sí, compartidas no');

-- Errores -------------------------------------------------------------------------------------------------------
select throws_ok($$ select public.org_subchannel_to_channel('Acomodo de tienda', 'No existe') $$,
  'P0001', 'invalid_input', 'estrategia inexistente → invalid_input');
select throws_ok($$ select public.org_subchannel_to_channel('A', 'Tienda') $$,
  'P0001', 'invalid_input', 'nombre muy corto → invalid_input');

select * from finish();
rollback;
