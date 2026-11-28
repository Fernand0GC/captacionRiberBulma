begin;
select plan(30);

-- Spec 039: el auxiliar registra el resultado de sus tareas de hoy (org_report_result); el encargado corrige y su
-- corrección manda (result_locked); se guarda quién registró (result_by, result_at) y «Hecho / No hecho» (done).
-- Usuarios del seed: 2 gerente, 3 enc.verdolago (5), 4 aux.verdolago (5), 5 sup.verdolago (5), 6 vol.verdolago (5),
-- 9 jefe.ventas. La sucursal 5 se vacía dentro de la transacción para no depender de datos de otras pruebas.
delete from public.org_assignments where branch_id = 5;
-- Las reglas de la spec 032 rigen desde hace 30 días, para que no dependa del día en que se corre.
create or replace function public.org_day_close_since() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'America/La_Paz')::date - 30 $$;

create temp table k as
select (now() at time zone 'America/La_Paz')::date as today,
       (select id from public.org_strategies where name = 'Tienda') as tienda,
       (select id from public.org_channels where name = 'Llamadas') as llamadas,
       (select id from public.org_subchannels where name = 'Llamadas a clientes de pedidos') as pedidos,
       (select id from public.org_channels where name = 'Tareas administrativas') as admin_tasks;
grant select on k to authenticated;
create temp table ids (name text, id uuid);
grant select on ids to authenticated;

-- Inserta directo (como dato que ya existía). Solo se usa sin sesión.
create function pg_temp.put(p_name text, p_day date, p_start time, p_owner uuid, p_channel smallint, p_sub smallint,
  p_goal int) returns void
language sql as $$
  with x as (
    insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
      channel_id, subchannel_id, goal, created_by)
    values (5, p_day, 'morning', p_start, p_start + interval '30 minutes', p_owner,
      (select tienda from k), p_channel, p_sub, p_goal, '00000000-0000-4000-8000-000000000003')
    returning id)
  insert into ids select p_name, x.id from x
$$;

-- 'ok' o «mensaje:detalle» del error.
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

-- org_report_result(id, result, share_result, done, notes) sobre la asignación con ese nombre.
create function pg_temp.report(p_name text, p_result text, p_done text default 'null', p_notes text default 'null')
returns text
language sql as $$
  select pg_temp.try(format('select public.org_report_result(%L::uuid, %s, null, %s, %s)',
    (select id from ids where name = p_name), p_result, p_done, p_notes))
$$;
grant execute on function pg_temp.report(text, text, text, text) to authenticated;

-- La fila tal cual está en la tabla (org_assignments solo se lee por RPC con sesión).
create function pg_temp.row(p_name text) returns public.org_assignments
language sql security definer as $$
  select a.* from public.org_assignments a where a.id = (select id from ids where name = p_name)
$$;
grant execute on function pg_temp.row(text) to authenticated;

-- Campo de la fila en org_list (ayer y hoy, sucursal 5) para quien tiene la sesión.
create function pg_temp.listed(p_name text, p_field text) returns text
language sql as $$
  select r ->> p_field
  from jsonb_array_elements(public.org_list((select today - 1 from k), (select today from k), array[5]::smallint[]) -> 'rows') r
  where r ->> 'id' = (select id::text from ids where name = p_name)
$$;
grant execute on function pg_temp.listed(text, text) to authenticated;

select pg_temp.put('mine', (select today from k), '08:00', '00000000-0000-4000-8000-000000000004',
  (select llamadas from k), (select pedidos from k), 20);
select pg_temp.put('mine_admin', (select today from k), '09:00', '00000000-0000-4000-8000-000000000004',
  (select admin_tasks from k), null, null);
select pg_temp.put('mine_past', (select today - 1 from k), '08:00', '00000000-0000-4000-8000-000000000004',
  (select llamadas from k), (select pedidos from k), 20);
select pg_temp.put('other', (select today from k), '08:00', '00000000-0000-4000-8000-000000000005',
  (select llamadas from k), (select pedidos from k), 20);

