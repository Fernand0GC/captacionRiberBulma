-- Ajustes de la organización comercial pedidos por ventas (spec 004, 2026-11-18):
--  · Dos metas por asignación: captación (goal/result, sin renombrar) y compartidas (share_goal/share_result).
--  · Cada subcanal marca qué metas usa; el canal vale para asignaciones sin subcanal. Las metas que aplican son
--    obligatorias al guardar (crear o editar); las que no aplican se guardan vacías.
--  · Selección múltiple: org_save_many crea una asignación por subcanal en una sola transacción, unidas por batch_id.
--  · Quien planifica agrega el subcanal que falta con org_add_subchannel (sin duplicados por nombre normalizado).
-- Todo aditivo: la app publicada sigue funcionando (org_set_result de 3 argumentos se conserva).
-- Diseño: specs/004-ajustes-organizacion-ventas/{research,data-model}.md y contracts/rpc.md.

-- Columnas -------------------------------------------------------------------------------------------------
alter table public.org_channels add column uses_share_goal boolean not null default false;

alter table public.org_subchannels
  add column uses_goal boolean not null default true,
  add column uses_share_goal boolean not null default false,
  add column added_by uuid references public.profiles (id),
  add column added_at timestamptz;

alter table public.org_assignments
  add column share_goal smallint check (share_goal is null or share_goal between 0 and 9999),
  add column share_result smallint check (share_result is null or share_result between 0 and 9999),
  add column batch_id uuid;
create index org_assignments_batch_idx on public.org_assignments (batch_id) where batch_id is not null;

-- Catálogo inicial de marcas (FR-005) ---------------------------------------------------------------------
-- Los subcanales parten con la marca de captación de su canal; después, los casos que pidió ventas.
update public.org_subchannels sc set uses_goal = c.uses_goal from public.org_channels c where c.id = sc.channel_id;

update public.org_channels c set uses_goal = false, uses_share_goal = true
from public.org_strategies s
where s.id = c.strategy_id and s.name = 'Tienda' and c.name = 'Compartidas y estados';

update public.org_subchannels sc set
  uses_goal = x.goal,
  uses_share_goal = x.share
from (values
  ('RRSS-Mensajería', 'Barrios chinos - grupos', true, true),
  ('RRSS-Mensajería', 'Mensajería WhatsApp', true, true),
  ('RRSS-Mensajería', 'Mensajería Facebook página', false, false),
  ('RRSS-Mensajería', 'Mensajería Marketplace', false, false),
  ('RRSS-Mensajería', 'Mensajería TikTok', false, false),
  ('Comentarios', 'Comentarios Facebook', false, false),
  ('Comentarios', 'Comentarios TikTok', false, false),
  ('Compartidas y estados', 'Compartidas y estados', false, true)
) as x(channel, name, goal, share)
join public.org_channels c on c.name = x.channel
join public.org_strategies s on s.id = c.strategy_id and s.name = 'Tienda'
where sc.channel_id = c.id and sc.name = x.name;

-- Funciones de apoyo ---------------------------------------------------------------------------------------

-- Nombre para comparar: minúsculas, sin tildes ni diéresis, espacios colapsados y recortados (FR-014).
create function public.org_norm(p text) returns text
language sql immutable set search_path = '' as $$
  select trim(regexp_replace(
    translate(lower(coalesce(p, '')), 'áéíóúàèìòùäëïöüâêîôû', 'aeiouaeiouaeiouaeiou'), '\s+', ' ', 'g'))
$$;

-- Marca efectiva de metas: la del subcanal si hay subcanal; si no, la del canal (data-model).
create function public.org_goal_flags(p_channel smallint, p_sub smallint,
  out uses_goal boolean, out uses_share_goal boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(sc.uses_goal, c.uses_goal), coalesce(sc.uses_share_goal, c.uses_share_goal)
  from public.org_channels c
  left join public.org_subchannels sc on sc.id = p_sub and sc.channel_id = c.id
  where c.id = p_channel
$$;

revoke execute on function public.org_norm(text), public.org_goal_flags(smallint, smallint)
  from public, anon, authenticated;

-- org_list: agrega metas y resultado de compartidas, batch_id y marcas efectivas vigentes (contracts/rpc.md) ----
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
        'place', a.place, 'goal', a.goal, 'result', a.result,
        'share_goal', a.share_goal, 'share_result', a.share_result, 'batch_id', a.batch_id,
        'uses_goal', coalesce(sc.uses_goal, c.uses_goal), 'uses_share_goal', coalesce(sc.uses_share_goal, c.uses_share_goal),
        'notes', a.notes, 'lead_id', a.lead_id, 'lead', l.full_name,
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

-- org_upsert: núcleo de org_save y org_save_many (crear con batch o editar). No se expone a la app. ---------------
create function public.org_upsert(p jsonb, p_batch uuid) returns uuid
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
  end if;

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

  perform public.org_check(v_branch, v_profile, v_id is null or v_profile is distinct from v_old.profile_id,
    v_strategy, v_channel, v_sub);

  if not (select s.uses_place from public.org_strategies s where s.id = v_strategy) then v_place := null; end if;
  -- Metas según la marca efectiva: la que no aplica se guarda vacía; la que aplica es obligatoria (FR-003, FR-004).
  select * into v_flags from public.org_goal_flags(v_channel, v_sub);
  if not v_flags.uses_goal then v_goal := null;
  elsif v_goal is null then raise exception 'invalid_input' using detail = 'goal'; end if;
  if not v_flags.uses_share_goal then v_share := null;
  elsif v_share is null then raise exception 'invalid_input' using detail = 'share_goal'; end if;

  if v_id is null then
    insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
      channel_id, subchannel_id, place, goal, share_goal, batch_id, lead_id, created_by, updated_by)
    values (v_branch, v_day, v_shift, v_start, v_end, v_profile, v_strategy, v_channel, v_sub, v_place, v_goal,
      v_share, p_batch, public.branch_lead(v_branch), auth.uid(), auth.uid())
    returning id into v_id;
  else
    update public.org_assignments set
      shift = v_shift, start_time = v_start, end_time = v_end, profile_id = v_profile, strategy_id = v_strategy,
      channel_id = v_channel, subchannel_id = v_sub, place = v_place, goal = v_goal, share_goal = v_share,
      updated_by = auth.uid(), updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.org_upsert(jsonb, uuid) from public, anon, authenticated;

