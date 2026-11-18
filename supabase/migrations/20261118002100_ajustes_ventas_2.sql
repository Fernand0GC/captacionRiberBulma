-- Observaciones del grupo de ventas (spec 006, 2026-11-18):
--  · Observaciones al crear o editar una asignación (org_save / org_save_many aceptan notes).
--  · Orden por persona en org_list (fecha, sucursal, persona, turno, hora).
--  · Un subcanal agregado desde el formulario toma las marcas de meta de su canal.
--  · Catálogo: 3 canales de Tienda, 2 subcanales de compartidas (el genérico se desactiva), «Activaciones en plazas».
--  · Volanteras que acompañan (org_channels.uses_flyers, org_assignments.flyer_ids).
--  · Verificación de compartidas por el rol Cobros (collections), con sucursales en profile_branches.
-- Todo aditivo: la app publicada sigue funcionando (no manda notes ni flyer_ids; al editar se conservan).
-- Requiere 20261118002000_collections_role.sql aplicada (y confirmada) antes.
-- Diseño: specs/006-ajustes-ventas-2/{research,data-model}.md y contracts/rpc.md.

-- Columnas -------------------------------------------------------------------------------------------------
alter table public.org_channels add column uses_flyers boolean not null default false;

alter table public.org_assignments
  add column flyer_ids uuid[] not null default '{}' check (cardinality(flyer_ids) <= 20),
  add column share_verified smallint check (share_verified is null or share_verified between 0 and 9999),
  add column share_verified_note text check (share_verified_note is null or length(share_verified_note) <= 300),
  add column share_verified_by uuid references public.profiles (id),
  add column share_verified_at timestamptz;

comment on column public.org_assignments.flyer_ids is 'Volanteras de la sucursal que acompañan (spec 006). Vacío si el canal no las pide.';
comment on column public.org_assignments.share_verified is 'Compartidas verificadas por Cobros (spec 006). Nulo = sin verificar.';

-- Cobros no tiene sucursal propia: sus sucursales van en profile_branches, como el jefe de ventas.
alter table public.profiles drop constraint profiles_branch_required;
alter table public.profiles add constraint profiles_branch_required check (
  role in ('general_manager', 'admin', 'sales_lead', 'collections') or branch_id is not null
);

-- Catálogo (FR-005 a FR-008) ------------------------------------------------------------------------------
-- Negociación y Activación piden volanteras.
update public.org_channels c set uses_flyers = true
from public.org_strategies s
where s.id = c.strategy_id and s.name = 'Calle' and c.name in ('Negociación', 'Activación');

-- Tienda: tres canales sin metas, al final. No se duplica un nombre que ya exista (comparación normalizada).
insert into public.org_channels (strategy_id, name, sort, uses_goal, uses_share_goal)
select s.id, x.name, (select coalesce(max(c.sort), 0) from public.org_channels c where c.strategy_id = s.id) + x.n, false, false
from public.org_strategies s
cross join (values (1, 'Creación de contenido'), (2, 'Atención en tienda y venta'), (3, 'Seguimiento de contactos de la app'))
  as x(n, name)
where s.name = 'Tienda'
  and not exists (select 1 from public.org_channels c where c.strategy_id = s.id and public.org_norm(c.name) = public.org_norm(x.name));

-- Compartidas y estados: WhatsApp y redes sociales, solo compartidas, con el horario del genérico.
insert into public.org_subchannels (channel_id, name, sort, uses_goal, uses_share_goal,
  morning_start, morning_end, afternoon_start, afternoon_end)
select c.id, x.name, (select coalesce(max(sc.sort), 0) from public.org_subchannels sc where sc.channel_id = c.id) + x.n,
  false, true, g.morning_start, g.morning_end, g.afternoon_start, g.afternoon_end
from public.org_channels c
join public.org_strategies s on s.id = c.strategy_id and s.name = 'Tienda'
cross join (values (1, 'Compartidas WhatsApp'), (2, 'Compartidas redes sociales')) as x(n, name)
left join public.org_subchannels g on g.channel_id = c.id and g.name = 'Compartidas y estados'
where c.name = 'Compartidas y estados'
  and not exists (select 1 from public.org_subchannels sc where sc.channel_id = c.id and public.org_norm(sc.name) = public.org_norm(x.name));

