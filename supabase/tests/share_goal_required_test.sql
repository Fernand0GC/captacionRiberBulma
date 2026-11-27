begin;
select plan(13);
-- Spec 032: sin resultados pendientes heredados de otras corridas (la transacción se deshace al final).
delete from public.org_assignments where branch_id in (5, 7);

-- Spec 030: la meta de compartidas vuelve a ser obligatoria donde el catálogo la pide (reemplaza FR-011 de la 007).
-- Usuarios del seed: 3 enc.verdolago (sucursal 5), 4 aux.verdolago (5).
create temp table k as
select (now() at time zone 'America/La_Paz')::date + 12 as d1,
       (select id from public.org_strategies where name = 'Tienda') as tienda,
       (select id from public.org_channels where name = 'Llamadas') as llamadas,
       (select id from public.org_subchannels where name = 'Llamadas a clientes de pedidos') as pedidos,
       (select id from public.org_channels where name = 'Compartidas y estados') as compartidas,
       (select id from public.org_subchannels where name = 'Compartidas WhatsApp') as sh_wa,
       (select id from public.org_channels where name = 'RRSS-Mensajería') as mensajeria,
       (select id from public.org_subchannels where name = 'Mensajería WhatsApp') as msg_wa,
       (select id from public.org_subchannels where name = 'Barrios chinos - grupos') as chinos;
grant select on k to authenticated;
create temp table ids (name text, id uuid);
grant all on ids to authenticated;

-- Asignación base para el auxiliar de Verdolago; `extra` pisa lo que haga falta.
create function pg_temp.a(p_start text, p_end text, extra jsonb) returns jsonb
language sql as $$
  select jsonb_build_object('branch_id', 5, 'work_date', (select d1 from k), 'shift', 'morning',
    'start_time', p_start, 'end_time', p_end, 'profile_id', '00000000-0000-4000-8000-000000000004',
    'strategy_id', (select tienda from k)) || extra
$$;
grant execute on function pg_temp.a(text, text, jsonb) to authenticated;

-- Devuelve 'ok' o «mensaje:detalle» del error, para comprobar el detalle (throws_ok solo mira el mensaje).
create function pg_temp.try_save(p jsonb) returns text
language plpgsql as $$
declare v_detail text;
begin
  perform public.org_save(p);
  return 'ok';
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return sqlerrm || ':' || coalesce(v_detail, '');
end $$;
grant execute on function pg_temp.try_save(jsonb) to authenticated;

create function pg_temp.try_many(p jsonb) returns text
language plpgsql as $$
declare v_detail text;
begin
  perform public.org_save_many(p);
  return 'ok';
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return sqlerrm || ':' || coalesce(v_detail, '');
end $$;
grant execute on function pg_temp.try_many(jsonb) to authenticated;

create function pg_temp.n_on(p_day date) returns int
language sql security definer as $$ select count(*)::int from public.org_assignments where branch_id = 5 and work_date = p_day $$;
grant execute on function pg_temp.n_on(date) to authenticated;

select tests.login_as('00000000-0000-4000-8000-000000000003');

-- Criterio 1: solo compartidas (Compartidas WhatsApp) ------------------------------------------------------------
select is(pg_temp.try_save(pg_temp.a('07:00', '07:30', jsonb_build_object(
  'channel_id', (select compartidas from k), 'subchannel_id', (select sh_wa from k)))),
  'invalid_input:share_goal', '1. Compartidas WhatsApp sin meta de compartidas se rechaza');
select is(pg_temp.try_save(pg_temp.a('08:00', '08:30', jsonb_build_object(
  'channel_id', (select compartidas from k), 'subchannel_id', (select sh_wa from k), 'share_goal', 15))),
  'ok', '1. con meta de compartidas se guarda');

-- Criterio 6: rango 0..9999, el 0 vale ----------------------------------------------------------------------------
select is(pg_temp.try_save(pg_temp.a('08:30', '09:00', jsonb_build_object(
  'channel_id', (select compartidas from k), 'subchannel_id', (select sh_wa from k), 'share_goal', 0))),
  'ok', '6. meta de compartidas 0 es válida');
