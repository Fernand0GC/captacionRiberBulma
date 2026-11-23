-- Datos de VOLUMEN de la spec 021 (SOLO base LOCAL): 400 clientes «Vol 021 …» de Verdolago asignados a la
-- Auxiliar Verdolago por el Encargado Verdolago en tres días:
--   sábado 21/11 → 100 («Vol 021 Sáb 001…100»)
--   domingo 22/11 → 200 («Vol 021 Dom 101…300»)
--   hoy 23/11     → 100 («Vol 021 Hoy 301…400», entre 08:00 y 09:40)
-- Uno de cada tres lo llamó la auxiliar (no contestó → Recaptación) poco después de asignarse: sirven para el aviso.
-- No borra ni cambia nada existente; se puede correr varias veces.
-- Aplicar:
--   docker exec -i supabase_db_riber-captacion psql -U postgres -v ON_ERROR_STOP=1 -q < specs/021-asignados-depurar/seed-volumen-021.sql
-- Quitar:  seed-volumen-021-limpiar.sql (borra solo estos 400 clientes, su historial y sus marcas de oculto)

begin;

create temp table vol on commit drop as
select n,
       ('01900000-0000-7000-8000-000002210' || lpad(n::text, 3, '0'))::uuid as id,
       'Vol 021 ' || case when n <= 100 then 'Sáb' when n <= 300 then 'Dom' else 'Hoy' end || ' ' || lpad(n::text, 3, '0') as name,
       case when n <= 100 then timestamptz '2026-11-21 10:00-04' + (n - 1) * interval '1 minute'
            when n <= 300 then timestamptz '2026-11-22 10:00-04' + (n - 101) * interval '1 minute'
            else timestamptz '2026-11-23 08:00-04' + (n - 301) * interval '1 minute' end as assigned_at,
       n % 3 = 0 as contacted
from generate_series(1, 400) n;

insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
  stage, assigned_to, contact_attempts, next_contact_at)
select v.id, v.name, '7221 ' || lpad(v.n::text, 4, '0'), '7221' || lpad(v.n::text, 4, '0'), 5,
       '00000000-0000-4000-8000-000000000006', v.assigned_at - interval '1 day', 'morning',
       (case when v.contacted then 'recapture' else 'capture' end)::public.prospect_stage,
       '00000000-0000-4000-8000-000000000004',
       case when v.contacted then 1 else 0 end,
       case when v.contacted then now() + interval '1 day' end
from vol v
on conflict (id) do nothing;

insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at)
select v.id, null, '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', v.assigned_at
from vol v
where not exists (select 1 from public.assignment_events e where e.prospect_id = v.id);

insert into public.followups (id, prospect_id, contacted_at, result, method, effective, note, visit_at, actor_id)
select ('01900000-0000-7000-8000-000002211' || lpad(v.n::text, 3, '0'))::uuid, v.id, v.assigned_at + interval '30 minutes',
       'no_answer', 'call', false, null, null, '00000000-0000-4000-8000-000000000004'
from vol v where v.contacted
on conflict (id) do nothing;

insert into public.stage_events (prospect_id, from_stage, to_stage, actor_id, created_at)
select v.id, 'capture', 'recapture', '00000000-0000-4000-8000-000000000004', v.assigned_at + interval '30 minutes'
from vol v
where v.contacted and not exists (select 1 from public.stage_events s where s.prospect_id = v.id);

commit;

select 'Vol 021: ' || count(*) || ' clientes' from public.prospects where full_name like 'Vol 021 %';