-- org_save: misma firma; ahora con share_goal y metas obligatorias.
create or replace function public.org_save(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  return public.org_upsert(p, null);
end;
$$;

-- org_save_many: una asignación por subcanal marcado, todo o nada (FR-010, FR-012) ------------------------------
create function public.org_save_many(p jsonb) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  v_items jsonb := coalesce(p -> 'items', '[]'::jsonb);
  v_n integer;
  v_batch uuid;
  v_item jsonb;
  v_ids uuid[] := '{}';
begin
  if nullif(p ->> 'id', '') is not null then raise exception 'invalid_input' using detail = 'id'; end if;
  if jsonb_typeof(v_items) <> 'array' then raise exception 'invalid_input' using detail = 'catalog'; end if;
  v_n := jsonb_array_length(v_items);
  if v_n = 0 then
    return array[public.org_upsert(p - 'items' - 'subchannel_id', null)];
  end if;
  if v_n > 20 then raise exception 'invalid_input' using detail = 'catalog'; end if;
  -- Cada ítem lleva su subcanal; repetidos o vacíos no se aceptan.
  if (select count(distinct nullif(i ->> 'subchannel_id', '')) from jsonb_array_elements(v_items) i) <> v_n then
    raise exception 'invalid_input' using detail = 'catalog';
  end if;
  v_batch := case when v_n > 1 then gen_random_uuid() end;
  for v_item in select i from jsonb_array_elements(v_items) i loop
    v_ids := v_ids || public.org_upsert(
      (p - 'items') || jsonb_build_object('subchannel_id', v_item -> 'subchannel_id',
        'goal', v_item -> 'goal', 'share_goal', v_item -> 'share_goal'),
      v_batch);
  end loop;
  return v_ids;
end;
$$;

-- org_set_result con resultado de compartidas (sobrecarga; la de 3 argumentos queda para la app publicada) -----
create function public.org_set_result(p_id uuid, p_result integer, p_notes text, p_share_result integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_branch smallint;
  v_notes text := nullif(trim(p_notes), '');
begin
  select branch_id into v_branch from public.org_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if not public.manages_org(v_branch) then raise exception 'forbidden'; end if;
  if p_result is not null and p_result not between 0 and 9999 then raise exception 'invalid_input' using detail = 'result'; end if;
  if p_share_result is not null and p_share_result not between 0 and 9999 then
    raise exception 'invalid_input' using detail = 'share_result';
  end if;
  if v_notes is not null and length(v_notes) > 300 then raise exception 'invalid_input' using detail = 'notes'; end if;
  update public.org_assignments set result = p_result, share_result = p_share_result, notes = v_notes,
    updated_by = auth.uid(), updated_at = now()
  where id = p_id;
end;
$$;

-- org_copy_day: copia también share_goal (según marcas vigentes) y da un batch_id nuevo por grupo ---------------
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
    channel_id, subchannel_id, place, goal, share_goal, batch_id, lead_id, created_by, updated_by)
  select a.branch_id, p_to, a.shift, a.start_time, a.end_time, a.profile_id, a.strategy_id, a.channel_id,
    a.subchannel_id,
    case when s.uses_place then a.place end,
    case when f.uses_goal then a.goal end,
    case when f.uses_share_goal then a.share_goal end,
    b.new_id,
    public.branch_lead(p_branch), auth.uid(), auth.uid()
  from public.org_assignments a
  join public.profiles p on p.id = a.profile_id and p.active and p.branch_id = p_branch
  join public.org_strategies s on s.id = a.strategy_id
  cross join lateral public.org_goal_flags(a.channel_id, a.subchannel_id) f
  left join batches b on b.old_id = a.batch_id
  where a.branch_id = p_branch and a.work_date = p_from;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- org_add_subchannel: quien planifica agrega el subcanal que falta (FR-013 a FR-015) ---------------------------
create function public.org_add_subchannel(p_branch smallint, p_channel smallint, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_found public.org_subchannels;
  v_id smallint;
begin
  if p_branch is null or not public.manages_org(p_branch) then raise exception 'forbidden'; end if;
  if p_channel is null or not exists (
    select 1 from public.org_channels c join public.org_strategies s on s.id = c.strategy_id
    where c.id = p_channel and c.active and s.active) then
    raise exception 'invalid_input' using detail = 'catalog';
  end if;
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
    true, false, auth.uid(), now())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'existed', false);
end;
$$;

revoke execute on function public.org_save_many(jsonb), public.org_set_result(uuid, integer, text, integer),
  public.org_add_subchannel(smallint, smallint, text) from public, anon;
grant execute on function public.org_save_many(jsonb), public.org_set_result(uuid, integer, text, integer),
  public.org_add_subchannel(smallint, smallint, text) to authenticated;