-- ===================== H1 · El auxiliar registra su resultado =====================================================
select tests.login_as('00000000-0000-4000-8000-000000000004');
select is(pg_temp.listed('mine', 'can_set_result'), 'true', 'RF-04: org_list abre «Registrar» al auxiliar en su tarea de hoy');
select is(pg_temp.listed('mine_past', 'can_set_result'), 'false', 'RF-04: no en su tarea de ayer');
select is(pg_temp.report('mine', '12', 'null', quote_literal('  llamé a 30  ')), 'ok', 'H1.1: el auxiliar registra 12 captados');
select is((pg_temp.row('mine')).result::int, 12, 'H1.1: el resultado queda guardado');
select is((pg_temp.row('mine')).notes, 'llamé a 30', 'H1.1: observaciones recortadas');
select is((pg_temp.row('mine')).result_by, '00000000-0000-4000-8000-000000000004'::uuid, 'RF-02: queda quién registró');
select ok((pg_temp.row('mine')).result_at is not null, 'RF-02: y cuándo');
select is(pg_temp.report('mine', '14'), 'ok', 'H1.1: el auxiliar puede cambiar lo que él mismo registró');
select is(pg_temp.report('mine_admin', 'null', 'true'), 'ok', 'H1.2: marca «Hecho» en una tarea sin meta');
select is((pg_temp.row('mine_admin')).done, true, 'H1.2: done = true');
select is(pg_temp.report('mine_past', '5'), 'forbidden:', 'H1.3: su tarea de ayer se rechaza');
select is(pg_temp.report('other', '5'), 'forbidden:', 'H1.3: la tarea de otra persona se rechaza');
select is(pg_temp.report('mine', '10000'), 'invalid_input:result', 'H1.5: captados fuera de rango');
select is(pg_temp.report('mine', '3', 'null', quote_literal(repeat('x', 301))), 'invalid_input:notes',
  'H1.5: observaciones de más de 300 caracteres');
select is(pg_temp.listed('mine', 'result_by_name'), 'Auxiliar Verdolago', 'RF-04: org_list devuelve el nombre de quien registró');
select is(pg_temp.listed('mine_admin', 'done'), 'true', 'RF-04: org_list devuelve done');
select tests.logout();

select tests.login_as('00000000-0000-4000-8000-000000000006');
select is(pg_temp.report('mine', '5'), 'forbidden:', 'H1.4: la volantera no puede');
select tests.logout();

-- ===================== H2 · El encargado ve y corrige ==============================================================
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(pg_temp.listed('mine', 'result'), '14', 'H2.1: el encargado ve lo que registró el auxiliar');
select is(pg_temp.report('mine', '9'), 'ok', 'H2.1: el encargado corrige');
select is((pg_temp.row('mine')).result_by, '00000000-0000-4000-8000-000000000003'::uuid, 'D5: ahora registró el encargado');
select is(pg_temp.report('mine_past', '7'), 'forbidden:', 'RF-02: el encargado sigue sin poder en días pasados (spec 032)');
select tests.logout();

select tests.login_as('00000000-0000-4000-8000-000000000004');
select is(pg_temp.listed('mine', 'can_set_result'), 'false', 'H2.2: sin botón tras la corrección del encargado');
select is(pg_temp.report('mine', '20'), 'result_locked:', 'H2.2: la base rechaza con result_locked');
select tests.logout();

select tests.login_as('00000000-0000-4000-8000-000000000003');
select is(pg_temp.report('mine', 'null', 'null'), 'ok', 'H2.3: el encargado borra todo el resultado');
select is((pg_temp.row('mine')).result_by, null::uuid, 'H2.3: sin resultado no hay quién registró');
select tests.logout();

select tests.login_as('00000000-0000-4000-8000-000000000004');
select is(pg_temp.report('mine', '11'), 'ok', 'H2.3: el auxiliar vuelve a poder registrar');
select tests.logout();

-- RF-03: la org_set_result vieja (app publicada) también anota quién registró y bloquea al auxiliar.
select tests.login_as('00000000-0000-4000-8000-000000000005');
select is(pg_temp.try(format('select public.org_set_result(%L::uuid, 8, null, null)', (select id from ids where name = 'mine'))),
  'ok', 'RF-03: el supervisor usa la versión de 4 argumentos');
select is((pg_temp.row('mine')).result_by, '00000000-0000-4000-8000-000000000005'::uuid, 'RF-03: queda el supervisor como quien registró');
select tests.logout();

select tests.login_as('00000000-0000-4000-8000-000000000004');
select is(pg_temp.report('mine', '11'), 'result_locked:', 'RF-03: el auxiliar ya no lo cambia');
select tests.logout();

select tests.login_as('00000000-0000-4000-8000-000000000009');
select is(pg_temp.report('mine_past', '6'), 'ok', 'RF-02: el jefe de ventas registra días pasados');
select tests.logout();

select * from finish();
rollback;
