-- Organización comercial (spec 003, 2026-11-17): asignaciones de una persona a un turno, horario y canal del
-- catálogo de tres niveles, con meta y resultado escritos a mano. Reemplaza las actividades de la Planificación.
-- Acceso solo por RPC (security definer); ver specs/003-organizacion-comercial/contracts/rpc.md.

create table public.org_assignments (
  id uuid primary key default gen_random_uuid(),
  branch_id smallint not null references public.branches (id),
  work_date date not null,
  shift public.shift not null,
  start_time time,
  end_time time,
  profile_id uuid not null references public.profiles (id),
  strategy_id smallint not null references public.org_strategies (id),
  channel_id smallint not null,
  subchannel_id smallint,
  place text check (place is null or length(place) <= 200),
  goal smallint check (goal is null or goal between 0 and 9999),
  result smallint check (result is null or result between 0 and 9999),
  notes text check (notes is null or length(notes) <= 300),
  lead_id uuid references public.profiles (id),
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- La base rechaza una combinación que no existe en el catálogo (FR-010).
  constraint org_assignments_channel_fk foreign key (channel_id, strategy_id)
    references public.org_channels (id, strategy_id),
  constraint org_assignments_subchannel_fk foreign key (subchannel_id, channel_id)
    references public.org_subchannels (id, channel_id),
  constraint org_assignments_times check (start_time is null or end_time is null or end_time > start_time)
);
create index org_assignments_branch_day_idx on public.org_assignments (branch_id, work_date, shift, start_time);
create index org_assignments_profile_day_idx on public.org_assignments (profile_id, work_date);

alter table public.org_assignments enable row level security;
revoke all on public.org_assignments from authenticated, anon;

create trigger org_assignments_audit after update on public.org_assignments
  for each row execute function public.audit_row();

-- Funciones de apoyo -------------------------------------------------------------------------------

-- Gerente a cargo de una sucursal: el jefe de ventas activo que la tiene asignada (el primero por nombre).
create function public.branch_lead(p_branch smallint) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.profile_branches pb join public.profiles p on p.id = pb.profile_id
  where pb.branch_id = p_branch and p.role = 'sales_lead' and p.active
  order by p.full_name, p.id limit 1
$$;

