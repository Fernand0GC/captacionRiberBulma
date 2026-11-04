begin;
select plan(8);

-- Seed: enc.verdolago (…03, sucursal 5), vol.verdolago (…06, 5), enc.trinidad (…07, 7), vol.trinidad (…08, 7),
-- jefe.ventas (…09, sucursales 5 y 7), volantero (…06) sin permisos de gestión.
select tests.login_as('00000000-0000-4000-8000-000000000003');
select ok((select bool_and(m ->> 'username' <> 'vol.trinidad') from jsonb_array_elements(public.team_members(null)) m),
  'el encargado ve su sucursal (sin pedirla)');
select ok(exists (select 1 from jsonb_array_elements(public.team_members(5::smallint)) m where m ->> 'username' = 'vol.verdolago'),
  've a su volantera');
select ok((select bool_and(m ->> 'username' not in ('aux.verdolago', 'sup.verdolago', 'enc.verdolago'))
           from jsonb_array_elements(public.team_members(5::smallint)) m),
  'solo volanteras (no auxiliares ni supervisores)');
select throws_ok($$select public.team_members(7::smallint)$$, 'P0001', 'forbidden', 'otra sucursal: prohibido');
select ok((select (m ? 'today') and (m ? 'total') and (m ? 'last_capture_at')
           from jsonb_array_elements(public.team_members(5::smallint)) m limit 1), 'trae la actividad de cada una');

select tests.login_as('00000000-0000-4000-8000-000000000009');
select ok(exists (select 1 from jsonb_array_elements(public.team_members(7::smallint)) m where m ->> 'username' = 'vol.trinidad'),
  'el jefe ve las volanteras de sus sucursales');

select tests.login_as('00000000-0000-4000-8000-000000000006');
select throws_ok($$select public.team_members(5::smallint)$$, 'P0001', 'forbidden', 'una volantera no gestiona equipo');

select tests.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$select public.team_members(null)$$, 'P0001', 'invalid_input', 'gerencia tiene que elegir sucursal');

select * from finish();
rollback;
