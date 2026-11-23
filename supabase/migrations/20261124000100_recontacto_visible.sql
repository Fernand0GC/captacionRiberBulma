-- Spec 023: que las jefas vean la recaptación (el seguimiento de los clientes ya asignados).
-- 1) recontact_agenda (nueva): clientes que pueden estar en la agenda de HOY de cada responsable y el personal del
--    alcance. La app los clasifica con dueStatus, la misma regla de «Mis contactos», así los números coinciden.
-- 2) agent_activity / list_agent_contacts: primer contacto y recontacto (el cliente ya tenía un contacto anterior de
--    cualquier persona; desempate por id cuando dos contactos tienen la misma hora).
-- 3) list_followup_status: f.date_basis = registered (defecto) | assigned | last_contact | next_contact.
-- Parches con pg_temp.patch_function: si el texto esperado no está, falla y no cambia nada; si ya está aplicado, no hace
-- nada. Solo funciones de lectura; sin tablas ni columnas nuevas. Contrato: specs/023-recontacto-visible/contracts/rpc.md

create or replace function pg_temp.patch_function(p_sig text, p_old text, p_new text) returns void language plpgsql as $$
declare
  d text := pg_get_functiondef(p_sig::regprocedure);
begin
  if position(p_old in d) = 0 then
    raise exception 'patch_function: no se encontró el texto en %: %', p_sig, p_old;
  end if;
  execute replace(d, p_old, p_new);
end;
$$;

-- 1) Agenda de recontacto ---------------------------------------------------------------------------------------------
create or replace function public.recontact_agenda(f jsonb default '{}')
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  max_rows constant integer := 5000;
  v_branch smallint;
  v_today date := (now() at time zone tz)::date;
  v_start timestamptz;
  v_after_tomorrow timestamptz;
  v_rows jsonb;
  v_people jsonb;
  v_truncated boolean;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  v_branch := public.scoped_branch(nullif(f ->> 'branch_id', '')::smallint);
  v_start := v_today::timestamp at time zone tz;
  v_after_tomorrow := (v_today + 2)::timestamp at time zone tz;

  -- Superconjunto de las tarjetas de «Mis contactos» (research R3): agendado antes de pasado mañana (incluye la visita
  -- de mañana que se confirma hoy), abierto nunca contactado y sin fecha, o con último contacto hoy (aunque se haya
  -- cerrado hoy). Lo demás sería «más adelante» y no cuenta.
  with cand as (
    select p.id, p.full_name, p.phone_raw, p.stage, p.contact_attempts, p.next_contact_at, p.visit_at,
           p.client_created_at, p.assigned_to, p.branch_id,
           lf.contacted_at as last_contacted_at, lf.result as last_result, lf.method as last_method, lf.note as last_note
    from public.prospects p
    left join lateral (
      select fu.contacted_at, fu.result, fu.method, fu.note from public.followups fu
      where fu.prospect_id = p.id
      order by fu.contacted_at desc, fu.created_at desc
      limit 1
    ) lf on true
    where p.status = 'active' and p.assigned_to is not null
      and (v_branch is null or p.branch_id = v_branch)
      and (
        (p.stage not in ('sale', 'lost') and p.next_contact_at < v_after_tomorrow)
        or (p.stage not in ('sale', 'lost') and p.next_contact_at is null and lf.contacted_at is null)
        or lf.contacted_at >= v_start
      )
  ),
  limited as (
    select c.* from cand c order by c.assigned_to, c.next_contact_at nulls last, c.id limit max_rows + 1
  )
  select
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'full_name', l.full_name, 'phone_raw', l.phone_raw, 'stage', l.stage,
        'contact_attempts', l.contact_attempts, 'next_contact_at', l.next_contact_at, 'visit_at', l.visit_at,
        'client_created_at', l.client_created_at, 'assigned_to', l.assigned_to, 'branch_id', l.branch_id,
        -- Igual que my_contacts: última asignación hacia el responsable; sin evento, la captación.
        'assigned_at', coalesce(ae.created_at, l.client_created_at),
        'reassigned_from_name', fp.full_name,
        'last_contacted_at', l.last_contacted_at, 'last_result', l.last_result,
        'last_method', l.last_method, 'last_note', l.last_note)
        order by l.assigned_to, l.next_contact_at nulls last, l.id)
      from (select * from limited order by assigned_to, next_contact_at nulls last, id limit max_rows) l
      left join lateral (
        select e.created_at, e.from_user from public.assignment_events e
        where e.prospect_id = l.id and e.to_user = l.assigned_to
        order by e.created_at desc limit 1
      ) ae on true
      left join public.profiles fp on fp.id = ae.from_user and ae.from_user <> l.assigned_to
    ), '[]'::jsonb),
    -- Personal fijo del alcance (como Actividad) y cualquier otro responsable con algo en la agenda.
    coalesce((
      select jsonb_agg(jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'role', pr.role, 'branch_id', pr.branch_id)
                       order by pr.full_name)
      from public.profiles pr
      where pr.id in (
        select s.id from public.profiles s
        where s.active and s.role in ('field_assistant', 'field_supervisor', 'branch_manager')
          and s.branch_id is not null and (v_branch is null or s.branch_id = v_branch)
        union
        select c.assigned_to from cand c
      )
    ), '[]'::jsonb),
    (select count(*) > max_rows from limited)
  into v_rows, v_people, v_truncated;

  return jsonb_build_object('today', v_today, 'people', v_people, 'rows', v_rows, 'truncated', v_truncated);