-- Gestiona la organización de la sucursal: quien gestiona la sucursal o su supervisor de campo, que reemplaza
-- al encargado cuando hace falta (decisión del 2026-11-17). No amplía manages_branch.
create function public.manages_org(p_branch smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.manages_branch(p_branch)
    or (public.app_is_active() and public.app_role() = 'field_supervisor' and public.app_branch() = p_branch)
$$;

-- Puede cambiar meta, persona, horario, catálogo o lugar de una asignación de ese día (FR-029). Gerencia,
-- Sistemas y el jefe de ventas de la sucursal: siempre. Encargado y supervisor: solo para días posteriores a hoy.
create function public.org_can_replan(p_branch smallint, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.manages_org(p_branch) and (
    public.app_role() in ('general_manager', 'admin', 'sales_lead')
    or p_day > (now() at time zone 'America/La_Paz')::date
  )
$$;

revoke execute on function public.branch_lead(smallint), public.manages_org(smallint),
  public.org_can_replan(smallint, date) from public, anon;
grant execute on function public.manages_org(smallint), public.org_can_replan(smallint, date) to authenticated;

-- Valida catálogo y persona de una asignación; lanza invalid_input con el campo.
create function public.org_check(p_branch smallint, p_profile uuid, p_profile_changed boolean,
  p_strategy smallint, p_channel smallint, p_subchannel smallint) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_profile is null or (p_profile_changed and not exists (
    select 1 from public.profiles p where p.id = p_profile and p.active and p.branch_id = p_branch)) then
    raise exception 'invalid_input' using detail = 'profile';
  end if;
  if p_strategy is null or p_channel is null
    or not exists (select 1 from public.org_strategies s where s.id = p_strategy and s.active)
    or not exists (select 1 from public.org_channels c where c.id = p_channel and c.strategy_id = p_strategy and c.active)
    or (p_subchannel is not null and not exists (
      select 1 from public.org_subchannels sc where sc.id = p_subchannel and sc.channel_id = p_channel and sc.active)) then
    raise exception 'invalid_input' using detail = 'catalog';
  end if;
end;
$$;
revoke execute on function public.org_check(smallint, uuid, boolean, smallint, smallint, smallint) from public, anon, authenticated;

-- org_list --------------------------------------------------------------------------------------------
create function public.org_list(p_from date, p_to date, p_branches smallint[] default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role public.app_role := public.app_role();
  v_branches smallint[];
  v_own_only boolean := false;
begin
  if not public.app_is_active() or v_role is null or v_role = 'field_volunteer' then raise exception 'forbidden'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 30 then
    raise exception 'invalid_input' using detail = 'range';
  end if;

  if v_role in ('general_manager', 'admin') then
    v_branches := case when coalesce(cardinality(p_branches), 0) = 0
                       then (select array_agg(b.id) from public.branches b) else p_branches end;
  elsif v_role = 'sales_lead' then
    if coalesce(cardinality(p_branches), 0) = 0 then
      select array_agg(pb.branch_id) into v_branches from public.profile_branches pb where pb.profile_id = auth.uid();
    else
      if exists (select 1 from unnest(p_branches) b where not public.manages_branch(b)) then raise exception 'forbidden'; end if;
      v_branches := p_branches;
    end if;
  else
    -- Encargado, supervisor y auxiliar: solo su sucursal.
    if public.app_branch() is null
      or (coalesce(cardinality(p_branches), 0) > 0 and p_branches <> array[public.app_branch()]) then
      raise exception 'forbidden';
    end if;
    v_branches := array[public.app_branch()];
    v_own_only := v_role = 'field_assistant';
  end if;

  return jsonb_build_object(
    'can_manage', exists (select 1 from unnest(coalesce(v_branches, '{}')) b where public.manages_org(b)),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'branch_id', a.branch_id, 'branch', b.name, 'work_date', a.work_date, 'shift', a.shift,
        'start_time', to_char(a.start_time, 'HH24:MI'), 'end_time', to_char(a.end_time, 'HH24:MI'),
        'profile_id', a.profile_id, 'person', p.full_name,
        'strategy_id', a.strategy_id, 'strategy', s.name, 'channel_id', a.channel_id, 'channel', c.name,
        'subchannel_id', a.subchannel_id, 'subchannel', sc.name,
        'place', a.place, 'goal', a.goal, 'result', a.result, 'notes', a.notes,
        'lead_id', a.lead_id, 'lead', l.full_name,
        'can_replan', public.org_can_replan(a.branch_id, a.work_date),
        'can_set_result', public.manages_org(a.branch_id)
      ) order by a.work_date, b.name, a.shift, a.start_time nulls last, p.full_name)
      from public.org_assignments a
      join public.branches b on b.id = a.branch_id
      join public.profiles p on p.id = a.profile_id
      join public.org_strategies s on s.id = a.strategy_id
      join public.org_channels c on c.id = a.channel_id
      left join public.org_subchannels sc on sc.id = a.subchannel_id
      left join public.profiles l on l.id = a.lead_id
      where a.branch_id = any (v_branches) and a.work_date between p_from and p_to
        and (not v_own_only or a.profile_id = auth.uid())
    ), '[]'::jsonb)
  );
end;
$$;

