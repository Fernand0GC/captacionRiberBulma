-- Spec 026 · «Poner para hoy»: la jefa marca clientes como prioridad de hoy para su responsable, sin reasignarlos.
-- La prioridad es de (cliente, persona, día): si mañana sigue sin contactar vuelve a «Atrasados» con sus días reales, y
-- si se reasigna no sigue al cliente. No toca prospects (la PWA la sincroniza sin conexión): tabla aparte, solo por RPC,
-- igual que assigned_hidden (spec 021). my_contacts, recontact_agenda y list_agent_assigned suman priority_today.
-- Los parches son idempotentes: si el texto ya está, no cambian nada; si no encuentran el texto esperado, fallan y no
-- cambian nada.
--
-- Volver atrás (en este orden): restaurar las tres funciones desde sus migraciones anteriores
-- (20261123002200_my_contacts_assigned_at.sql sobre 20261121000800_referral_batch.sql, 20261124000100_recontacto_visible.sql
-- y 20261124000200_assigned_reassigned_uncounted.sql) y luego
--   drop function public.set_contact_priority(uuid, uuid[], boolean); drop table public.contact_priorities;

create table if not exists public.contact_priorities (
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  agent_id uuid not null references public.profiles (id),
  day date not null,
  set_by uuid not null references public.profiles (id),
  set_at timestamptz not null default now(),
  -- También es el índice de las lecturas (cliente + persona + día).
  primary key (prospect_id, agent_id, day)
);
alter table public.contact_priorities enable row level security;
revoke all on public.contact_priorities from public, anon, authenticated;

-- Marca (p_on) o quita la prioridad de hoy. Permisos como «Ocultar» (021): encargado, jefe de ventas, gerente y admin,
-- solo en sus sucursales (todo o nada). Los clientes que ya no son de p_agent, o están cerrados, se saltan y se cuentan.
create or replace function public.set_contact_priority(p_agent uuid, p_prospects uuid[], p_on boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/La_Paz')::date;
  v_total int;
  v_n int;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  if p_agent is null then raise exception 'invalid_input' using detail = 'p_agent'; end if;
  if coalesce(cardinality(p_prospects), 0) = 0 or cardinality(p_prospects) > 1000 then
    raise exception 'invalid_input' using detail = 'p_prospects';
  end if;
  if p_on is null then raise exception 'invalid_input' using detail = 'p_on'; end if;
  perform public.assigned_hidden_check(p_prospects);

  if not p_on then
    delete from public.contact_priorities c
    where c.agent_id = p_agent and c.day = v_today and c.prospect_id = any (p_prospects);
    get diagnostics v_n = row_count;
    return jsonb_build_object('changed', v_n, 'skipped', 0);
  end if;

  select count(distinct x.id) into v_total from unnest(p_prospects) as x(id);
  with ok as (
    select p.id from public.prospects p
    where p.id = any (p_prospects) and p.assigned_to = p_agent and p.status = 'active' and p.stage not in ('sale', 'lost')
  ), ins as (
    insert into public.contact_priorities (prospect_id, agent_id, day, set_by)
    select ok.id, p_agent, v_today, auth.uid() from ok
    on conflict do nothing
  )
  select count(*) into v_n from ok;
  return jsonb_build_object('changed', v_n, 'skipped', v_total - v_n);
end;
$$;
revoke execute on function public.set_contact_priority(uuid, uuid[], boolean) from public, anon;
grant execute on function public.set_contact_priority(uuid, uuid[], boolean) to authenticated;

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

do $do$
begin
  -- 1) my_contacts: «Mis contactos» de quien consulta.
  if position('priority_today' in pg_get_functiondef('public.my_contacts()'::regprocedure)) = 0 then
    perform pg_temp.patch_function('public.my_contacts()',
      'lf.contacted_at as last_contacted_at',
      'lf.contacted_at as last_contacted_at,
             exists (select 1 from public.contact_priorities cp
                     where cp.prospect_id = p.id and cp.agent_id = auth.uid()
                       and cp.day = (now() at time zone ''America/La_Paz'')::date) as priority_today');
  end if;

  -- 2) recontact_agenda: entra lo marcado aunque esté agendado más adelante, y cada fila dice si es prioridad.
  if position('priority_today' in pg_get_functiondef('public.recontact_agenda(jsonb)'::regprocedure)) = 0 then
    perform pg_temp.patch_function('public.recontact_agenda(jsonb)',
      'or lf.contacted_at >= v_start',
      'or lf.contacted_at >= v_start
        or (p.stage not in (''sale'', ''lost'') and exists (
              select 1 from public.contact_priorities cp
              where cp.prospect_id = p.id and cp.agent_id = p.assigned_to and cp.day = v_today))');
    perform pg_temp.patch_function('public.recontact_agenda(jsonb)',
      '''last_note'', l.last_note)',
      '''last_note'', l.last_note,
        ''priority_today'', exists (select 1 from public.contact_priorities cp
                                  where cp.prospect_id = l.id and cp.agent_id = l.assigned_to and cp.day = v_today))');
  end if;

  -- 3) list_agent_assigned: el modal «Clientes asignados» muestra «Prioridad hoy».
  if position('priority_today' in pg_get_functiondef('public.list_agent_assigned(jsonb)'::regprocedure)) = 0 then
    perform pg_temp.patch_function('public.list_agent_assigned(jsonb)',
      'where h.prospect_id = a.prospect_id and h.agent_id = v_actor) as hidden',
      'where h.prospect_id = a.prospect_id and h.agent_id = v_actor) as hidden,
           exists (select 1 from public.contact_priorities cp
                   where cp.prospect_id = a.prospect_id and cp.agent_id = v_actor
                     and cp.day = (now() at time zone tz)::date) as priority_today');
  end if;
end;
$do$;
