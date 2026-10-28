-- Helpers de prueba compartidos. Se cargan primero (orden alfabético) y viven en el esquema tests.
begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

-- Simula una sesión de usuario autenticado.
create or replace function tests.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create or replace function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select plan(1);
select pass('helpers loaded');
select * from finish();
commit;