-- Si ventas ya había agregado alguno con ese nombre, queda con las marcas pedidas.
update public.org_subchannels sc set uses_goal = false, uses_share_goal = true, active = true
from public.org_channels c join public.org_strategies s on s.id = c.strategy_id and s.name = 'Tienda'
where sc.channel_id = c.id and c.name = 'Compartidas y estados'
  and public.org_norm(sc.name) in (public.org_norm('Compartidas WhatsApp'), public.org_norm('Compartidas redes sociales'));

-- El genérico se desactiva: las asignaciones anteriores lo conservan.
update public.org_subchannels sc set active = false
from public.org_channels c join public.org_strategies s on s.id = c.strategy_id and s.name = 'Tienda'
where sc.channel_id = c.id and c.name = 'Compartidas y estados' and sc.name = 'Compartidas y estados';

-- Calle → Activación: «Activaciones en plazas», con el horario de las activaciones en barrios.
insert into public.org_subchannels (channel_id, name, sort, uses_goal, uses_share_goal,
  morning_start, morning_end, afternoon_start, afternoon_end)
select c.id, 'Activaciones en plazas', (select coalesce(max(sc.sort), 0) from public.org_subchannels sc where sc.channel_id = c.id) + 1,
  c.uses_goal, c.uses_share_goal, '10:00', '12:00', '16:30', '18:30'
from public.org_channels c
join public.org_strategies s on s.id = c.strategy_id and s.name = 'Calle'
where c.name = 'Activación'
  and not exists (select 1 from public.org_subchannels sc where sc.channel_id = c.id
    and public.org_norm(sc.name) = public.org_norm('Activaciones en plazas'));

-- Permiso de verificación ---------------------------------------------------------------------------------
-- Gerencia y Sistemas: todas; Cobros: las sucursales que tiene asignadas (research R7).
create function public.can_verify_shares(p_branch smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_is_active() and (
    public.is_global()
    or (public.app_role() = 'collections'
        and exists (select 1 from public.profile_branches pb where pb.profile_id = auth.uid() and pb.branch_id = p_branch))
  ), false)
$$;
revoke execute on function public.can_verify_shares(smallint) from public, anon;
grant execute on function public.can_verify_shares(smallint) to authenticated;

-- Volanteras de una asignación: lista limpia (sin repetidos) o error si el dato no es un arreglo de uuid.
create function public.org_flyer_ids(p jsonb) returns uuid[]
language plpgsql immutable set search_path = '' as $$
declare
  v uuid[];
begin
  if p is null or jsonb_typeof(p) = 'null' then return null; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 20
    or exists (select 1 from jsonb_array_elements(p) e
               where jsonb_typeof(e) <> 'string'
                 or (e #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'invalid_input' using detail = 'flyers';
  end if;
  select coalesce(array_agg(distinct (e #>> '{}')::uuid), '{}') into v from jsonb_array_elements(p) e;
  return v;
end;
$$;
revoke execute on function public.org_flyer_ids(jsonb) from public, anon, authenticated;

-- org_list: orden por persona, volanteras y verificación de compartidas (contracts/rpc.md) ------------------------
create or replace function public.org_list(p_from date, p_to date, p_branches smallint[] default null) returns jsonb
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
    -- Encargado, supervisor y auxiliar: solo su sucursal. Cobros no tiene sucursal propia: prohibido.
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
        'place', a.place, 'goal', a.goal, 'result', a.result,
        'share_goal', a.share_goal, 'share_result', a.share_result, 'batch_id', a.batch_id,
        'uses_goal', coalesce(sc.uses_goal, c.uses_goal), 'uses_share_goal', coalesce(sc.uses_share_goal, c.uses_share_goal),
        'uses_flyers', c.uses_flyers, 'flyer_ids', to_jsonb(a.flyer_ids),
        'flyers', coalesce((
          select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.full_name) order by f.full_name)
          from public.profiles f where f.id = any (a.flyer_ids)), '[]'::jsonb),
        'share_verified', a.share_verified, 'share_verified_note', a.share_verified_note,
        'share_verified_by_name', vb.full_name, 'share_verified_at', a.share_verified_at,
        'notes', a.notes, 'lead_id', a.lead_id, 'lead', l.full_name,
        'can_replan', public.org_can_replan(a.branch_id, a.work_date),
        'can_set_result', public.manages_org(a.branch_id)
      ) order by a.work_date, b.name, p.full_name, a.profile_id, a.shift, a.start_time nulls last)
      from public.org_assignments a
      join public.branches b on b.id = a.branch_id
      join public.profiles p on p.id = a.profile_id
      join public.org_strategies s on s.id = a.strategy_id
      join public.org_channels c on c.id = a.channel_id
      left join public.org_subchannels sc on sc.id = a.subchannel_id
      left join public.profiles l on l.id = a.lead_id
      left join public.profiles vb on vb.id = a.share_verified_by
      where a.branch_id = any (v_branches) and a.work_date between p_from and p_to
        and (not v_own_only or a.profile_id = auth.uid())
    ), '[]'::jsonb)
  );
