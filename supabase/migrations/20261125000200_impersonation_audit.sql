-- Actuar como (spec 027) · corrección de la auditoría 2026-11-24.
-- H1: la app sigue mandando la cabecera vencida para que la base la RECHACE (nunca corre como el admin). Única
--     excepción: /rpc/impersonation_end con una suplantación propia, que corre como el admin para poder cerrarla.
-- H2: el admin real queda en toda escritura hecha actuando: altas de clientes y contactos, auditorías manuales
--     (acting_by por defecto) y una bitácora de cada petición que escribe.
-- Deshacer: drop trigger prospects_audit_acting_insert on public.prospects;
--           drop trigger followups_audit_acting_insert on public.followups; drop function public.audit_acting_insert();
--           alter table public.audit_log alter column acting_by drop default; drop table public.impersonation_requests;
--           y volver a crear apply_impersonation desde 20261125000100_impersonation.sql.

-- 1) Bitácora de peticiones que escriben mientras se actúa --------------------------------------------------
create table public.impersonation_requests (
  id bigint generated always as identity primary key,
  impersonation_id uuid not null references public.impersonations (id),
  method text not null,
  path text not null,
  at timestamptz not null default now()
);
create index impersonation_requests_imp_idx on public.impersonation_requests (impersonation_id, at);
alter table public.impersonation_requests enable row level security;
-- Sin políticas: la escribe solo la pre-request (security definer); se consulta por SQL desde Sistemas.
revoke all on public.impersonation_requests from authenticated, anon;

-- 2) Pre-request ------------------------------------------------------------------------------------------------
create or replace function public.apply_impersonation() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_header text := nullif(current_setting('request.headers', true), '')::json ->> 'x-actuar-como';
  v_method text := coalesce(current_setting('request.method', true), '');
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

  -- Volver a mi cuenta: con una suplantación PROPIA (vigente, vencida o ya cerrada) corre como el admin, sin cambiar
  -- los claims; impersonation_end cierra la abierta con auth.uid(). Una ajena se rechaza.
  if current_setting('request.path', true) = '/rpc/impersonation_end' then
    if exists (select 1 from public.impersonations i
               where i.id = v_sid and i.actor_id = (v_claims ->> 'sub')::uuid) then
      return;
    end if;
    raise exception 'impersonation_invalid';
  end if;

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

  -- Solo las peticiones que PUEDEN escribir. Ojo: no alcanza con el método: PostgREST corre en transacción de solo
  -- lectura los GET/HEAD y también las RPC STABLE llamadas por POST; insertar ahí haría fallar la consulta (25006).
  if current_setting('transaction_read_only') = 'off' then
    insert into public.impersonation_requests (impersonation_id, method, path)
    values (v_sid, v_method, coalesce(current_setting('request.path', true), ''));
  end if;
end;
$$;

-- 3) acting_by por defecto: toda auditoría (trigger o manual, como org_delete) guarda al admin real -----------
alter table public.audit_log alter column acting_by set default public.acting_actor();

-- 4) Altas hechas actuando: registrar un cliente o un contacto deja auditoría con el admin ------------------
-- Solo mientras alguien actúa (en uso normal no agrega filas). Sin copiar datos personales: basta el id.
create function public.audit_acting_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.acting_actor() is not null then
    insert into public.audit_log (table_name, row_id, actor_id, old, new)
    values (tg_table_name, new.id, auth.uid(), null, jsonb_build_object('op', 'insert'));
  end if;
  return new;
end;
$$;
revoke execute on function public.audit_acting_insert() from public;

create trigger prospects_audit_acting_insert after insert on public.prospects
  for each row execute function public.audit_acting_insert();
create trigger followups_audit_acting_insert after insert on public.followups
  for each row execute function public.audit_acting_insert();
