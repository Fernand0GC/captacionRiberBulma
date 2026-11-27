-- spec 035: freelancers que van en la asignación.
-- Deshacer: recrear org_upsert, org_list y org_copy_day_v2 con
-- specs/035-freelancers-en-asignacion/codex/vigentes.sql; después:
-- drop function public.org_add_freelancer(smallint, text);
-- alter table public.org_assignments drop column freelancer_ids;
-- alter table public.org_channels drop column uses_freelancers;

alter table public.org_channels add column if not exists uses_freelancers boolean not null default false;
update public.org_channels set uses_freelancers = true where public.referrer_key(name) = 'freelancers';
alter table public.org_assignments add column if not exists freelancer_ids smallint[] not null default '{}';

-- ===== public.org_upsert(jsonb,uuid)
CREATE OR REPLACE FUNCTION public.org_upsert(p jsonb, p_batch uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_freelancers smallint[];
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
  -- spec 035: ausente al editar conserva los ids; validar y normalizar la lista recibida.
  if not p ? 'freelancer_ids' then
    v_freelancers := coalesce(v_old.freelancer_ids, '{}');
  else
    begin
      if jsonb_typeof(p -> 'freelancer_ids') is distinct from 'array' then
        raise exception 'invalid_input' using detail = 'freelancers';
      end if;
      if exists (select 1 from jsonb_array_elements(p -> 'freelancer_ids') x
                 where jsonb_typeof(x) <> 'number' or x::text !~ '^-?[0-9]+$') then
        raise exception 'invalid_input' using detail = 'freelancers';
      end if;
      select coalesce(array_agg(distinct x::smallint order by x::smallint), '{}')
        into v_freelancers from jsonb_array_elements_text(p -> 'freelancer_ids') x;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'invalid_input' using detail = 'freelancers';
    end;
  end if;


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
  -- compartidas es obligatoria si aplica (030); reemplaza la FR-011 de la 007.
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

  -- spec 035: freelancers activos de la sucursal, o los que ya tenía al editar.
  if not (select c.uses_freelancers from public.org_channels c where c.id = v_channel) then
    v_freelancers := '{}';
  elsif exists (
    select 1 from unnest(v_freelancers) f
    where not (v_id is not null and f = any (v_old.freelancer_ids))
      and not exists (select 1 from public.referrers x
                      where x.id = f and x.active and x.kind = 'freelance'
                        and x.merged_into is null and x.branch_id = v_branch)) then
    raise exception 'invalid_input' using detail = 'freelancers';
  end if;

  -- spec 032, obs. 8: exigir resultados solo al crear, después de validar los datos.
  if v_id is null then
    perform public.org_check_results(v_branch, v_day);
  end if;

  -- 011: no dos asignaciones iguales. El candado serializa con otros guardados y con la copia del mismo día.
  perform pg_advisory_xact_lock(hashtext('org_copy_day'), hashtext(v_branch::text || '|' || v_day::text));
  if exists (
    select 1 from public.org_assignments d
    where d.branch_id = v_branch and d.work_date = v_day and d.profile_id = v_profile and d.shift = v_shift
      and d.start_time = v_start and d.end_time = v_end and d.channel_id = v_channel
      and d.subchannel_id is not distinct from v_sub
      and (v_id is null or d.id <> v_id)) then
    raise exception 'duplicate_assignment';
  end if;

  if v_id is null then
    insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
      channel_id, subchannel_id, place, goal, share_goal, notes, flyer_ids, freelancer_ids, batch_id, lead_id, created_by, updated_by)
    values (v_branch, v_day, v_shift, v_start, v_end, v_profile, v_strategy, v_channel, v_sub, v_place, v_goal,
      v_share, v_notes, v_flyers, v_freelancers, p_batch, public.branch_lead(v_branch), auth.uid(), auth.uid())
    returning id into v_id;
  else
    update public.org_assignments set
      shift = v_shift, start_time = v_start, end_time = v_end, profile_id = v_profile, strategy_id = v_strategy,
      channel_id = v_channel, subchannel_id = v_sub, place = v_place, goal = v_goal, share_goal = v_share,
      notes = v_notes, flyer_ids = v_flyers, freelancer_ids = v_freelancers, updated_by = auth.uid(), updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end;
$function$
;

-- ===== public.org_list(date,date,smallint[])
CREATE OR REPLACE FUNCTION public.org_list(p_from date, p_to date, p_branches smallint[] DEFAULT NULL::smallint[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        -- spec 035: incluir también los nombres de freelancers históricos.
        'uses_freelancers', c.uses_freelancers, 'freelancer_ids', to_jsonb(a.freelancer_ids),
        'freelancers', coalesce((
          select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name) order by f.name)
          from public.referrers f where f.id = any (a.freelancer_ids)), '[]'::jsonb),
        'share_verified', a.share_verified, 'share_verified_note', a.share_verified_note,
        'share_verified_by_name', vb.full_name, 'share_verified_at', a.share_verified_at,
        'notes', a.notes, 'lead_id', a.lead_id, 'lead', l.full_name,
        'can_replan', public.org_can_replan(a.branch_id, a.work_date),
        -- spec 032, criterio 15: mostrar Resultado con el mismo permiso y fecha de inicio.
        'can_set_result', (public.org_can_replan(a.branch_id, a.work_date)
          or (a.work_date < public.org_day_close_since() and public.manages_org(a.branch_id)))
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
$function$
;