end;
$$;

-- org_upsert: observaciones y volanteras (research R2, R6). org_save y org_save_many la usan sin cambios: en una
-- carga múltiple notes y flyer_ids van a todas porque org_save_many copia los datos comunes a cada ítem.
create or replace function public.org_upsert(p jsonb, p_batch uuid) returns uuid
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
  v_share integer := nullif(p ->> 'share_goal', '')::integer;
  v_place text := nullif(trim(p ->> 'place'), '');
  v_notes text := nullif(trim(p ->> 'notes'), '');
  v_flyers uuid[] := public.org_flyer_ids(p -> 'flyer_ids');
  v_flags record;
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
    -- La app publicada no manda notes ni flyer_ids: al editar, ausente = se conserva.
    if not p ? 'notes' then v_notes := v_old.notes; end if;
    if v_flyers is null then v_flyers := v_old.flyer_ids; end if;
  end if;
  v_flyers := coalesce(v_flyers, '{}');

  v_shift := nullif(p ->> 'shift', '')::public.shift;
  if v_shift is null then raise exception 'invalid_input' using detail = 'shift'; end if;
  v_start := nullif(p ->> 'start_time', '')::time;
  v_end := nullif(p ->> 'end_time', '')::time;
  if v_start is not null and v_end is not null and v_end <= v_start then
    raise exception 'invalid_input' using detail = 'time';
  end if;
  if v_goal is not null and v_goal not between 0 and 9999 then raise exception 'invalid_input' using detail = 'goal'; end if;
  if v_share is not null and v_share not between 0 and 9999 then raise exception 'invalid_input' using detail = 'share_goal'; end if;
  if v_place is not null and length(v_place) > 200 then raise exception 'invalid_input' using detail = 'place'; end if;
  if v_notes is not null and length(v_notes) > 300 then raise exception 'invalid_input' using detail = 'notes'; end if;

  perform public.org_check(v_branch, v_profile, v_id is null or v_profile is distinct from v_old.profile_id,
    v_strategy, v_channel, v_sub);

  if not (select s.uses_place from public.org_strategies s where s.id = v_strategy) then v_place := null; end if;
  -- Metas según la marca efectiva: la que no aplica se guarda vacía; la que aplica es obligatoria (004).
  select * into v_flags from public.org_goal_flags(v_channel, v_sub);
  if not v_flags.uses_goal then v_goal := null;
  elsif v_goal is null then raise exception 'invalid_input' using detail = 'goal'; end if;
  if not v_flags.uses_share_goal then v_share := null;
  elsif v_share is null then raise exception 'invalid_input' using detail = 'share_goal'; end if;

  -- Volanteras: solo si el canal las pide; volanteras activas de la sucursal (al editar, también las que ya tenía).
  if not (select c.uses_flyers from public.org_channels c where c.id = v_channel) then
    v_flyers := '{}';
  elsif exists (
    select 1 from unnest(v_flyers) f
    where not (v_id is not null and f = any (v_old.flyer_ids))
      and not exists (select 1 from public.profiles x
                      where x.id = f and x.active and x.role = 'field_volunteer' and x.branch_id = v_branch)) then
    raise exception 'invalid_input' using detail = 'flyers';
  end if;

  if v_id is null then
    insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
      channel_id, subchannel_id, place, goal, share_goal, notes, flyer_ids, batch_id, lead_id, created_by, updated_by)
    values (v_branch, v_day, v_shift, v_start, v_end, v_profile, v_strategy, v_channel, v_sub, v_place, v_goal,
      v_share, v_notes, v_flyers, p_batch, public.branch_lead(v_branch), auth.uid(), auth.uid())
    returning id into v_id;
  else
    update public.org_assignments set
      shift = v_shift, start_time = v_start, end_time = v_end, profile_id = v_profile, strategy_id = v_strategy,
      channel_id = v_channel, subchannel_id = v_sub, place = v_place, goal = v_goal, share_goal = v_share,
      notes = v_notes, flyer_ids = v_flyers, updated_by = auth.uid(), updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.org_upsert(jsonb, uuid) from public, anon, authenticated;

