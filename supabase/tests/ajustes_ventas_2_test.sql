begin;
select plan(56);

-- Spec 006: observaciones al crear, orden por persona, volanteras, marcas al agregar subcanal, catálogo y
-- verificación de compartidas por Cobros (20261118002000 y 20261118002100).
-- Usuarios del seed: 1 admin, 2 gerente, 3 enc.verdolago (5), 4 aux.verdolago (5), 6 vol.verdolago (5),
-- 7 enc.trinidad (7), 8 vol.trinidad (7). De prueba: c1 Cobros de Verdolago, c2 Cobros sin sucursales,
-- b1 volantera de Verdolago (se da de baja), b2 «Aaa» de Verdolago (para el orden por persona).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', x.id::uuid, 'authenticated', 'authenticated', x.u || '@captacion.riberbulma.local', now(), now()
from (values ('00000000-0000-4000-8000-0000000000c1', 'cobros.t1'), ('00000000-0000-4000-8000-0000000000c2', 'cobros.t2'),
             ('00000000-0000-4000-8000-0000000000b1', 'vol.t1'), ('00000000-0000-4000-8000-0000000000b2', 'vol.t2')) as x(id, u);
insert into public.profiles (id, username, full_name, role, branch_id, contract_type) values
  ('00000000-0000-4000-8000-0000000000c1', 'cobros.t1', 'Cobros Verdolago', 'collections', null, 'permanent'),
  ('00000000-0000-4000-8000-0000000000c2', 'cobros.t2', 'Cobros Sin Sucursal', 'collections', null, 'permanent'),
  ('00000000-0000-4000-8000-0000000000b1', 'vol.t1', 'Volantera Baja', 'field_volunteer', 5, 'temporary'),
  ('00000000-0000-4000-8000-0000000000b2', 'vol.t2', 'Aaa Primera', 'field_volunteer', 5, 'temporary');
insert into public.profile_branches values ('00000000-0000-4000-8000-0000000000c1', 5);

create temp table k as
select (now() at time zone 'America/La_Paz')::date + 1 as tomorrow,
       (select id from public.org_strategies where name = 'Calle') as calle,
       (select id from public.org_strategies where name = 'Tienda') as tienda,
       (select c.id from public.org_channels c join public.org_strategies s on s.id = c.strategy_id
        where s.name = 'Calle' and c.name = 'Activación') as activacion,
       (select id from public.org_channels where name = 'Compartidas y estados') as compartidas,
       (select id from public.org_channels where name = 'Llamadas') as llamadas,
       (select id from public.org_subchannels where name = 'Activaciones en plazas') as plazas,
       (select id from public.org_subchannels where name = 'Compartidas WhatsApp') as sh_wa,
       (select id from public.org_subchannels where name = 'Compartidas redes sociales') as sh_rs,
       (select id from public.org_subchannels where name = 'Llamadas a clientes de pedidos') as pedidos;
grant select on k to authenticated;
create temp table ids (name text, id uuid);
grant all on ids to authenticated;

