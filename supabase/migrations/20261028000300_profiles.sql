-- Perfiles + helpers de permisos (research R8). El rol se lee de la tabla en cada consulta,
-- así una baja aplica de inmediato (constitución IV).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  username text not null unique check (username ~ '^[a-z0-9._]{3,30}$'),
  full_name text not null check (length(trim(full_name)) between 3 and 120),
  role public.app_role not null,
  branch_id smallint references public.branches (id),
  contract_type public.contract_type not null default 'permanent',
  active boolean not null default true,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profiles_branch_required check (
    role in ('general_manager', 'admin') or branch_id is not null
  ),
  constraint profiles_deactivation check ((active and deactivated_at is null) or (not active and deactivated_at is not null))
);

alter table public.profiles enable row level security;

create function public.app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create function public.app_branch() returns smallint
language sql stable security definer set search_path = '' as $$
  select p.branch_id from public.profiles p where p.id = auth.uid()
$$;

create function public.app_is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.active from public.profiles p where p.id = auth.uid()), false)
$$;

create function public.is_field() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_role() in ('field_volunteer', 'field_assistant', 'field_supervisor'), false)
$$;

create function public.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_role() in ('branch_manager', 'general_manager', 'admin'), false)
$$;

create function public.is_global() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_role() in ('general_manager', 'admin'), false)
$$;

create function public.can_follow_up() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_role() in ('field_assistant', 'field_supervisor', 'branch_manager'), false)
$$;

-- Gestor activo con alcance sobre la sucursal b.
create function public.manages_branch(b smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.app_is_active() and (
    public.is_global() or (public.app_role() = 'branch_manager' and public.app_branch() = b)
  )
$$;

revoke execute on function public.app_role(), public.app_branch(), public.app_is_active(), public.is_field(),
  public.is_manager(), public.is_global(), public.can_follow_up(), public.manages_branch(smallint) from public, anon;

-- profiles: cada uno ve su propio perfil (aunque esté inactivo, para mostrar "Usuario desactivado");
-- los gestores ven los de su alcance. Las escrituras van solo por la Edge Function admin-users (service role).
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_select_managed on public.profiles for select to authenticated
  using (public.app_is_active() and (public.is_global() or (public.app_role() = 'branch_manager' and branch_id = public.app_branch())));

-- Catálogos: lectura para usuarios activos; escritura solo admin.
create policy branches_read on public.branches for select to authenticated using (public.app_is_active());
create policy channels_read on public.channels for select to authenticated using (public.app_is_active());
create policy products_read on public.products for select to authenticated using (public.app_is_active());
create policy lost_reasons_read on public.lost_reasons for select to authenticated using (public.app_is_active());
create policy agenda_strategies_read on public.agenda_strategies for select to authenticated using (public.app_is_active());
create policy settings_read on public.settings for select to authenticated using (public.app_is_active());

create policy channels_admin on public.channels for all to authenticated
  using (public.app_is_active() and public.app_role() = 'admin') with check (public.app_is_active() and public.app_role() = 'admin');
create policy products_admin on public.products for all to authenticated
  using (public.app_is_active() and public.app_role() = 'admin') with check (public.app_is_active() and public.app_role() = 'admin');
create policy lost_reasons_admin on public.lost_reasons for all to authenticated
  using (public.app_is_active() and public.app_role() = 'admin') with check (public.app_is_active() and public.app_role() = 'admin');
create policy agenda_strategies_admin on public.agenda_strategies for all to authenticated
  using (public.app_is_active() and public.app_role() = 'admin') with check (public.app_is_active() and public.app_role() = 'admin');
create policy settings_admin on public.settings for update to authenticated
  using (public.app_is_active() and public.app_role() = 'admin') with check (public.app_is_active() and public.app_role() = 'admin');

-- Los catálogos solo se desactivan, nunca se borran (filas históricas los referencian).
revoke delete on public.branches, public.channels, public.products, public.lost_reasons, public.agenda_strategies, public.settings
  from authenticated, anon;
revoke insert, update, delete on public.profiles from authenticated, anon;
