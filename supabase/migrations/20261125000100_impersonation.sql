-- Actuar como (spec 027): Sistemas (admin) usa la app con la identidad y los permisos de otra persona, 30 minutos.
-- No se emite ningún token: el admin conserva su sesión y la app manda `x-actuar-como: <id>`. La función pre-request
-- de PostgREST valida esa suplantación y cambia los claims (sub = la persona, act.sub = el admin, RFC 8693), así
-- auth.uid() devuelve a la persona y todas las RLS/RPC existentes funcionan sin cambios.
-- Deshacer al instante: alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';

-- 1) Registro de suplantaciones -----------------------------------------------------------------------------
create table public.impersonations (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id),
  target_id uuid not null references public.profiles (id),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  end_reason text check (end_reason in ('returned', 'replaced', 'expired')),
  constraint impersonations_not_self check (actor_id <> target_id),
  constraint impersonations_end check ((ended_at is null) = (end_reason is null))
);
-- Una sola abierta por admin; la búsqueda de cada petición va por id (PK).
create unique index impersonations_one_open_uidx on public.impersonations (actor_id) where ended_at is null;
create index impersonations_target_idx on public.impersonations (target_id, started_at desc);
alter table public.impersonations enable row level security;
-- Sin políticas: solo se usa por las funciones de abajo (security definer).
revoke all on public.impersonations from authenticated, anon;

-- 2) Autor real: el admin que está actuando (null si nadie actúa) ------------------------------------------
create function public.acting_actor() returns uuid
language sql stable set search_path = '' as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'act' ->> 'sub', '')::uuid
$$;

-- 3) Pre-request: corre antes de CADA consulta de PostgREST. Sin cabecera sale de inmediato (camino normal).
create function public.apply_impersonation() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_header text := nullif(current_setting('request.headers', true), '')::json ->> 'x-actuar-como';
  v_claims jsonb;
  v_sid uuid;
  v_target uuid;
begin
  if v_header is null then return; end if;

  v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  if v_claims is null or v_claims ->> 'role' is distinct from 'authenticated' or v_claims ? 'act' then
    raise exception 'impersonation_invalid';
  end if;
  begin
    v_sid := v_header::uuid;
  exception when invalid_text_representation then
    raise exception 'impersonation_invalid';
  end;

  -- Debe ser del admin de esta sesión, seguir abierta y vigente, y ambos activos (una baja corta al instante).
  select i.target_id into v_target
  from public.impersonations i
  join public.profiles a on a.id = i.actor_id
  join public.profiles t on t.id = i.target_id
  where i.id = v_sid
    and i.actor_id = (v_claims ->> 'sub')::uuid
    and i.ended_at is null
    and i.expires_at > now()
    and a.active and a.role = 'admin'
    and t.active and t.role <> 'admin';
  if v_target is null then raise exception 'impersonation_invalid'; end if;

  perform set_config('request.jwt.claims',
    (v_claims || jsonb_build_object('sub', v_target, 'act', jsonb_build_object('sub', v_claims ->> 'sub')))::text, true);
  perform set_config('request.jwt.claim.sub', v_target::text, true);
end;
$$;

-- 4) Empezar y volver ------------------------------------------------------------------------------------------
create function public.impersonation_start(p_target uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_t public.profiles%rowtype;
  v_id uuid;
  v_expires timestamptz := now() + interval '30 minutes';
begin
  -- Sin encadenar, y solo Sistemas activo (no es un permiso asignable).
  if public.acting_actor() is not null then raise exception 'forbidden'; end if;
  if not public.app_is_active() or public.app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;

  select * into v_t from public.profiles where id = p_target;
  if not found or not v_t.active or v_t.id = v_actor or v_t.role = 'admin' then
    raise exception 'invalid_input' using detail = 'target';
  end if;

  -- La anterior abierta se cierra (vencida o reemplazada) para respetar «una sola abierta».
  update public.impersonations
     set ended_at = now(), end_reason = case when expires_at <= now() then 'expired' else 'replaced' end
   where actor_id = v_actor and ended_at is null;

  insert into public.impersonations (actor_id, target_id, expires_at)
  values (v_actor, v_t.id, v_expires)
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'expires_at', v_expires,
    'target', jsonb_build_object('id', v_t.id, 'username', v_t.username, 'full_name', v_t.full_name, 'role', v_t.role)
  );
end;
$$;

-- Cierra la suplantación abierta del admin. Sirve con o sin la cabecera (el autor real sale de act.sub).
create function public.impersonation_end() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.impersonations
     set ended_at = now(), end_reason = case when expires_at <= now() then 'expired' else 'returned' end
   where actor_id = coalesce(public.acting_actor(), auth.uid()) and ended_at is null;
end;
$$;

revoke execute on function public.acting_actor(), public.apply_impersonation(), public.impersonation_start(uuid),
  public.impersonation_end() from public;
grant execute on function public.acting_actor(), public.impersonation_start(uuid), public.impersonation_end() to authenticated;
-- La pre-request corre en TODAS las peticiones, también sin sesión.
grant execute on function public.apply_impersonation() to authenticated, anon;

-- 5) Auditoría: guarda al admin real cuando cambia algo mientras actúa ------------------------------------
alter table public.audit_log add column acting_by uuid;
comment on column public.audit_log.acting_by is 'Admin que hizo el cambio actuando como actor_id (spec 027). Null = la persona misma.';

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  k text;
  old_diff jsonb := '{}';
  new_diff jsonb := '{}';
begin
  for k in select jsonb_object_keys(n) loop
    if k in ('updated_at', 'updated_by') then continue; end if;
    if (o -> k) is distinct from (n -> k) then
      old_diff := old_diff || jsonb_build_object(k, o -> k);
      new_diff := new_diff || jsonb_build_object(k, n -> k);
    end if;
  end loop;
  if new_diff <> '{}' then
    insert into public.audit_log (table_name, row_id, actor_id, acting_by, old, new)
    values (tg_table_name, (n ->> 'id')::uuid, auth.uid(), public.acting_actor(), old_diff, new_diff);
  end if;
  return new;
end;
$$;

-- 6) Activar la pre-request en PostgREST ---------------------------------------------------------------------
alter role authenticator set pgrst.db_pre_request = 'public.apply_impersonation';
notify pgrst, 'reload config';