select is(pg_temp.try_save(pg_temp.a('09:00', '09:30', jsonb_build_object(
  'channel_id', (select compartidas from k), 'subchannel_id', (select sh_wa from k), 'share_goal', 10000))),
  'invalid_input:share_goal', '6. meta de compartidas fuera de rango se rechaza');

-- Criterio 3: las dos metas (Mensajería WhatsApp) ------------------------------------------------------------------
select is(pg_temp.try_save(pg_temp.a('09:30', '10:00', jsonb_build_object(
  'channel_id', (select mensajeria from k), 'subchannel_id', (select msg_wa from k), 'goal', 20))),
  'invalid_input:share_goal', '3. Mensajería WhatsApp sin meta de compartidas se rechaza');
select is(pg_temp.try_save(pg_temp.a('10:30', '11:00', jsonb_build_object(
  'channel_id', (select mensajeria from k), 'subchannel_id', (select msg_wa from k), 'share_goal', 15))),
  'invalid_input:goal', '3. Mensajería WhatsApp sin meta de captación se rechaza (sin cambio)');
select is(pg_temp.try_save(pg_temp.a('10:00', '10:30', jsonb_build_object(
  'channel_id', (select mensajeria from k), 'subchannel_id', (select msg_wa from k), 'goal', 20, 'share_goal', 15))),
  'ok', '3. Mensajería WhatsApp con las dos metas se guarda');

-- Criterio 2: donde no se pide, se guarda vacía (sin cambio) ------------------------------------------------------
select tests.logout();
select tests.login_as('00000000-0000-4000-8000-000000000003');
insert into ids select 'calls', public.org_save(pg_temp.a('13:00', '13:30', jsonb_build_object(
  'channel_id', (select llamadas from k), 'subchannel_id', (select pedidos from k), 'goal', 20, 'share_goal', 5)));
select tests.logout();
select is((select share_goal from public.org_assignments where id = (select id from ids where name = 'calls')), null,
  '2. Llamadas (no pide compartidas) guarda la meta de compartidas vacía');

-- Criterio 4: carga múltiple, todo o nada --------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(pg_temp.try_many(pg_temp.a('12:00', '12:30', jsonb_build_object(
  'channel_id', (select mensajeria from k), 'place', '', 'notes', '', 'flyer_ids', '[]'::jsonb,
  'goal', null, 'share_goal', null,
  'items', jsonb_build_array(
    jsonb_build_object('subchannel_id', (select msg_wa from k), 'goal', 20, 'share_goal', 15),
    jsonb_build_object('subchannel_id', (select chinos from k), 'goal', 10, 'share_goal', null))))),
  'invalid_input:share_goal', '4. carga múltiple con un subcanal sin meta de compartidas se rechaza');
select is(pg_temp.n_on((select d1 from k)), 4, '4. y no guarda ninguno de la carga');

-- Criterio 7: editar una vieja sin meta obliga a escribirla --------------------------------------------------------
select tests.logout();
reset role;
with x as (
  insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
    channel_id, subchannel_id, goal, share_goal, lead_id, created_by)
  select 5, k.d1, 'afternoon', '15:00', '15:30', '00000000-0000-4000-8000-000000000004', k.tienda,
    k.compartidas, k.sh_wa, null, null, null, '00000000-0000-4000-8000-000000000003'
  from k returning id)
insert into ids select 'old', id from x;
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(pg_temp.try_save(pg_temp.a('15:00', '15:30', jsonb_build_object(
  'id', (select id from ids where name = 'old'), 'shift', 'afternoon',
  'channel_id', (select compartidas from k), 'subchannel_id', (select sh_wa from k)))),
  'invalid_input:share_goal', '7. editar una asignación vieja sin meta de compartidas obliga a escribirla');

-- Criterio 8: «Copiar día» copia la vieja tal cual, aunque no tenga meta --------------------------------------------
select is((public.org_copy_day_v2(5::smallint, (select d1 from k), (select d1 + 1 from k)) ->> 'copied')::int, 5,
  '8. copiar el día copia las 5 asignaciones, también la que no tiene meta');
select tests.logout();
select is((select count(*)::int from public.org_assignments
  where branch_id = 5 and work_date = (select d1 + 1 from k) and subchannel_id = (select sh_wa from k)
    and share_goal is null), 1, '8. la copia de la vieja queda sin meta de compartidas');

select * from finish();
rollback;