-- ===== public.org_copy_day_v2(smallint,date,date)
CREATE OR REPLACE FUNCTION public.org_copy_day_v2(p_branch smallint, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_total integer;
  v_n integer;
begin
  if not public.manages_org(p_branch) then raise exception 'forbidden'; end if;
  if p_from is null or p_to is null or p_from = p_to then raise exception 'invalid_input' using detail = 'day'; end if;
  -- spec 032, obs. 8: exigir resultados del último día trabajado antes de copiar.
  perform public.org_check_results(p_branch, p_to);
  perform pg_advisory_xact_lock(hashtext('org_copy_day'), hashtext(p_branch::text || '|' || p_to::text));

  -- Candidatas: asignaciones del origen de personas que siguen activas en la sucursal.
  select count(*) into v_total
  from public.org_assignments a
  join public.profiles p on p.id = a.profile_id and p.active and p.branch_id = p_branch
  where a.branch_id = p_branch and a.work_date = p_from;

  with src as (
    select distinct on (a.profile_id, a.shift, a.start_time, a.end_time, a.channel_id, a.subchannel_id) a.*
    from public.org_assignments a
    join public.profiles p on p.id = a.profile_id and p.active and p.branch_id = p_branch
    where a.branch_id = p_branch and a.work_date = p_from
      and not exists (
        select 1 from public.org_assignments d
        where d.branch_id = p_branch and d.work_date = p_to and d.profile_id = a.profile_id and d.shift = a.shift
          and d.start_time is not distinct from a.start_time and d.end_time is not distinct from a.end_time
          and d.channel_id = a.channel_id and d.subchannel_id is not distinct from a.subchannel_id)
    order by a.profile_id, a.shift, a.start_time, a.end_time, a.channel_id, a.subchannel_id, a.created_at
  ),
  batches as (
    select x.batch_id as old_id, gen_random_uuid() as new_id
    from (select distinct s.batch_id from src s where s.batch_id is not null) x
  )
  insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
    channel_id, subchannel_id, place, goal, share_goal, flyer_ids, freelancer_ids, batch_id, lead_id, created_by, updated_by)
  select a.branch_id, p_to, a.shift, a.start_time, a.end_time, a.profile_id, a.strategy_id, a.channel_id,
    a.subchannel_id,
    case when s.uses_place then a.place end,
    case when f.uses_goal then a.goal end,
    case when f.uses_share_goal then a.share_goal end,
    case when c.uses_flyers then coalesce((
      select array_agg(x.id order by x.id) from public.profiles x
      where x.id = any (a.flyer_ids) and x.active and x.role = 'field_volunteer' and x.branch_id = p_branch), '{}')
    else '{}' end,
    -- spec 035: copiar solo freelancers que siguen disponibles en la sucursal.
    case when c.uses_freelancers then coalesce((
      select array_agg(x.id order by x.id) from public.referrers x
      where x.id = any (a.freelancer_ids) and x.active and x.kind = 'freelance'
        and x.merged_into is null and x.branch_id = p_branch), '{}')
    else '{}' end,
    b.new_id,
    public.branch_lead(p_branch), auth.uid(), auth.uid()
  from src a
  join public.org_strategies s on s.id = a.strategy_id
  join public.org_channels c on c.id = a.channel_id
  cross join lateral public.org_goal_flags(a.channel_id, a.subchannel_id) f
  left join batches b on b.old_id = a.batch_id;
  get diagnostics v_n = row_count;
  return jsonb_build_object('copied', v_n, 'skipped', v_total - v_n);
end;
$function$
;

-- spec 035: alta desde la planificación, sin duplicar nombres de la sucursal.
create or replace function public.org_add_freelancer(p_branch smallint, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_name text := regexp_replace(trim(p_name), '\s+', ' ', 'g');
  v_id smallint;
begin
  if not public.manages_org(p_branch) then raise exception 'forbidden'; end if;
  if v_name is null or length(v_name) not between 2 and 60 then
    raise exception 'invalid_input' using detail = 'name';
  end if;
  select coalesce(r.merged_into, r.id) into v_id from public.referrers r
  where r.branch_id = p_branch and public.referrer_key(r.name) = public.referrer_key(v_name);
  if found then return jsonb_build_object('id', v_id, 'existed', true); end if;

  insert into public.referrers (branch_id, name, kind, source, created_by)
  values (p_branch, v_name, 'freelance', 'manager', auth.uid())
  on conflict (branch_id, public.referrer_key(name)) do nothing
  returning id into v_id;
  -- Otra alta simultánea puede haber ganado el índice único.
  if v_id is null then
    select coalesce(r.merged_into, r.id) into v_id from public.referrers r
    where r.branch_id = p_branch and public.referrer_key(r.name) = public.referrer_key(v_name);
    return jsonb_build_object('id', v_id, 'existed', true);
  end if;
  return jsonb_build_object('id', v_id, 'existed', false);
end;
$function$;
revoke execute on function public.org_add_freelancer(smallint, text) from public, anon;
grant execute on function public.org_add_freelancer(smallint, text) to authenticated;
