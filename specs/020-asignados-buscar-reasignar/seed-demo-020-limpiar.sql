-- Borra SOLO los 8 clientes «Demo 020 …» de seed-demo-020.sql y todo su historial (contactos, asignaciones,
-- etapas y auditoría), incluido lo que se haya hecho con ellos al probar (reasignar, registrar contactos).
-- No toca ningún otro dato. SOLO base LOCAL:
--   docker exec -i supabase_db_riber-captacion psql -U postgres -v ON_ERROR_STOP=1 -q < specs/020-asignados-buscar-reasignar/seed-demo-020-limpiar.sql
-- Las tablas de historial son inmutables (constitución III): se desactiva la protección solo durante el borrado.

begin;
create temp table demo_ids on commit drop as
  select id from public.prospects
  where id between '01900000-0000-7000-8000-000000020001' and '01900000-0000-7000-8000-000000020008';

alter table public.followups disable trigger followups_immutable;
alter table public.assignment_events disable trigger assignment_events_immutable;
alter table public.stage_events disable trigger stage_events_immutable;
alter table public.audit_log disable trigger audit_log_immutable;

delete from public.followups where prospect_id in (select id from demo_ids);
delete from public.assignment_events where prospect_id in (select id from demo_ids);
delete from public.stage_events where prospect_id in (select id from demo_ids);
delete from public.audit_log where table_name = 'prospects' and row_id::text in (select id::text from demo_ids);
delete from public.prospects where id in (select id from demo_ids);

alter table public.followups enable trigger followups_immutable;
alter table public.assignment_events enable trigger assignment_events_immutable;
alter table public.stage_events enable trigger stage_events_immutable;
alter table public.audit_log enable trigger audit_log_immutable;
commit;

select 'Demo 020 restantes: ' || count(*) from public.prospects where full_name like 'Demo 020 %';
