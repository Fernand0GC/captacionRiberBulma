begin;
select plan(13);

-- Catálogo inicial de la planilla de ventas
select is((select count(*)::int from public.org_strategies), 2, '2 estrategias');
-- Desde la 006 (20261118002100): 3 canales nuevos de Tienda y 3 subcanales (2 de compartidas y Activaciones en plazas).
select is((select count(*)::int from public.org_channels), 14, '14 canales (10 de la planilla + Tareas administrativas + 3 de la 006)');
-- Solo el catálogo de Sistemas: los que agrega ventas desde el formulario (004, added_by) no cuentan.
select is((select count(*)::int from public.org_subchannels where added_by is null), 37, '37 subcanales (34 + 3 de la 006)');
select is(
  (select array_agg(c.name order by c.sort) from public.org_channels c join public.org_strategies s on s.id = c.strategy_id where s.name = 'Calle'),
  array['Negociación', 'Activación', 'Volantes'], 'Calle tiene sus 3 canales en orden');
select is(
  (select to_char(afternoon_start, 'HH24:MI') || '-' || to_char(afternoon_end, 'HH24:MI') from public.org_subchannels where name = 'Activaciones en barrios'),
  '16:30-18:30', 'horario de tarde sugerido');
select ok(
  (select afternoon_start is null and morning_start is not null from public.org_subchannels where name = 'Activaciones instituciones'),
  'subcanal sin horario de tarde');

-- Marcas: Tienda no pide ubicación; Mensajería, Comentarios y Tareas administrativas no llevan meta de captación.
-- Desde la 004 (20261118000100), Compartidas y estados lleva solo meta de compartidas.
select is(
  (select array_agg(name order by sort) from public.org_strategies where uses_place), array['Calle'], 'solo Calle pide ubicación');
select is(
  (select array_agg(name order by sort) from public.org_channels where not uses_goal),
  array['RRSS-Mensajería', 'Comentarios', 'Compartidas y estados', 'Tareas administrativas', 'Creación de contenido',
    'Atención en tienda y venta', 'Seguimiento de contactos de la app'], 'canales sin meta de captación');
select is(
  (select s.name from public.org_channels c join public.org_strategies s on s.id = c.strategy_id where c.name = 'Tareas administrativas'),
  'Tienda', 'Tareas administrativas está en Tienda');
select ok((select uses_goal from public.org_channels where name = 'Llamadas'), 'Llamadas sigue con meta');

-- Nombre repetido dentro del mismo canal
select throws_ok(
  $$ insert into public.org_subchannels (channel_id, name) select channel_id, name from public.org_subchannels where name = 'Freelancers' $$,
  '23505', null, 'no se repite un subcanal en el mismo canal');

-- Solo Sistemas escribe
select tests.login_as('00000000-0000-4000-8000-000000000003'); -- encargado
select throws_ok($$ insert into public.org_strategies (name) values ('Nueva') $$, '42501', null, 'el encargado no cambia el catálogo');
select tests.login_as('00000000-0000-4000-8000-000000000001'); -- admin
select lives_ok($$ update public.org_subchannels set active = false where name = 'Freelancers' $$, 'Sistemas desactiva un subcanal');

select * from finish();
rollback;
