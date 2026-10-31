begin;
select plan(13);

create temp table m (k text primary key, v jsonb);
grant all on m to authenticated;
create temp table d as select (now() at time zone 'America/La_Paz')::date::text as today;
grant select on d to authenticated;

-- Antes (encargado Verdolago, hoy)
select tests.login_as('00000000-0000-4000-8000-000000000003');
insert into m values ('before', public.dashboard_metrics(jsonb_build_object('from', (select today from d))));
insert into m values ('list_before', public.list_prospects(jsonb_build_object('from', (select today from d)), 1));

-- Datos: 3 captaciones (2 Volantes, 1 sin canal); la auxiliar contacta 2: una visita y una venta
select tests.login_as('00000000-0000-4000-8000-000000000006');
select public.submit_capture(jsonb_build_object('id','01900000-0000-7000-8000-000000000401','full_name','Metrica Uno','phone','74000401',
  'channel_id',(select id from public.channels where name = 'Volantes')));
select public.submit_capture(jsonb_build_object('id','01900000-0000-7000-8000-000000000402','full_name','Metrica Dos','phone','74000402',
  'channel_id',(select id from public.channels where name = 'Volantes')));
select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000403","full_name":"Metrica Tres","phone":"74000403"}');
select tests.login_as('00000000-0000-4000-8000-000000000003');
select public.assign_prospects(array['01900000-0000-7000-8000-000000000401','01900000-0000-7000-8000-000000000402']::uuid[], '00000000-0000-4000-8000-000000000004');
select tests.login_as('00000000-0000-4000-8000-000000000004');
select public.add_followup(jsonb_build_object('id','01900000-0000-7000-8000-000000000411','prospect_id','01900000-0000-7000-8000-000000000401',
  'result','visit_store','visit_at',(now() + interval '2 hours')::text));
select public.add_followup(jsonb_build_object('id','01900000-0000-7000-8000-000000000412','prospect_id','01900000-0000-7000-8000-000000000402',
  'result','sold','product_id',(select id from public.products where name = 'Celulares')));
select public.add_followup('{"id":"01900000-0000-7000-8000-000000000413","prospect_id":"01900000-0000-7000-8000-000000000401","result":"no_answer"}');

select tests.login_as('00000000-0000-4000-8000-000000000003');
insert into m values ('after', public.dashboard_metrics(jsonb_build_object('from', (select today from d))));
insert into m values ('list_after', public.list_prospects(jsonb_build_object('from', (select today from d)), 1));

create temp view delta as
  select key, (a.v -> 'kpis' ->> key)::int - (b.v -> 'kpis' ->> key)::int as n
  from m a, m b, jsonb_object_keys((select v -> 'kpis' from m where k = 'after')) key
  where a.k = 'after' and b.k = 'before';
grant select on delta to authenticated;

select is((select n from delta where key = 'captures'), 3, 'kpi: +3 captaciones');
select is((select n from delta where key = 'contacts'), 3, 'kpi: +3 contactos');
select is((select n from delta where key = 'effective'), 2, 'kpi: +2 efectivos (no contestó no cuenta)');
select is((select n from delta where key = 'sales'), 1, 'kpi: +1 venta');
select is((select n from delta where key = 'visits'), 1, 'kpi: +1 visita pactada');
select is((select n from delta where key = 'unassigned'), 1, 'kpi: +1 sin asignar');
select is(((select v -> 'funnel' ->> 'sale' from m where k = 'after')::int - (select v -> 'funnel' ->> 'sale' from m where k = 'before')::int), 1, 'embudo: +1 en venta');
select ok(jsonb_array_length((select v -> 'by_day' from m where k = 'after')) = 1, 'por día: un punto por día del rango');
select ok((select bool_or(x ->> 'name' = 'Auxiliar Verdolago' and (x ->> 'sales')::int >= 1) from jsonb_array_elements((select v -> 'by_agent' from m where k = 'after')) x), 'por auxiliar: la venta cuenta a quien la cerró');
select ok((select v -> 'by_branch' from m where k = 'after') = 'null'::jsonb, 'el encargado no ve comparación entre sucursales');

-- Chips por canal en list_prospects
select is((select (x ->> 'n')::int from jsonb_array_elements((select v -> 'by_channel' from m where k = 'list_after')) x where x ->> 'name' = 'Volantes')
  - coalesce((select (x ->> 'n')::int from jsonb_array_elements((select v -> 'by_channel' from m where k = 'list_before')) x where x ->> 'name' = 'Volantes'), 0),
  2, 'chips: +2 en Volantes');

-- Gerente ve comparación por sucursal; volantero no ve métricas
select tests.login_as('00000000-0000-4000-8000-000000000002');
select ok(jsonb_array_length(public.dashboard_metrics(jsonb_build_object('from', (select today from d))) -> 'by_branch') = 10, 'gerente: las 10 sucursales');
select tests.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.dashboard_metrics('{}') $$, 'P0001', 'forbidden', 'volantero no ve métricas');

select * from finish();
rollback;
