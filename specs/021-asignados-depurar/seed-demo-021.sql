-- Datos de prueba de la spec 021 (SOLO base LOCAL). Agrega 6 clientes «Demo 021 …» en Verdolago (sucursal 5),
-- asignados HOY a la Auxiliar Verdolago por el Encargado Verdolago. No borra ni cambia nada existente; se puede
-- correr varias veces.
-- Aplicar:
--   docker exec -i supabase_db_riber-captacion psql -U postgres -v ON_ERROR_STOP=1 -q < specs/021-asignados-depurar/seed-demo-021.sql
-- Quitar:  seed-demo-021-limpiar.sql (borra solo estos 6 clientes, su historial y sus marcas de oculto)
--
-- Auxiliar Verdolago (aux.verdolago):
--   Irma Choque, Julio Arce   → la llamó, no contestó (Recaptación)  · contactados: los propone el aviso
--   Karen Soria               → mensaje, visitará la tienda (Seguimiento) · contactada
--   Luis Paz, Marta Gil, Nico Vaca → sin contactar (para ocultar a mano uno por uno)
-- Celulares 70210001 … 70210006 (el último dígito = número del cliente).

begin;

-- Personas del seed: 03 encargado, 04 auxiliar, 06 volantera (todos de Verdolago).
with c(n, name, stage) as (
  values
    (1, 'Demo 021 Irma Choque', 'recapture'),
    (2, 'Demo 021 Julio Arce',  'recapture'),
    (3, 'Demo 021 Karen Soria', 'followup'),
    (4, 'Demo 021 Luis Paz',    'capture'),
    (5, 'Demo 021 Marta Gil',   'capture'),
    (6, 'Demo 021 Nico Vaca',   'capture')
)
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
  stage, assigned_to, contact_attempts, next_contact_at, visit_at)
select ('01900000-0000-7000-8000-00000002100' || c.n)::uuid, c.name,
       '7021 000' || c.n, '7021000' || c.n, 5, '00000000-0000-4000-8000-000000000006',
       now() - interval '1 day', 'morning', c.stage::public.prospect_stage, '00000000-0000-4000-8000-000000000004',
       case when c.n in (1, 2) then 1 else 0 end,
       case when c.n in (1, 2, 3) then now() + interval '1 day' end,
       case when c.n = 3 then now() + interval '1 day' end
from c
on conflict (id) do nothing;

-- Asignación de hoy (hace 2 horas), hecha por el encargado: es lo que cuenta «Asignados» en Actividad.
insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at)
select p.id, null, p.assigned_to, '00000000-0000-4000-8000-000000000003', now() - interval '2 hours'
from public.prospects p
where p.id between '01900000-0000-7000-8000-000000021001' and '01900000-0000-7000-8000-000000021006'
  and not exists (select 1 from public.assignment_events e where e.prospect_id = p.id);

-- Contactos de la auxiliar (hace 1 hora) y su cambio de etapa.
insert into public.followups (id, prospect_id, contacted_at, result, method, effective, note, visit_at, actor_id) values
  ('01900000-0000-7000-8000-000000021101', '01900000-0000-7000-8000-000000021001', now() - interval '1 hour',
   'no_answer', 'call', false, null, null, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-000000021102', '01900000-0000-7000-8000-000000021002', now() - interval '1 hour',
   'no_answer', 'whatsapp_call', false, 'se dejó audio', null, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-000000021103', '01900000-0000-7000-8000-000000021003', now() - interval '1 hour',
   'visit_store', 'message', true, 'Pasa el sábado', now() + interval '1 day', '00000000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

insert into public.stage_events (prospect_id, from_stage, to_stage, actor_id, created_at)
select x.pid::uuid, 'capture', x.to_stage::public.prospect_stage, '00000000-0000-4000-8000-000000000004', now() - interval '1 hour'
from (values ('01900000-0000-7000-8000-000000021001', 'recapture'),
             ('01900000-0000-7000-8000-000000021002', 'recapture'),
             ('01900000-0000-7000-8000-000000021003', 'followup')) x(pid, to_stage)
where not exists (select 1 from public.stage_events s where s.prospect_id = x.pid::uuid);

commit;

select 'Demo 021: ' || count(*) || ' clientes' from public.prospects where full_name like 'Demo 021 %';
