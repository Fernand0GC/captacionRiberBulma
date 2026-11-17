begin;
select plan(9);

-- Catálogo inicial de la planilla de ventas
select is((select count(*)::int from public.org_strategies), 2, '2 estrategias');
select is((select count(*)::int from public.org_channels), 10, '10 canales');
select is((select count(*)::int from public.org_subchannels), 34, '34 subcanales');
select is(
  (select array_agg(c.name order by c.sort) from public.org_channels c join public.org_strategies s on s.id = c.strategy_id where s.name = 'Calle'),
  array['Negociación', 'Activación', 'Volantes'], 'Calle tiene sus 3 canales en orden');
select is(
  (select to_char(afternoon_start, 'HH24:MI') || '-' || to_char(afternoon_end, 'HH24:MI') from public.org_subchannels where name = 'Activaciones en barrios'),
  '16:30-18:30', 'horario de tarde sugerido');
select ok(
  (select afternoon_start is null and morning_start is not null from public.org_subchannels where name = 'Activaciones instituciones'),
  'subcanal sin horario de tarde');

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
