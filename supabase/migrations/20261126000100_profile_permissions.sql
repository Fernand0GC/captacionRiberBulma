-- Spec 029 · Permisos por persona para la encargada (2026-11-26).
-- Los roles siguen fijos; a una encargada se le prenden permisos extra, de a poco, para que vaya armando la
-- planificación que hoy hacen las jefas de ventas. Nunca amplían su alcance: siempre su sucursal.
--   replan_past · editar y quitar asignaciones de días pasados (org_can_replan).
--   referrals   · el módulo Referidos (can_see_referrals, referral_branches).
-- Otorgan Sistemas y Gerente a cualquier encargada; el jefe de ventas, a las de sus sucursales. Sistemas actuando
-- como otra persona (spec 027) otorga sin restricciones; la auditoría guarda al admin real en acting_by.
--
-- Deshacer: primero revertir la app (deploy anterior); después ejecutar el SQL del bloque siguiente.
-- Las filas de audit_log con table_name = 'profile_permissions' quedan como historial.
/*
drop trigger if exists profile_permissions_cleanup on public.profiles;
drop function if exists public.profile_permissions_cleanup();

create or replace function public.org_can_replan(p_branch smallint, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.manages_org(p_branch) and (
    public.app_role() in ('general_manager', 'admin', 'sales_lead')
    or p_day >= (now() at time zone 'America/La_Paz')::date
  )
$$;

create or replace function public.can_see_referrals(p_branch smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_is_active() and (
    public.is_global() or (public.app_role() = 'sales_lead' and public.manages_branch(p_branch))
  ), false)
$$;

create or replace function public.referral_branches(p_branch smallint) returns smallint[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v smallint[];
begin
  if not public.app_is_active() then raise exception 'forbidden'; end if;
  if p_branch is not null then
    if not public.can_see_referrals(p_branch) then raise exception 'forbidden'; end if;
    return array[p_branch];
  end if;
  if public.is_global() then
    select array_agg(b.id order by b.id) into v from public.branches b;
  elsif public.app_role() = 'sales_lead' then
    select array_agg(pb.branch_id order by pb.branch_id) into v from public.profile_branches pb where pb.profile_id = auth.uid();
  end if;
  if v is null then raise exception 'forbidden'; end if;
  return v;
end;
$$;

drop function public.permissions_list(smallint), public.permission_set(uuid, text, boolean),
  public.has_permission(text), public.acting_admin();
drop table public.profile_permissions;
*/

-- 1) Tabla --------------------------------------------------------------------------------------------------
create table if not exists public.profile_permissions (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  permission text not null check (permission in ('replan_past', 'referrals')),
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  primary key (profile_id, permission) -- también es el índice de has_permission (busca por persona)
);
alter table public.profile_permissions enable row level security;
-- Cada uno lee los suyos (la app los trae con el perfil). Se escribe solo por permission_set.
drop policy if exists profile_permissions_read_own on public.profile_permissions;
create policy profile_permissions_read_own on public.profile_permissions for select to authenticated
  using (profile_id = auth.uid());
revoke all on public.profile_permissions from anon;
revoke insert, update, delete, truncate, references, trigger on public.profile_permissions from authenticated;
grant select on public.profile_permissions to authenticated;

-- 2) ¿Tiene el permiso? Solo vale si está activa y sigue siendo encargada: un cambio de rol lo apaga solo. ------
create or replace function public.has_permission(p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_is_active() and public.app_role() = 'branch_manager' and exists (
    select 1 from public.profile_permissions pp where pp.profile_id = auth.uid() and pp.permission = p_permission
  ), false)
$$;

-- Admin que actúa como esta persona, solo si la suplantación está abierta y vigente y el admin sigue activo.
-- No alcanza con la marca act.sub del token: se comprueba contra impersonations.
create or replace function public.acting_admin() returns uuid
language sql stable security definer set search_path = '' as $$
  select i.actor_id from public.impersonations i join public.profiles a on a.id = i.actor_id
  where i.actor_id = public.acting_actor() and i.target_id = auth.uid()
    and i.ended_at is null and i.expires_at > now() and a.active and a.role = 'admin'
  limit 1
$$;