-- org_save ----------------------------------------------------------------------------------------------
create function public.org_save(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_old public.org_assignments;
  v_branch smallint;
  v_day date;
  v_shift public.shift;
  v_start time;
  v_end time;
  v_profile uuid := nullif(p ->> 'profile_id', '')::uuid;
  v_strategy smallint := nullif(p ->> 'strategy_id', '')::smallint;
  v_channel smallint := nullif(p ->> 'channel_id', '')::smallint;
  v_sub smallint := nullif(p ->> 'subchannel_id', '')::smallint;
  v_goal integer := nullif(p ->> 'goal', '')::integer;
  v_place text := nullif(trim(p ->> 'place'), '');
begin
  if v_id is null then
    v_branch := nullif(p ->> 'branch_id', '')::smallint;
    v_day := nullif(p ->> 'work_date', '')::date;
    if v_branch is null or not public.manages_org(v_branch) then raise exception 'forbidden'; end if;
    if v_day is null then raise exception 'invalid_input' using detail = 'day'; end if;
  else
    select * into v_old from public.org_assignments where id = v_id;
    if not found then raise exception 'not_found'; end if;
    v_branch := v_old.branch_id;
    v_day := v_old.work_date;
    if not public.org_can_replan(v_branch, v_day) then raise exception 'forbidden'; end if;
  end if;

  v_shift := nullif(p ->> 'shift', '')::public.shift;
  if v_shift is null then raise exception 'invalid_input' using detail = 'shift'; end if;
  v_start := nullif(p ->> 'start_time', '')::time;
  v_end := nullif(p ->> 'end_time', '')::time;
  if v_start is not null and v_end is not null and v_end <= v_start then
    raise exception 'invalid_input' using detail = 'time';
  end if;
  if v_goal is not null and v_goal not between 0 and 9999 then raise exception 'invalid_input' using detail = 'goal'; end if;
  if v_place is not null and length(v_place) > 200 then raise exception 'invalid_input' using detail = 'place'; end if;

  perform public.org_check(v_branch, v_profile, v_id is null or v_profile is distinct from v_old.profile_id,
    v_strategy, v_channel, v_sub);

  if v_id is null then
    insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
      channel_id, subchannel_id, place, goal, lead_id, created_by, updated_by)
    values (v_branch, v_day, v_shift, v_start, v_end, v_profile, v_strategy, v_channel, v_sub, v_place, v_goal,
      public.branch_lead(v_branch), auth.uid(), auth.uid())
    returning id into v_id;
  else
    update public.org_assignments set
      shift = v_shift, start_time = v_start, end_time = v_end, profile_id = v_profile, strategy_id = v_strategy,
      channel_id = v_channel, subchannel_id = v_sub, place = v_place, goal = v_goal,
      updated_by = auth.uid(), updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end;
$$;

-- org_set_result ----------------------------------------------------------------------------------------
create function public.org_set_result(p_id uuid, p_result integer, p_notes text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_branch smallint;
  v_notes text := nullif(trim(p_notes), '');
begin
  select branch_id into v_branch from public.org_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if not public.manages_org(v_branch) then raise exception 'forbidden'; end if;
  if p_result is not null and p_result not between 0 and 9999 then raise exception 'invalid_input' using detail = 'result'; end if;
  if v_notes is not null and length(v_notes) > 300 then raise exception 'invalid_input' using detail = 'notes'; end if;
  update public.org_assignments set result = p_result, notes = v_notes, updated_by = auth.uid(), updated_at = now()
  where id = p_id;
end;
$$;

-- org_delete --------------------------------------------------------------------------------------------
create function public.org_delete(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_row public.org_assignments;
begin
  select * into v_row from public.org_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if not public.org_can_replan(v_row.branch_id, v_row.work_date) then raise exception 'forbidden'; end if;
  insert into public.audit_log (table_name, row_id, actor_id, old, new)
  values ('org_assignments', v_row.id, auth.uid(), to_jsonb(v_row), null);
  delete from public.org_assignments where id = p_id;
end;
$$;

-- org_copy_day ------------------------------------------------------------------------------------------
create function public.org_copy_day(p_branch smallint, p_from date, p_to date) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if not public.manages_org(p_branch) then raise exception 'forbidden'; end if;
  if p_from is null or p_to is null or p_from = p_to then raise exception 'invalid_input' using detail = 'day'; end if;
  insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
    channel_id, subchannel_id, place, goal, lead_id, created_by, updated_by)
  select a.branch_id, p_to, a.shift, a.start_time, a.end_time, a.profile_id, a.strategy_id, a.channel_id,
    a.subchannel_id, a.place, a.goal, public.branch_lead(p_branch), auth.uid(), auth.uid()
  from public.org_assignments a
  join public.profiles p on p.id = a.profile_id and p.active and p.branch_id = p_branch
  where a.branch_id = p_branch and a.work_date = p_from;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- org_staff ---------------------------------------------------------------------------------------------
create function public.org_staff(p_branch smallint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.manages_org(p_branch) then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'role', p.role) order by p.full_name)
    from public.profiles p where p.branch_id = p_branch and p.active
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.org_list(date, date, smallint[]), public.org_save(jsonb),
  public.org_set_result(uuid, integer, text), public.org_delete(uuid),
  public.org_copy_day(smallint, date, date), public.org_staff(smallint) from public, anon;
grant execute on function public.org_list(date, date, smallint[]), public.org_save(jsonb),
  public.org_set_result(uuid, integer, text), public.org_delete(uuid),
  public.org_copy_day(smallint, date, date), public.org_staff(smallint) to authenticated;