-- org_copy_day: copia también las volanteras que siguen activas en la sucursal (FR-010). Sin observaciones. -------
create or replace function public.org_copy_day(p_branch smallint, p_from date, p_to date) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if not public.manages_org(p_branch) then raise exception 'forbidden'; end if;
  if p_from is null or p_to is null or p_from = p_to then raise exception 'invalid_input' using detail = 'day'; end if;
  with batches as (
    select x.batch_id as old_id, gen_random_uuid() as new_id
    from (select distinct a.batch_id from public.org_assignments a
          where a.branch_id = p_branch and a.work_date = p_from and a.batch_id is not null) x
  )
  insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
    channel_id, subchannel_id, place, goal, share_goal, flyer_ids, batch_id, lead_id, created_by, updated_by)
  select a.branch_id, p_to, a.shift, a.start_time, a.end_time, a.profile_id, a.strategy_id, a.channel_id,
    a.subchannel_id,
    case when s.uses_place then a.place end,
    case when f.uses_goal then a.goal end,
    case when f.uses_share_goal then a.share_goal end,
    case when c.uses_flyers then coalesce((
      select array_agg(x.id order by x.id) from public.profiles x
      where x.id = any (a.flyer_ids) and x.active and x.role = 'field_volunteer' and x.branch_id = p_branch), '{}')
    else '{}' end,
    b.new_id,
    public.branch_lead(p_branch), auth.uid(), auth.uid()
  from public.org_assignments a
  join public.profiles p on p.id = a.profile_id and p.active and p.branch_id = p_branch
  join public.org_strategies s on s.id = a.strategy_id
  join public.org_channels c on c.id = a.channel_id
  cross join lateral public.org_goal_flags(a.channel_id, a.subchannel_id) f
  left join batches b on b.old_id = a.batch_id
  where a.branch_id = p_branch and a.work_date = p_from;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- org_add_subchannel: el subcanal nuevo toma las marcas de meta de su canal (FR-004, research R4) ----------------
create or replace function public.org_add_subchannel(p_branch smallint, p_channel smallint, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_found public.org_subchannels;
  v_channel public.org_channels;
  v_id smallint;
begin
  if p_branch is null or not public.manages_org(p_branch) then raise exception 'forbidden'; end if;
  select c.* into v_channel from public.org_channels c join public.org_strategies s on s.id = c.strategy_id
  where c.id = p_channel and c.active and s.active;
  if p_channel is null or not found then raise exception 'invalid_input' using detail = 'catalog'; end if;
  if length(v_name) not between 2 and 80 then raise exception 'invalid_input' using detail = 'name'; end if;

  select * into v_found from public.org_subchannels sc
  where sc.channel_id = p_channel and public.org_norm(sc.name) = public.org_norm(v_name)
  order by sc.active desc, sc.id limit 1;
  if found then
    if not v_found.active then raise exception 'invalid_input' using detail = 'inactive_subchannel'; end if;
    return jsonb_build_object('id', v_found.id, 'existed', true);
  end if;

  insert into public.org_subchannels (channel_id, name, sort, uses_goal, uses_share_goal, added_by, added_at)
  values (p_channel, v_name,
    coalesce((select max(sc.sort) from public.org_subchannels sc where sc.channel_id = p_channel), 0) + 1,
    v_channel.uses_goal, v_channel.uses_share_goal, auth.uid(), now())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'existed', false);
end;
$$;

