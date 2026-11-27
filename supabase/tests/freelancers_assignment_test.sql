begin;
select plan(15);

-- Spec 035: freelancers que van en la asignación (como las volanteras), y agregar freelancer desde la Planificación.
-- Usuarios del seed: 3 enc.verdolago (5), 7 enc.trinidad (7). Sucursal 5 vaciada dentro de la transacción.
delete from public.org_assignments where branch_id in (5, 7);

create temp table k as
select (now() at time zone 'America/La_Paz')::date + 40 as d1,
       (select id from public.org_strategies where name = 'Tienda') as tienda,
       (select id from public.org_channels where name = 'Freelancers') as free_ch,
       (select id from public.org_subchannels where name = 'Freelancers') as free_sub,
       (select id from public.org_channels where name = 'Llamadas') as llamadas,
       (select id from public.org_subchannels where name = 'Llamadas a clientes de pedidos') as pedidos;
grant select on k to authenticated;

-- Freelancers de prueba: dos de Verdolago, uno de Trinidad, uno inactivo y un cliente (no freelancer).
create temp table f (name text, id smallint);
grant select on f to authenticated;
with x as (
  insert into public.referrers (branch_id, name, kind, active, source) values
    (5, 'Prueba035 Ana', 'freelance', true, 'manager'),
    (5, 'Prueba035 Luis', 'freelance', true, 'manager'),
    (7, 'Prueba035 Trini', 'freelance', true, 'manager'),
    (5, 'Prueba035 Baja', 'freelance', false, 'manager'),
    (5, 'Prueba035 Cliente', 'client', true, 'manager')
  returning name, id)
insert into f select name, id from x;

create function pg_temp.fid(p text) returns smallint language sql as $$ select id from f where name = 'Prueba035 ' || p $$;
grant execute on function pg_temp.fid(text) to authenticated;

create function pg_temp.a(p_start text, extra jsonb) returns jsonb
language sql as $$
  select jsonb_build_object('branch_id', 5, 'work_date', (select d1 from k), 'shift', 'morning',
    'start_time', p_start, 'end_time', (p_start::time + interval '30 minutes')::text,
    'profile_id', '00000000-0000-4000-8000-000000000004', 'strategy_id', (select tienda from k),
    'channel_id', (select free_ch from k), 'subchannel_id', (select free_sub from k), 'goal', 10) || extra
$$;
grant execute on function pg_temp.a(text, jsonb) to authenticated;

create function pg_temp.try(q text) returns text
language plpgsql as $$
declare v_detail text;
begin
  execute q;
  return 'ok';
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return sqlerrm || ':' || coalesce(v_detail, '');
end $$;
grant execute on function pg_temp.try(text) to authenticated;

create function pg_temp.row_on(p_day date, p_start text) returns jsonb
language sql as $$
  select r from jsonb_array_elements(public.org_list(p_day, p_day, array[5]::smallint[]) -> 'rows') r
  where r ->> 'start_time' = p_start
$$;
grant execute on function pg_temp.row_on(date, text) to authenticated;

-- Criterio 1: marca del canal --------------------------------------------------------------------------------------
select is((select uses_freelancers from public.org_channels where id = (select free_ch from k)), true,
  '1. el canal Freelancers usa freelancers');
select is((select uses_freelancers from public.org_channels where id = (select llamadas from k)), false,
  '1. Llamadas no');

-- Criterios 2 a 4: guardar y leer ---------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(pg_temp.try(format('select public.org_save(%L)', pg_temp.a('08:00',
  jsonb_build_object('freelancer_ids', jsonb_build_array(pg_temp.fid('Luis'), pg_temp.fid('Ana')))))),
  'ok', '3. guarda con dos freelancers de la sucursal');
select is((select string_agg(x ->> 'name', ', ') from jsonb_array_elements(pg_temp.row_on((select d1 from k), '08:00') -> 'freelancers') x),
  'Prueba035 Ana, Prueba035 Luis', '4. org_list devuelve los freelancers por nombre');
select is((pg_temp.row_on((select d1 from k), '08:00') ->> 'uses_freelancers')::boolean, true, '4. y la marca del canal');
select is(pg_temp.try(format('select public.org_save(%L)', pg_temp.a('09:00',
  jsonb_build_object('freelancer_ids', jsonb_build_array(pg_temp.fid('Trini')))))),
  'invalid_input:freelancers', '3. un freelancer de otra sucursal se rechaza');
select is(pg_temp.try(format('select public.org_save(%L)', pg_temp.a('09:00',
  jsonb_build_object('freelancer_ids', jsonb_build_array(pg_temp.fid('Cliente')))))),
  'invalid_input:freelancers', '3. un referidor que no es freelancer se rechaza');
select is(pg_temp.try(format('select public.org_save(%L)', pg_temp.a('09:00',
  jsonb_build_object('freelancer_ids', jsonb_build_array(pg_temp.fid('Baja')))))),
  'invalid_input:freelancers', '3. un freelancer inactivo se rechaza');
select is(pg_temp.try(format('select public.org_save(%L)', pg_temp.a('10:00',
  jsonb_build_object('channel_id', (select llamadas from k), 'subchannel_id', (select pedidos from k),
    'freelancer_ids', jsonb_build_array(pg_temp.fid('Ana')))))),
  'ok', '3. otro canal guarda');
select is(pg_temp.row_on((select d1 from k), '10:00') -> 'freelancer_ids', '[]'::jsonb, '3. pero sin freelancers');
select tests.logout();

-- Al editar se conservan los que ya tenía aunque hoy estén inactivos ----------------------------------------------
update public.referrers set active = false where id = pg_temp.fid('Luis');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(pg_temp.try(format('select public.org_save(%L)', pg_temp.a('08:00',
  jsonb_build_object('id', pg_temp.row_on((select d1 from k), '08:00') ->> 'id', 'goal', 12,
    'freelancer_ids', jsonb_build_array(pg_temp.fid('Ana'), pg_temp.fid('Luis')))))),
  'ok', '3. editar conserva un freelancer que ya tenía aunque esté inactivo');

-- Criterio 5: copiar el día deja solo los activos -----------------------------------------------------------------
select (public.org_copy_day_v2(5::smallint, (select d1 from k), (select d1 + 1 from k)) ->> 'copied');
select is((select string_agg(x ->> 'name', ', ') from jsonb_array_elements(pg_temp.row_on((select d1 + 1 from k), '08:00') -> 'freelancers') x),
  'Prueba035 Ana', '5. la copia lleva solo los freelancers activos');

-- Criterio 6: agregar freelancer desde la Planificación -----------------------------------------------------------
select is((public.org_add_freelancer(5::smallint, '  Prueba035   Nuevo ') ->> 'existed')::boolean, false,
  '6. agrega un freelancer nuevo');
select is((public.org_add_freelancer(5::smallint, 'prueba035 nuevo') ->> 'existed')::boolean, true,
  '6. el mismo nombre (otras mayúsculas) devuelve el existente');
select tests.logout();
select tests.login_as('00000000-0000-4000-8000-000000000007');
select is(pg_temp.try($$ select public.org_add_freelancer(5::smallint, 'Otro Nombre') $$), 'forbidden:',
  '6. la encargada de otra sucursal no puede agregar');
select tests.logout();

select * from finish();
rollback;