-- 3) Otorgar o quitar ---------------------------------------------------------------------------------------------
create or replace function public.permission_set(p_profile uuid, p_permission text, p_on boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_admin uuid := public.acting_admin();
  -- Sistemas y Gerente: cualquier encargada. Sistemas actuando como otro, también.
  v_global boolean := v_admin is not null or (public.app_is_active() and public.app_role() in ('admin', 'general_manager'));
  v_t public.profiles;
  v_changed boolean;
begin
  -- El jefe de ventas tiene ambos permisos por su rol, así que puede darlos (solo en sus sucursales, abajo).
  if not v_global and not (public.app_is_active() and public.app_role() = 'sales_lead') then
    raise exception 'forbidden';
  end if;
  if p_permission is null or p_permission not in ('replan_past', 'referrals') or p_on is null then
    raise exception 'invalid_input' using detail = 'permission';
  end if;
  select * into v_t from public.profiles where id = p_profile;
  if not found then raise exception 'invalid_input' using detail = 'profile'; end if;
  -- Primero el alcance: a un jefe no se le dice nada de personas de sucursales ajenas.
  if not v_global and not public.manages_branch(v_t.branch_id) then raise exception 'forbidden'; end if;
  if p_on then
    if v_t.role <> 'branch_manager' then raise exception 'invalid_input' using detail = 'role'; end if;
    if not v_t.active then raise exception 'invalid_input' using detail = 'inactive'; end if;
    insert into public.profile_permissions (profile_id, permission, granted_by)
    values (p_profile, p_permission, coalesce(v_admin, auth.uid()))
    on conflict do nothing;
  else
    delete from public.profile_permissions where profile_id = p_profile and permission = p_permission;
  end if;
  v_changed := found;

  -- Solo lo que cambió. actor_id = quien aparece en la sesión; acting_by (por defecto) = el admin real si actúa.
  if v_changed then
    insert into public.audit_log (table_name, row_id, actor_id, old, new)
    values ('profile_permissions', p_profile, auth.uid(),
            case when p_on then null else jsonb_build_object('permission', p_permission) end,
            case when p_on then jsonb_build_object('permission', p_permission) else null end);
  end if;
  return jsonb_build_object('changed', v_changed);
end;
$$;

-- Cambio real de rol o sucursal, o baja: se borran los permisos sin que puedan revivir al volver.
create or replace function public.profile_permissions_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text;
begin
  if old.role is distinct from new.role then
    v_reason := 'role';
  elsif old.branch_id is distinct from new.branch_id then
    v_reason := 'branch';
  elsif old.active and not new.active then
    v_reason := 'deactivated';
  else
    return new;
  end if;

  -- Una fila de auditoría por permiso borrado; acting_by conserva su valor por defecto.
  with removed as (
    delete from public.profile_permissions where profile_id = new.id returning permission
  )
  insert into public.audit_log (table_name, row_id, actor_id, old, new)
  select 'profile_permissions', new.id, auth.uid(),
         jsonb_build_object('permission', permission, 'reason', v_reason), null
  from removed;
  return new;
end;
$$;

revoke execute on function public.profile_permissions_cleanup() from public, anon, authenticated;
drop trigger if exists profile_permissions_cleanup on public.profiles;
create trigger profile_permissions_cleanup
  after update of role, branch_id, active on public.profiles
  for each row execute function public.profile_permissions_cleanup();

-- 4) Lista para la pantalla «Permisos»: las encargadas activas que la persona puede gestionar. ------------------
-- Sin paginar a propósito: hay una encargada por sucursal (decenas como mucho).
create or replace function public.permissions_list(p_branch smallint default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_global boolean := public.acting_admin() is not null
    or (public.app_is_active() and public.app_role() in ('admin', 'general_manager'));
begin
  if not v_global and not (public.app_is_active() and public.app_role() = 'sales_lead') then
    raise exception 'forbidden';
  end if;
  if p_branch is not null and not v_global and not public.manages_branch(p_branch) then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'full_name', p.full_name, 'username', p.username,
             'branch_id', p.branch_id, 'branch_name', b.name,
             'permissions', coalesce((select jsonb_agg(pp.permission order by pp.permission)
                                      from public.profile_permissions pp where pp.profile_id = p.id), '[]'::jsonb))
           order by b.name, p.full_name)
    from public.profiles p join public.branches b on b.id = p.branch_id
    where p.active and p.role = 'branch_manager'
      and (p_branch is null or p.branch_id = p_branch)
      and (v_global or public.manages_branch(p.branch_id))
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.has_permission(text), public.acting_admin(), public.permission_set(uuid, text, boolean),
  public.permissions_list(smallint) from public, anon;
revoke execute on function public.acting_admin() from authenticated; -- interna
grant execute on function public.has_permission(text), public.permission_set(uuid, text, boolean),
  public.permissions_list(smallint) to authenticated;

-- 5) Efecto de los permisos (create or replace conserva los grants) ----------------------------------------------

-- Planificación: además de hoy y días futuros, días pasados con replan_past. manages_org ya limita a su sucursal.
create or replace function public.org_can_replan(p_branch smallint, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.manages_org(p_branch) and (
    public.app_role() in ('general_manager', 'admin', 'sales_lead')
    or p_day >= (now() at time zone 'America/La_Paz')::date
    or public.has_permission('replan_past')
  )
$$;

-- Referidos: la encargada con referrals, en su sucursal (manages_branch del encargado = la suya).
create or replace function public.can_see_referrals(p_branch smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_is_active() and (
    public.is_global()
    or (public.app_role() = 'sales_lead' and public.manages_branch(p_branch))
    or (public.has_permission('referrals') and public.manages_branch(p_branch))
  ), false)
$$;

-- «Todas» para la encargada con referrals = solo la suya.
create or replace function public.referral_branches(p_branch smallint) returns smallint[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v smallint[];
begin
  if not public.app_is_active() then raise exception 'forbidden'; end if;
  if p_branch is not null then
    if not public.can_see_referrals(p_branch) then raise exception 'forbidden'; end if;
    return array[p_branch];
  end if;
  if public.is_global() then
    select array_agg(b.id order by b.id) into v from public.branches b;
  elsif public.app_role() = 'sales_lead' then
    select array_agg(pb.branch_id order by pb.branch_id) into v from public.profile_branches pb where pb.profile_id = auth.uid();
  elsif public.has_permission('referrals') then
    v := array[public.app_branch()];
  end if;
  if v is null then raise exception 'forbidden'; end if;
  return v;
end;
$$;