-- org_share_list: asignaciones con compartidas para verificar (FR-012) -----------------------------------------
create function public.org_share_list(p_from date, p_to date, p_branches smallint[] default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_branches smallint[];
begin
  if not public.app_is_active() then raise exception 'forbidden'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 30 then
    raise exception 'invalid_input' using detail = 'range';
  end if;

  if public.is_global() then
    v_branches := case when coalesce(cardinality(p_branches), 0) = 0
                       then (select array_agg(b.id) from public.branches b) else p_branches end;
  elsif public.app_role() = 'collections' then
    if coalesce(cardinality(p_branches), 0) = 0 then
      select array_agg(pb.branch_id) into v_branches from public.profile_branches pb where pb.profile_id = auth.uid();
    else
      if exists (select 1 from unnest(p_branches) b where not public.can_verify_shares(b)) then raise exception 'forbidden'; end if;
      v_branches := p_branches;
    end if;
  else
    raise exception 'forbidden';
  end if;
  v_branches := coalesce(v_branches, '{}');

  return jsonb_build_object(
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.name)
      from public.branches b where b.id = any (v_branches)), '[]'::jsonb),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'branch_id', a.branch_id, 'branch', b.name, 'work_date', a.work_date, 'shift', a.shift,
        'start_time', to_char(a.start_time, 'HH24:MI'), 'end_time', to_char(a.end_time, 'HH24:MI'),
        'person', p.full_name, 'channel', c.name, 'subchannel', sc.name,
        'share_goal', a.share_goal, 'share_result', a.share_result,
        'share_verified', a.share_verified, 'share_verified_note', a.share_verified_note,
        'share_verified_by_name', vb.full_name, 'share_verified_at', a.share_verified_at
      ) order by a.work_date, b.name, p.full_name, a.profile_id, a.shift, a.start_time nulls last)
      from public.org_assignments a
      join public.branches b on b.id = a.branch_id
      join public.profiles p on p.id = a.profile_id
      join public.org_channels c on c.id = a.channel_id
      left join public.org_subchannels sc on sc.id = a.subchannel_id
      left join public.profiles vb on vb.id = a.share_verified_by
      where a.branch_id = any (v_branches) and a.work_date between p_from and p_to
        and (a.share_goal is not null or a.share_result is not null)
    ), '[]'::jsonb)
  );
end;
$$;

-- org_verify_shares: cantidad verificada y comentario, con quién y cuándo (FR-013). Nulo borra la verificación. ----
create function public.org_verify_shares(p_id uuid, p_verified integer, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_branch smallint;
  v_note text := nullif(trim(p_note), '');
begin
  select branch_id into v_branch from public.org_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if not public.can_verify_shares(v_branch) then raise exception 'forbidden'; end if;
  if p_verified is not null and p_verified not between 0 and 9999 then
    raise exception 'invalid_input' using detail = 'share_verified';
  end if;
  if v_note is not null and length(v_note) > 300 then raise exception 'invalid_input' using detail = 'notes'; end if;
  if p_verified is null then
    update public.org_assignments set share_verified = null, share_verified_note = null,
      share_verified_by = null, share_verified_at = null
    where id = p_id;
  else
    update public.org_assignments set share_verified = p_verified, share_verified_note = v_note,
      share_verified_by = auth.uid(), share_verified_at = now()
    where id = p_id;
  end if;
end;
$$;

-- admin_set_collections: Sistemas convierte un usuario en Cobros con sus sucursales (research R7). -----------------
-- Va por RPC y no por la Edge Function admin-users, que no se puede publicar desde aquí.
create function public.admin_set_collections(p_profile uuid, p_branches smallint[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.app_is_active() or public.app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_profile is null or not exists (select 1 from public.profiles p where p.id = p_profile) then raise exception 'not_found'; end if;
  if p_profile = auth.uid() then raise exception 'invalid_input' using detail = 'self'; end if;
  if coalesce(cardinality(p_branches), 0) = 0
    or exists (select 1 from unnest(p_branches) b where b is null or not exists (select 1 from public.branches x where x.id = b)) then
    raise exception 'invalid_input' using detail = 'branches';
  end if;
  update public.profiles set role = 'collections', branch_id = null where id = p_profile;
  delete from public.profile_branches where profile_id = p_profile;
  insert into public.profile_branches (profile_id, branch_id) select distinct p_profile, b from unnest(p_branches) b;
end;
$$;

revoke execute on function public.org_share_list(date, date, smallint[]), public.org_verify_shares(uuid, integer, text),
  public.admin_set_collections(uuid, smallint[]) from public, anon;
grant execute on function public.org_share_list(date, date, smallint[]), public.org_verify_shares(uuid, integer, text),
  public.admin_set_collections(uuid, smallint[]) to authenticated;