end;
$$;

revoke execute on function public.recontact_agenda(jsonb) from public, anon;
grant execute on function public.recontact_agenda(jsonb) to authenticated;

-- 2) Actividad: primer contacto y recontacto ------------------------------------------------------------------------
do $do$
begin
  if position('recontacts' in pg_get_functiondef('public.agent_activity(jsonb)'::regprocedure)) > 0 then
    raise notice 'agent_activity ya tiene primer contacto / recontacto: no se cambia';
  else
    perform pg_temp.patch_function('public.agent_activity(jsonb)',
      'select fu.id, fu.actor_id, fu.prospect_id, p.branch_id, fu.method, fu.result, fu.effective',
      'select fu.id, fu.actor_id, fu.prospect_id, p.branch_id, fu.method, fu.result, fu.effective,
           exists (select 1 from public.followups f0
                   where f0.prospect_id = fu.prospect_id and (f0.contacted_at, f0.id) < (fu.contacted_at, fu.id)) as recontact');
    perform pg_temp.patch_function('public.agent_activity(jsonb)',
      'count(c.id) as total',
      'count(c.id) filter (where not c.recontact) as first_contacts,
           count(c.id) filter (where c.recontact) as recontacts,
           count(c.id) as total');
  end if;

  if position('''recontact''' in pg_get_functiondef('public.list_agent_contacts(jsonb, integer, integer)'::regprocedure)) > 0 then
    raise notice 'list_agent_contacts ya acepta first/recontact: no se cambia';
  else
    perform pg_temp.patch_function('public.list_agent_contacts(jsonb, integer, integer)',
      '''visits'', ''sales'') then',
      '''visits'', ''sales'', ''first'', ''recontact'') then');
    perform pg_temp.patch_function('public.list_agent_contacts(jsonb, integer, integer)',
      'when ''sales'' then fu.result = ''sold''',
      'when ''sales'' then fu.result = ''sold''
            when ''first'' then not exists (select 1 from public.followups f0
              where f0.prospect_id = fu.prospect_id and (f0.contacted_at, f0.id) < (fu.contacted_at, fu.id))
            when ''recontact'' then exists (select 1 from public.followups f0
              where f0.prospect_id = fu.prospect_id and (f0.contacted_at, f0.id) < (fu.contacted_at, fu.id))');
  end if;

-- 3) Seguimientos: «Contar por» ------------------------------------------------------------------------------------
  if position('v_basis' in pg_get_functiondef('public.list_followup_status(jsonb, integer, integer)'::regprocedure)) > 0 then
    raise notice 'list_followup_status ya tiene date_basis: no se cambia';
  else
    perform pg_temp.patch_function('public.list_followup_status(jsonb, integer, integer)',
      'v_product integer := nullif(f ->> ''product_id'', '''')::integer;',
      'v_product integer := nullif(f ->> ''product_id'', '''')::integer;
  v_basis text := coalesce(nullif(f ->> ''date_basis'', ''''), ''registered'');');
    perform pg_temp.patch_function('public.list_followup_status(jsonb, integer, integer)',
      'if v_tab is not null and v_stages is null then raise exception ''invalid_input'' using detail = ''tab''; end if;',
      'if v_tab is not null and v_stages is null then raise exception ''invalid_input'' using detail = ''tab''; end if;
  if v_basis not in (''registered'', ''assigned'', ''last_contact'', ''next_contact'') then
    raise exception ''invalid_input'' using detail = ''date_basis'';
  end if;');
    -- Registro sigue con la condición directa sobre client_created_at (índice); las otras, sobre la fecha elegida.
    perform pg_temp.patch_function('public.list_followup_status(jsonb, integer, integer)',
      '    ) lf on true
    where p.status = ''active''
      and (v_branch is null or p.branch_id = v_branch)
      and p.client_created_at >= (v_from::timestamp at time zone tz)
      and p.client_created_at < ((v_to + 1)::timestamp at time zone tz)',
      '    ) lf on true
    cross join lateral (
      select case v_basis
               when ''assigned'' then (select max(e.created_at) from public.assignment_events e
                                       where e.prospect_id = p.id and e.to_user = p.assigned_to)
               when ''last_contact'' then lf.contacted_at
               when ''next_contact'' then p.next_contact_at
             end as basis_at
    ) bd
    where p.status = ''active''
      and (v_branch is null or p.branch_id = v_branch)
      and (v_basis <> ''registered'' or (p.client_created_at >= (v_from::timestamp at time zone tz)
                                         and p.client_created_at < ((v_to + 1)::timestamp at time zone tz)))
      and (v_basis = ''registered'' or (bd.basis_at >= (v_from::timestamp at time zone tz)
                                        and bd.basis_at < ((v_to + 1)::timestamp at time zone tz)))');
  end if;
end;
$do$;