create function pg_temp.act(extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('branch_id', 5, 'work_date', (select tomorrow from k), 'shift', 'morning',
    'start_time', '10:00', 'end_time', '12:00', 'profile_id', '00000000-0000-4000-8000-000000000004',
    'strategy_id', (select calle from k), 'channel_id', (select activacion from k),
    'subchannel_id', (select plazas from k), 'place', 'Plaza principal', 'goal', 30) || extra
$$;
grant execute on function pg_temp.act(jsonb) to authenticated;
create function pg_temp.share(p_branch int, p_profile text, extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('branch_id', p_branch, 'work_date', (select tomorrow from k), 'shift', 'morning',
    'start_time', '08:30', 'end_time', '08:45', 'profile_id', p_profile,
    'strategy_id', (select tienda from k), 'channel_id', (select compartidas from k),
    'subchannel_id', (select sh_wa from k), 'share_goal', 15) || extra
$$;
grant execute on function pg_temp.share(int, text, jsonb) to authenticated;
create function pg_temp.row_of(p_id uuid) returns jsonb
language sql as $$
  select r from jsonb_array_elements(public.org_list((select tomorrow - 1 from k), (select tomorrow + 3 from k)) -> 'rows') r
  where r ->> 'id' = p_id::text
$$;
grant execute on function pg_temp.row_of(uuid) to authenticated;
create function pg_temp.id_of(p_name text) returns uuid language sql as $$ select id from ids where name = p_name limit 1 $$;
grant execute on function pg_temp.id_of(text) to authenticated;

-- Catálogo (FR-005 a FR-008) -----------------------------------------------------------------------------
select is(
  (select array_agg(c.name order by c.sort) from public.org_channels c join public.org_strategies s on s.id = c.strategy_id
   where s.name = 'Tienda' and c.name in ('Creación de contenido', 'Atención en tienda y venta', 'Seguimiento de contactos de la app')
     and c.active and not c.uses_goal and not c.uses_share_goal),
  array['Creación de contenido', 'Atención en tienda y venta', 'Seguimiento de contactos de la app'], 'Tienda: 3 canales nuevos sin metas');
select ok((select bool_and(active and not uses_goal and uses_share_goal and to_char(morning_start, 'HH24:MI') = '08:30')
  from public.org_subchannels where id in ((select sh_wa from k), (select sh_rs from k))),
  'compartidas WhatsApp y redes sociales: solo compartidas, horario del genérico');
select ok(not (select active from public.org_subchannels where name = 'Compartidas y estados'), 'el genérico queda desactivado');
select is((select to_char(morning_start, 'HH24:MI') || '-' || to_char(morning_end, 'HH24:MI') || ' ' ||
  to_char(afternoon_start, 'HH24:MI') || '-' || to_char(afternoon_end, 'HH24:MI') from public.org_subchannels where id = (select plazas from k)),
  '10:00-12:00 16:30-18:30', 'Activaciones en plazas con su horario');
select is((select array_agg(name order by sort) from public.org_channels where uses_flyers), array['Negociación', 'Activación'],
  'solo Negociación y Activación piden volanteras');

-- Observaciones al crear y al editar (FR-002) -----------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
insert into ids select 'notes', public.org_save(pg_temp.act(jsonb_build_object('notes', '  Llevar banner  ')));
select is(pg_temp.row_of(pg_temp.id_of('notes')) ->> 'notes', 'Llevar banner', 'la observación se guarda al crear (recortada)');
select public.org_save(pg_temp.act(jsonb_build_object('id', pg_temp.id_of('notes'), 'goal', 25)));
select is(pg_temp.row_of(pg_temp.id_of('notes')) ->> 'notes', 'Llevar banner', 'al editar sin notes se conserva (app publicada)');
select public.org_save(pg_temp.act(jsonb_build_object('id', pg_temp.id_of('notes'), 'notes', 'Cambio')));
select is(pg_temp.row_of(pg_temp.id_of('notes')) ->> 'notes', 'Cambio', 'al editar con notes se cambia');
select public.org_save(pg_temp.act(jsonb_build_object('id', pg_temp.id_of('notes'), 'notes', '')));
select ok(pg_temp.row_of(pg_temp.id_of('notes')) ->> 'notes' is null, 'notes vacía la borra');
select throws_ok(format($$ select public.org_save(%L) $$, pg_temp.act(jsonb_build_object('notes', repeat('x', 301)))),
  'P0001', 'invalid_input', 'más de 300 caracteres rechazado');
select public.org_set_result(pg_temp.id_of('notes'), 10, 'Desde resultado', null);
select is(pg_temp.row_of(pg_temp.id_of('notes')) ->> 'notes', 'Desde resultado', '«Resultado» la sigue pudiendo cambiar');

-- Volanteras (FR-008 a FR-010) ---------------------------------------------------------------------------
insert into ids select 'flyers', public.org_save(pg_temp.act(jsonb_build_object('flyer_ids', jsonb_build_array(
  '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000006'))));
select is(jsonb_array_length(pg_temp.row_of(pg_temp.id_of('flyers')) -> 'flyer_ids'), 2, 'guarda volanteras de la sucursal sin repetir');
select is((select array_agg(f ->> 'name' order by f ->> 'name') from jsonb_array_elements(pg_temp.row_of(pg_temp.id_of('flyers')) -> 'flyers') f),
  array['Volantera Baja', 'Volantera Verdolago'], 'org_list devuelve los nombres');
select ok((pg_temp.row_of(pg_temp.id_of('flyers')) ->> 'uses_flyers')::boolean, 'org_list devuelve uses_flyers');
select throws_ok(format($$ select public.org_save(%L) $$, pg_temp.act(jsonb_build_object('flyer_ids',
  jsonb_build_array('00000000-0000-4000-8000-000000000008')))), 'P0001', 'invalid_input', 'volantera de otra sucursal rechazada');
select throws_ok(format($$ select public.org_save(%L) $$, pg_temp.act(jsonb_build_object('flyer_ids',
  jsonb_build_array('00000000-0000-4000-8000-000000000004')))), 'P0001', 'invalid_input', 'quien no es volantera rechazada');
select throws_ok(format($$ select public.org_save(%L) $$, pg_temp.act(jsonb_build_object('flyer_ids', '"x"'::jsonb))),
  'P0001', 'invalid_input', 'flyer_ids que no es arreglo rechazado');
select throws_ok(format($$ select public.org_save(%L) $$, pg_temp.act(jsonb_build_object('flyer_ids', jsonb_build_array('no-uuid')))),
  'P0001', 'invalid_input', 'id inválido rechazado');
insert into ids select 'no_flyers', public.org_save(jsonb_build_object('branch_id', 5, 'work_date', (select tomorrow from k),
  'shift', 'afternoon', 'profile_id', '00000000-0000-4000-8000-000000000004', 'strategy_id', (select tienda from k),
  'channel_id', (select llamadas from k), 'subchannel_id', (select pedidos from k), 'goal', 5,
  'flyer_ids', jsonb_build_array('00000000-0000-4000-8000-000000000006')));
select is(pg_temp.row_of(pg_temp.id_of('no_flyers')) -> 'flyer_ids', '[]'::jsonb, 'canal que no las pide: se vacía');

-- Baja de una volantera: sigue en la vieja; no se puede agregar a una nueva; la copia la omite.
select tests.logout();
update public.profiles set active = false, deactivated_at = now() where id = '00000000-0000-4000-8000-0000000000b1';
select tests.login_as('00000000-0000-4000-8000-000000000003');
select public.org_save(pg_temp.act(jsonb_build_object('id', pg_temp.id_of('flyers'), 'goal', 31)));
select is(jsonb_array_length(pg_temp.row_of(pg_temp.id_of('flyers')) -> 'flyer_ids'), 2, 'al editar sin flyer_ids se conservan (también la de baja)');
select lives_ok(format($$ select public.org_save(%L) $$, pg_temp.act(jsonb_build_object('id', pg_temp.id_of('flyers'),
  'flyer_ids', jsonb_build_array('00000000-0000-4000-8000-0000000000b1')))), 'al editar se acepta la de baja que ya estaba');
select public.org_save(pg_temp.act(jsonb_build_object('id', pg_temp.id_of('flyers'), 'goal', 31, 'flyer_ids',
  jsonb_build_array('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-0000000000b1'))));
select throws_ok(format($$ select public.org_save(%L) $$, pg_temp.act(jsonb_build_object('flyer_ids',
  jsonb_build_array('00000000-0000-4000-8000-0000000000b1')))), 'P0001', 'invalid_input', 'una volantera de baja no se agrega a una nueva');

-- Carga múltiple: notes y flyer_ids van a todas.
insert into ids select 'many', unnest(public.org_save_many(pg_temp.act(jsonb_build_object('notes', 'Todas', 'subchannel_id', null,
  'flyer_ids', jsonb_build_array('00000000-0000-4000-8000-000000000006'), 'items', jsonb_build_array(
    jsonb_build_object('subchannel_id', (select plazas from k), 'goal', 10),
    jsonb_build_object('subchannel_id', (select id from public.org_subchannels where name = 'Activaciones en barrios'), 'goal', 20))))));
select ok((select bool_and(pg_temp.row_of(id) ->> 'notes' = 'Todas' and jsonb_array_length(pg_temp.row_of(id) -> 'flyer_ids') = 1)
  from ids where name = 'many'), 'carga múltiple: observación y volanteras en todas');

-- Copia de día: solo las volanteras activas; sin observaciones.
select public.org_copy_day(5::smallint, (select tomorrow from k), (select tomorrow + 2 from k));
select tests.logout();
select is((select flyer_ids from public.org_assignments where work_date = (select tomorrow + 2 from k) and branch_id = 5
  and place = 'Plaza principal' and goal = 31 and subchannel_id = (select plazas from k)),
  array['00000000-0000-4000-8000-000000000006']::uuid[], 'la copia lleva solo las volanteras que siguen activas');
select ok((select bool_and(notes is null) from public.org_assignments where work_date = (select tomorrow + 2 from k) and branch_id = 5),
  'la copia no lleva observaciones');

-- Orden por persona (FR-003): «Aaa Primera» a las 14:00 va antes que la auxiliar de las 10:00.
select tests.login_as('00000000-0000-4000-8000-000000000003');
insert into ids select 'aaa', public.org_save(pg_temp.act(jsonb_build_object('shift', 'afternoon', 'start_time', '14:00', 'end_time', '15:00',
  'profile_id', '00000000-0000-4000-8000-0000000000b2')));
select is(public.org_list((select tomorrow from k), (select tomorrow from k), array[5::smallint]) -> 'rows' -> 0 ->> 'person', 'Aaa Primera',
  'ordena por persona antes que por turno y hora');
select ok((select bool_and(ok) from (
  select (lag(r ->> 'person') over (order by n) is null or lag(r ->> 'person') over (order by n) <= r ->> 'person'
          or lag(r ->> 'branch') over (order by n) <> r ->> 'branch') as ok
  from jsonb_array_elements(public.org_list((select tomorrow from k), (select tomorrow from k), array[5::smallint]) -> 'rows')
    with ordinality as t(r, n)) x), 'las filas de cada persona van juntas');

-- Subcanal agregado: marcas de su canal (FR-004)
select is((public.org_add_subchannel(5::smallint, (select compartidas from k), 'Compartidas TikTok prueba') ->> 'existed')::boolean, false,
  'agrega un subcanal en Compartidas y estados');
select tests.logout();
select ok((select not uses_goal and uses_share_goal from public.org_subchannels where name = 'Compartidas TikTok prueba'),
  'el subcanal agregado toma las marcas del canal (solo compartidas)');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select public.org_add_subchannel(5::smallint, (select activacion from k), 'Activaciones en ferias prueba');
select tests.logout();
select ok((select uses_goal and not uses_share_goal from public.org_subchannels where name = 'Activaciones en ferias prueba'),
  'en Activación: solo captación, como su canal');

-- Verificación de compartidas (FR-011 a FR-015) ------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000003');
insert into ids select 'sh5', public.org_save(pg_temp.share(5, '00000000-0000-4000-8000-000000000004'));
select public.org_set_result(pg_temp.id_of('sh5'), null, '', 15);
select tests.login_as('00000000-0000-4000-8000-000000000007');
insert into ids select 'sh7', public.org_save(pg_temp.share(7, '00000000-0000-4000-8000-000000000008'));

select tests.login_as('00000000-0000-4000-8000-0000000000c1');
select ok((select bool_and(r ->> 'branch_id' = '5') and bool_or(r ->> 'id' = pg_temp.id_of('sh5')::text)
  from jsonb_array_elements(public.org_share_list((select tomorrow from k), (select tomorrow from k)) -> 'rows') r),
  'Cobros lista las compartidas de su sucursal');
select ok(not exists (select 1 from jsonb_array_elements(public.org_share_list((select tomorrow from k), (select tomorrow from k)) -> 'rows') r
  where r ->> 'share_goal' is null and r ->> 'share_result' is null), 'solo filas con meta o resultado de compartidas');
select is(public.org_share_list((select tomorrow from k), (select tomorrow from k)) -> 'branches' -> 0 ->> 'name', 'VERDOLAGO',
  'devuelve sus sucursales');
select throws_ok(format($$ select public.org_share_list(%L::date, %L::date, array[7::smallint]) $$, (select tomorrow from k), (select tomorrow from k)),
  'P0001', 'forbidden', 'Cobros no lista otra sucursal');
select throws_ok(format($$ select public.org_share_list(%L::date, %L::date) $$, (select tomorrow from k), (select tomorrow + 31 from k)),
  'P0001', 'invalid_input', 'rango de más de 31 días rechazado');
select lives_ok(format($$ select public.org_verify_shares(%L, 12, '  Faltan 3  ') $$, pg_temp.id_of('sh5')), 'Cobros verifica en su sucursal');
select throws_ok(format($$ select public.org_verify_shares(%L, 5, null) $$, pg_temp.id_of('sh7')), 'P0001', 'forbidden',
  'Cobros no verifica en otra sucursal');
select throws_ok(format($$ select public.org_verify_shares(%L, 10000, null) $$, pg_temp.id_of('sh5')), 'P0001', 'invalid_input',
  'cantidad fuera de rango rechazada');
select throws_ok(format($$ select public.org_verify_shares(%L, 5, %L) $$, pg_temp.id_of('sh5'), repeat('x', 301)), 'P0001', 'invalid_input',
  'comentario de más de 300 rechazado');
select throws_ok($$ select public.org_verify_shares('00000000-0000-4000-8000-0000000000ff', 5, null) $$, 'P0001', 'not_found', 'asignación inexistente');
select throws_ok(format($$ select public.org_list(%L::date, %L::date) $$, (select tomorrow from k), (select tomorrow from k)),
  'P0001', 'forbidden', 'Cobros no ve la Planificación');
select throws_ok($$ select public.org_staff(5::smallint) $$, 'P0001', 'forbidden', 'Cobros no ve el personal');
select is((select count(*)::int from public.prospects), 0, 'Cobros no lee captaciones (RLS)');

select tests.login_as('00000000-0000-4000-8000-000000000003');
select is((select (r ->> 'share_verified') || '|' || (r ->> 'share_verified_note') || '|' || (r ->> 'share_verified_by_name') || '|' || (r ->> 'share_result')
  from pg_temp.row_of(pg_temp.id_of('sh5')) r), '12|Faltan 3|Cobros Verdolago|15', 'la Planificación muestra reportado y verificado con quién');
select ok(pg_temp.row_of(pg_temp.id_of('sh5')) ->> 'share_verified_at' is not null, 'con fecha de verificación');
select throws_ok(format($$ select public.org_verify_shares(%L, 15, null) $$, pg_temp.id_of('sh5')), 'P0001', 'forbidden',
  'el encargado no verifica');
select throws_ok(format($$ select public.org_share_list(%L::date, %L::date) $$, (select tomorrow from k), (select tomorrow from k)),
  'P0001', 'forbidden', 'el encargado no lista para verificar');
select public.org_set_result(pg_temp.id_of('sh5'), null, '', 18);
select is((select (r ->> 'share_verified') || '/' || (r ->> 'share_result') from pg_temp.row_of(pg_temp.id_of('sh5')) r), '12/18',
  'si cambia el resultado, la verificación se mantiene');

select tests.login_as('00000000-0000-4000-8000-000000000002');
select lives_ok(format($$ select public.org_verify_shares(%L, 4, 'Gerencia') $$, pg_temp.id_of('sh7')), 'el gerente verifica en cualquier sucursal');
select public.org_verify_shares(pg_temp.id_of('sh7'), null, 'ignorado');
select tests.logout();
select ok((select share_verified is null and share_verified_note is null and share_verified_by is null and share_verified_at is null
  from public.org_assignments where id = (select id from ids where name = 'sh7')), 'nulo borra la verificación');

select tests.login_as('00000000-0000-4000-8000-0000000000c2');
select is(public.org_share_list((select tomorrow from k), (select tomorrow from k)), '{"rows": [], "branches": []}'::jsonb,
  'Cobros sin sucursales no ve nada');

-- admin_set_collections (solo Sistemas) -------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.admin_set_collections('00000000-0000-4000-8000-0000000000c2', array[7::smallint]) $$,
  'P0001', 'forbidden', 'el gerente no asigna el rol');
select tests.login_as('00000000-0000-4000-8000-000000000001');
select public.admin_set_collections('00000000-0000-4000-8000-0000000000b2', array[5::smallint, 7::smallint, 7::smallint]);
select tests.logout();
select ok((select role = 'collections' and branch_id is null from public.profiles where id = '00000000-0000-4000-8000-0000000000b2')
  and (select array_agg(branch_id order by branch_id) from public.profile_branches where profile_id = '00000000-0000-4000-8000-0000000000b2')
    = array[5, 7]::smallint[], 'Sistemas hace Cobros: rol, sin sucursal propia y sus sucursales');
select tests.login_as('00000000-0000-4000-8000-000000000001');
select public.admin_set_collections('00000000-0000-4000-8000-0000000000b2', array[7::smallint]);
select tests.logout();
select is((select array_agg(branch_id) from public.profile_branches where profile_id = '00000000-0000-4000-8000-0000000000b2'),
  array[7]::smallint[], 'reemplaza las sucursales');
select tests.login_as('00000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.admin_set_collections('00000000-0000-4000-8000-0000000000b2', '{}') $$,
  'P0001', 'invalid_input', 'sin sucursales rechazado');
select throws_ok($$ select public.admin_set_collections('00000000-0000-4000-8000-000000000001', array[5::smallint]) $$,
  'P0001', 'invalid_input', 'no a sí mismo');

select * from finish();
rollback;
