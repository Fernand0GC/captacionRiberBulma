-- Jefe de ventas: gestiona las sucursales que tiene asignadas (profile_branches), con los mismos permisos que el
-- encargado en cada una (ver, editar, repartir, metas, planificación). En pantallas de gestión elige una de SUS
-- sucursales; si no elige, se usa la primera.

-- 1) Sucursales asignadas -------------------------------------------------------------------------
create table public.profile_branches (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  branch_id smallint not null references public.branches (id),
  primary key (profile_id, branch_id)
);
alter table public.profile_branches enable row level security;
-- Cada uno ve las suyas; gerencia/Sistemas todas. Escrituras solo por la Edge Function admin-users (service role).
create policy profile_branches_read on public.profile_branches for select to authenticated
  using (profile_id = auth.uid() or (public.app_is_active() and public.is_global()));

-- El jefe no tiene una sucursal "propia": branch_id queda vacío (como gerencia).
alter table public.profiles drop constraint profiles_branch_required;
alter table public.profiles add constraint profiles_branch_required check (
  role in ('general_manager', 'admin', 'sales_lead') or branch_id is not null
);

-- 2) Permisos ---------------------------------------------------------------------------------------
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_role() in ('branch_manager', 'sales_lead', 'general_manager', 'admin'), false)
$$;

create or replace function public.manages_branch(b smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.app_is_active() and (
    public.is_global()
    or (public.app_role() = 'branch_manager' and public.app_branch() = b)
    or (public.app_role() = 'sales_lead'
        and exists (select 1 from public.profile_branches pb where pb.profile_id = auth.uid() and pb.branch_id = b))
  )
$$;

-- Sucursal efectiva de una consulta de gestión. Encargado: la suya (otra = prohibido). Jefe: una de las suyas
-- (sin elegir = la primera; ajena = prohibido). Gerencia/Sistemas: la pedida (null = todas).
create function public.scoped_branch(p_requested smallint) returns smallint
language plpgsql stable security definer set search_path = '' as $$
declare
  v smallint;
begin
  case public.app_role()
    when 'branch_manager' then
      if p_requested is not null and p_requested <> public.app_branch() then raise exception 'forbidden'; end if;
      return public.app_branch();
    when 'sales_lead' then
      if p_requested is null then
        select min(pb.branch_id) into v from public.profile_branches pb where pb.profile_id = auth.uid();
        if v is null then raise exception 'forbidden'; end if;
        return v;
      end if;
      if not public.manages_branch(p_requested) then raise exception 'forbidden'; end if;
      return p_requested;
    else
      return p_requested;
  end case;
end;
$$;

revoke execute on function public.scoped_branch(smallint) from public, anon;
grant execute on function public.scoped_branch(smallint) to authenticated;

-- 3) Consultas de gestión: el alcance pasa por scoped_branch --------------------------------------
create function pg_temp.patch_function(p_sig text, p_old text, p_new text) returns void language plpgsql as $$
declare
  d text := pg_get_functiondef(p_sig::regprocedure);
begin
  if position(p_old in d) = 0 then
    raise exception 'patch_function: no se encontró el texto en %: %', p_sig, p_old;
  end if;
  execute replace(d, p_old, p_new);
end;
$$;

select pg_temp.patch_function('public.list_prospects(jsonb, integer, integer)',
'  if public.app_role() = ''branch_manager'' then
    v_branch := public.app_branch();
    if nullif(f ->> ''branch_id'', '''') is not null and (f ->> ''branch_id'')::smallint <> v_branch then
      raise exception ''forbidden'';
    end if;
  else
    v_branch := nullif(f ->> ''branch_id'', '''')::smallint;
  end if;',
'  v_branch := public.scoped_branch(nullif(f ->> ''branch_id'', '''')::smallint);');

select pg_temp.patch_function('public.dashboard_metrics(jsonb)',
'  if public.app_role() = ''branch_manager'' then
    v_branch := public.app_branch();
  else
    v_branch := nullif(f ->> ''branch_id'', '''')::smallint;
  end if;',
'  v_branch := public.scoped_branch(nullif(f ->> ''branch_id'', '''')::smallint);');

select pg_temp.patch_function('public.goals_for_day(smallint, date)',
'  if public.app_role() = ''branch_manager'' then
    if p_branch is not null and p_branch <> public.app_branch() then raise exception ''forbidden''; end if;
    v_branch := public.app_branch();
  end if;',
'  v_branch := public.scoped_branch(p_branch);');

select pg_temp.patch_function('public.monthly_goals_progress(date, smallint)',
'  if public.app_role() = ''branch_manager'' then
    if p_branch is not null and p_branch <> public.app_branch() then raise exception ''forbidden''; end if;
    v_branch := public.app_branch();
  end if;',
'  v_branch := public.scoped_branch(p_branch);');

-- Personal para filtros y reparto: el de las sucursales que gestiona.
select pg_temp.patch_function('public.staff_options()',
'where public.is_global() or p.branch_id = public.app_branch()',
'where public.is_global() or public.manages_branch(p.branch_id)');

-- Registrar: un jefe solo puede registrar en sus sucursales (gerencia/Sistemas en cualquiera).
select pg_temp.patch_function('public.submit_capture(jsonb)',
'    if v_branch is null or not exists (select 1 from public.branches b where b.id = v_branch and b.active) then
      raise exception ''invalid_input'' using detail = ''branch_id'';
    end if;',
'    if v_branch is null or not exists (select 1 from public.branches b where b.id = v_branch and b.active) then
      raise exception ''invalid_input'' using detail = ''branch_id'';
    end if;
    if v_prof.role = ''sales_lead'' and not public.manages_branch(v_branch) then raise exception ''forbidden''; end if;');

drop policy profiles_select_managed on public.profiles;
create policy profiles_select_managed on public.profiles for select to authenticated
  using (public.app_is_active() and (public.is_global() or public.manages_branch(branch_id)));
