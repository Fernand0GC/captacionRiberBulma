-- Subcanal y horario obligatorios (spec 008). Solo reemplaza org_upsert (núcleo de org_save y org_save_many).
--  · Hora de inicio y de fin obligatorias (FR-003).
--  · Subcanal obligatorio si el canal tiene al menos un subcanal activo (FR-001).
-- No toca org_set_result ni la copia de días: las asignaciones viejas incompletas siguen igual (FR-007).

-- org_upsert: igual a la 007 más las dos reglas. ---------------------------------------------------------------------
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
  -- 008 (FR-003): inicio y fin obligatorios; fin después de inicio (como antes).
  if v_start is null or v_end is null or v_end <= v_start then
    raise exception 'invalid_input' using detail = 'time';
  end if;
  if v_goal is not null and v_goal not between 0 and 9999 then raise exception 'invalid_input' using detail = 'goal'; end if;
  if v_share is not null and v_share not between 0 and 9999 then raise exception 'invalid_input' using detail = 'share_goal'; end if;
  if v_place is not null and length(v_place) > 200 then raise exception 'invalid_input' using detail = 'place'; end if;
  if v_notes is not null and length(v_notes) > 300 then raise exception 'invalid_input' using detail = 'notes'; end if;

  perform public.org_check(v_branch, v_profile, v_id is null or v_profile is distinct from v_old.profile_id,
    v_strategy, v_channel, v_sub);
  -- 008 (FR-001): si el canal tiene algún subcanal activo, la asignación tiene que tener subcanal.
  if v_sub is null and exists (select 1 from public.org_subchannels sc where sc.channel_id = v_channel and sc.active) then
    raise exception 'invalid_input' using detail = 'subchannel';
  end if;

  if not (select s.uses_place from public.org_strategies s where s.id = v_strategy) then v_place := null; end if;
  -- Metas según la marca efectiva: la que no aplica se guarda vacía. Captación es obligatoria si aplica (004);
  -- compartidas es opcional (007, FR-011).
  select * into v_flags from public.org_goal_flags(v_channel, v_sub);
  if not v_flags.uses_goal then v_goal := null;
  elsif v_goal is null then raise exception 'invalid_input' using detail = 'goal'; end if;
  if not v_flags.uses_share_goal then v_share := null; end if;

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
