-- Limpia SOLO datos de prueba de la base LOCAL: captaciones, contactos, asignaciones, eventos y los usuarios
-- que crean las pruebas E2E (vol.e2e…). NO toca catálogos (canales, productos, sucursales, motivos) ni los usuarios del seed.
-- Uso: pnpm db:clean   (nunca contra producción)
-- Las tablas de historial son inmutables (constitución III); aquí se desactiva la protección solo durante la limpieza local.
begin;
alter table public.followups disable trigger followups_immutable;
alter table public.assignment_events disable trigger assignment_events_immutable;
alter table public.stage_events disable trigger stage_events_immutable;
alter table public.audit_log disable trigger audit_log_immutable;
delete from public.followups;
delete from public.assignment_events;
delete from public.stage_events;
delete from public.audit_log where table_name in ('prospects', 'profiles');
alter table public.followups enable trigger followups_immutable;
alter table public.assignment_events enable trigger assignment_events_immutable;
alter table public.stage_events enable trigger stage_events_immutable;
alter table public.audit_log enable trigger audit_log_immutable;
update public.prospects set duplicate_of = null where duplicate_of is not null;
delete from public.prospects;
delete from public.rate_limits;
delete from public.profiles where username like 'vol.e2e%';
delete from auth.users where email like 'vol.e2e%@captacion.riberbulma.local';
commit;
select 'captaciones: ' || (select count(*) from public.prospects) || ' · usuarios: ' || (select count(*) from public.profiles)
       || ' · canales: ' || (select count(*) from public.channels where active) as estado;
