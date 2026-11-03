begin;
select plan(11);

-- Catálogo definitivo de gerencia (2026-11-03)
select is((select array_agg(name order by sort) from public.channels where active and channel_group = 'street'),
  array['Volanteo','Convenio','Activación','Negociación','Freelance','Visita'], 'Calle: 6 canales en orden');
select is((select array_agg(name order by sort) from public.channels where active and channel_group = 'store'),
  array['Marketplace','Messenger','TikTok','Facebook','WhatsApp','Clientes del sistema','Tienda'], 'Tienda: 7 canales en orden');
select is((select count(*)::int from public.channels where active and channel_group is null), 0, 'no hay canales activos sin grupo');
select ok(not exists (select 1 from public.channels where name in ('Volantes', 'Visitas de negociación', 'Convenios', 'Comentarios Facebook')),
  'los equivalentes se renombraron, no quedan duplicados');
select throws_ok($$update public.channels set channel_group = 'online' where name = 'Tienda'$$, '23514', null, 'solo street o store');

-- Captación con descripción del canal
select tests.login_as('00000000-0000-4000-8000-000000000006');
select public.submit_capture(jsonb_build_object('id','01900000-0000-7000-8000-0000000000f1','full_name','Canal Con Lugar','phone','76000091',
  'channel_id',(select id from public.channels where name = 'Convenio'), 'channel_detail','  UAB  '));
-- Captación hecha sin señal con un canal que después se desactivó: no se rechaza
select is(public.submit_capture(jsonb_build_object('id','01900000-0000-7000-8000-0000000000f2','full_name','Canal Viejo','phone','76000092',
  'channel_id',(select id from public.channels where name = 'Lives'))) ->> 'result', 'accepted', 'canal desactivado: se acepta igual');
select throws_ok($$select public.submit_capture(jsonb_build_object('id','01900000-0000-7000-8000-0000000000f3','full_name','Canal Falso','phone','76000093','channel_id',9999))$$,
  'P0001', 'invalid_input', 'canal inexistente: se rechaza');

select tests.logout();
select is((select channel_detail from public.prospects where id = '01900000-0000-7000-8000-0000000000f1'), 'UAB', 'la descripción se guarda sin espacios');
select is((select c.channel_group from public.prospects p join public.channels c on c.id = p.channel_id
  where p.id = '01900000-0000-7000-8000-0000000000f1'), 'street', 'la captación queda en Calle');

-- El encargado la encuentra buscando el lugar
select tests.login_as('00000000-0000-4000-8000-000000000003');
select is((public.list_prospects(jsonb_build_object('q','uab')) -> 'rows' -> 0 ->> 'channel_detail'), 'UAB', 'buscar "uab" encuentra por descripción');
select is((public.get_prospect('01900000-0000-7000-8000-0000000000f1') -> 'prospect' ->> 'channel_detail'), 'UAB', 'la ficha muestra la descripción');

select * from finish();
rollback;
