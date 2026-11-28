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

CREATE OR REPLACE FUNCTION public.org_set_result(p_id uuid, p_result integer, p_notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_branch smallint;
  v_day date;
  v_notes text := nullif(trim(p_notes), '');
begin
  -- spec 032, obs. 7: el permiso de resultados depende del día de la asignación.
  select branch_id, work_date into v_branch, v_day from public.org_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  -- spec 032, criterio 15: antes de la fecha de inicio basta con gestionar la sucursal.
  if not (public.org_can_replan(v_branch, v_day)
          or (v_day < public.org_day_close_since() and public.manages_org(v_branch))) then raise exception 'forbidden'; end if;
  if p_result is not null and p_result not between 0 and 9999 then raise exception 'invalid_input' using detail = 'result'; end if;
  if v_notes is not null and length(v_notes) > 300 then raise exception 'invalid_input' using detail = 'notes'; end if;
  update public.org_assignments set result = p_result, notes = v_notes, updated_by = auth.uid(), updated_at = now()
  where id = p_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.org_set_result(p_id uuid, p_result integer, p_notes text, p_share_result integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_branch smallint;
  v_day date;
  v_notes text := nullif(trim(p_notes), '');
begin
  -- spec 032, obs. 7: el permiso de resultados depende del día de la asignación.
  select branch_id, work_date into v_branch, v_day from public.org_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  -- spec 032, criterio 15: antes de la fecha de inicio basta con gestionar la sucursal.
  if not (public.org_can_replan(v_branch, v_day)
          or (v_day < public.org_day_close_since() and public.manages_org(v_branch))) then raise exception 'forbidden'; end if;
  if p_result is not null and p_result not between 0 and 9999 then raise exception 'invalid_input' using detail = 'result'; end if;
  if p_share_result is not null and p_share_result not between 0 and 9999 then
    raise exception 'invalid_input' using detail = 'share_result';
  end if;
  if v_notes is not null and length(v_notes) > 300 then raise exception 'invalid_input' using detail = 'notes'; end if;
  update public.org_assignments set result = p_result, share_result = p_share_result, notes = v_notes,
    updated_by = auth.uid(), updated_at = now()
  where id = p_id;
end;
$function$
;
