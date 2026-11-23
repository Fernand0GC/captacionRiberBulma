-- Borra SOLO los 400 clientes «Vol 021 …» de seed-volumen-021.sql y todo su historial (contactos, asignaciones,
-- etapas, auditoría y marcas de oculto), incluido lo que se haya hecho con ellos al probar. No toca otros datos.
-- SOLO base LOCAL:
--   docker exec -i supabase_db_riber-captacion psql -U postgres -v ON_ERROR_STOP=1 -q < specs/021-asignados-depurar/seed-volumen-021-limpiar.sql
-- Las tablas de historial son inmutables (constitución III): se desactiva la protección solo durante el borrado.

begin;
create temp table vol_ids on commit drop as
  select id from public.prospects
  where id between '01900000-0000-7000-8000-000002210001' and '01900000-0000-7000-8000-000002210400';

alter table public.followups disable trigger followups_immutable;
alter table public.assignment_events disable trigger assignment_events_immutable;
alter table public.stage_events disable trigger stage_events_immutable;
alter table public.audit_log disable trigger audit_log_immutable;

delete from public.assigned_hidden where prospect_id in (select id from vol_ids);
delete from public.followups where prospect_id in (select id from vol_ids);
delete from public.assignment_events where prospect_id in (select id from vol_ids);
delete from public.stage_events where prospect_id in (select id from vol_ids);
delete from public.audit_log where table_name = 'prospects' and row_id::text in (select id::text from vol_ids);
delete from public.prospects where id in (select id from vol_ids);

alter table public.followups enable trigger followups_immutable;
alter table public.assignment_events enable trigger assignment_events_immutable;
alter table public.stage_events enable trigger stage_events_immutable;
alter table public.audit_log enable trigger audit_log_immutable;
commit;

select 'Vol 021 restantes: ' || count(*) from public.prospects where full_name like 'Vol 021 %';
