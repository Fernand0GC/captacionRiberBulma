-- Datos de prueba de la spec 020 (SOLO base LOCAL). Agrega 8 clientes «Demo 020 …» en Verdolago (sucursal 5),
-- asignados HOY por el Encargado Verdolago. No borra ni cambia nada existente; se puede correr varias veces.
-- Aplicar:
--   docker exec -i supabase_db_riber-captacion psql -U postgres -v ON_ERROR_STOP=1 -q < specs/020-asignados-buscar-reasignar/seed-demo-020.sql
-- Quitar:  seed-demo-020-limpiar.sql (borra solo estos 8 clientes y su historial)
--
-- Auxiliar Verdolago (aux.verdolago):
--   Ana Quispe, Beto Mamani, Carla Pérez, José Ñuflo → sin contactar (se pueden reasignar desde el modal)
--   Elena Rojas  → la llamó, no contestó (Recaptación)     · ya contactada: sin casilla
--   Fabio Vargas → mensaje, visitará la tienda (Seguimiento) · ya contactado: sin casilla
-- Supervisor Verdolago (sup.verdolago):
--   Gina Torrez, Hugo Flores → sin contactar (para la lupa de Mis contactos del supervisor)
-- Celulares 70200001 … 70200008 (el último dígito = número del cliente).

begin;

-- Personas del seed: 03 encargado, 04 auxiliar, 05 supervisor, 06 volantera (todos de Verdolago).
with c(n, name, stage, owner) as (
  values
    (1, 'Demo 020 Ana Quispe',   'capture',   '00000000-0000-4000-8000-000000000004'),
    (2, 'Demo 020 Beto Mamani',  'capture',   '00000000-0000-4000-8000-000000000004'),
    (3, 'Demo 020 Carla Pérez',  'capture',   '00000000-0000-4000-8000-000000000004'),
    (4, 'Demo 020 José Ñuflo',   'capture',   '00000000-0000-4000-8000-000000000004'),
    (5, 'Demo 020 Elena Rojas',  'recapture', '00000000-0000-4000-8000-000000000004'),
    (6, 'Demo 020 Fabio Vargas', 'followup',  '00000000-0000-4000-8000-000000000004'),
    (7, 'Demo 020 Gina Torrez',  'capture',   '00000000-0000-4000-8000-000000000005'),
    (8, 'Demo 020 Hugo Flores',  'capture',   '00000000-0000-4000-8000-000000000005')
)
insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
  stage, assigned_to, contact_attempts, next_contact_at, visit_at)
select ('01900000-0000-7000-8000-00000002000' || c.n)::uuid, c.name,
       '7020 000' || c.n, '7020000' || c.n, 5, '00000000-0000-4000-8000-000000000006',
       now() - interval '1 day', 'morning', c.stage::public.prospect_stage, c.owner::uuid,
       case when c.n = 5 then 1 else 0 end,
       case when c.n in (5, 6) then now() + interval '1 day' end,
       case when c.n = 6 then now() + interval '1 day' end
from c
on conflict (id) do nothing;

-- Asignación de hoy (hace 2 horas), hecha por el encargado: es lo que cuenta «Asignados» en Actividad.
insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at)
select p.id, null, p.assigned_to, '00000000-0000-4000-8000-000000000003', now() - interval '2 hours'
from public.prospects p
where p.id between '01900000-0000-7000-8000-000000020001' and '01900000-0000-7000-8000-000000020008'
  and not exists (select 1 from public.assignment_events e where e.prospect_id = p.id);

-- Contactos de la auxiliar (hace 1 hora) y su cambio de etapa.
insert into public.followups (id, prospect_id, contacted_at, result, method, effective, note, visit_at, actor_id) values
  ('01900000-0000-7000-8000-000000020105', '01900000-0000-7000-8000-000000020005', now() - interval '1 hour',
   'no_answer', 'whatsapp_call', false, null, null, '00000000-0000-4000-8000-000000000004'),
  ('01900000-0000-7000-8000-000000020106', '01900000-0000-7000-8000-000000020006', now() - interval '1 hour',
   'visit_store', 'message', true, 'Viene mañana con su esposa', now() + interval '1 day', '00000000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

insert into public.stage_events (prospect_id, from_stage, to_stage, actor_id, created_at)
select x.pid::uuid, 'capture', x.to_stage::public.prospect_stage, '00000000-0000-4000-8000-000000000004', now() - interval '1 hour'
from (values ('01900000-0000-7000-8000-000000020005', 'recapture'),
             ('01900000-0000-7000-8000-000000020006', 'followup')) x(pid, to_stage)
where not exists (select 1 from public.stage_events s where s.prospect_id = x.pid::uuid);

commit;

select 'Demo 020: ' || count(*) || ' clientes' from public.prospects where full_name like 'Demo 020 %';
