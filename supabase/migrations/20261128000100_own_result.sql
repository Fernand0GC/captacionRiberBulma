-- Spec 039: el auxiliar registra el resultado de sus tareas.
-- Deshacer: volver a crear las 3 funciones existentes con los cuerpos de
-- specs/039-auxiliar-registra-resultado/codex/vigentes.sql y luego ejecutar:
-- drop function public.org_report_result(uuid, integer, integer, boolean, text);
-- alter table public.org_assignments drop column done, drop column result_by, drop column result_at;

-- spec 039: estado de tareas sin meta y trazabilidad del resultado.
alter table public.org_assignments
  add column if not exists done boolean,
  add column if not exists result_by uuid references public.profiles(id),
  add column if not exists result_at timestamptz;
comment on column public.org_assignments.done is 'Tarea hecha o no hecha; null = sin marcar.';
comment on column public.org_assignments.result_by is 'Última persona que registró el resultado; null si se borró todo.';
comment on column public.org_assignments.result_at is 'Fecha y hora del último registro del resultado.';

-- spec 039: permiso vigente de gestión o resultado propio del auxiliar en el día.
create or replace function public.org_report_result(
  p_id uuid, p_result integer, p_share_result integer, p_done boolean, p_notes text
) returns void
language plpgsql security definer set search_path = ''
as $function$
declare
  v_branch smallint;
  v_day date;
  v_profile uuid;
  v_result_by uuid;
  v_manager boolean;
  v_own boolean;
  v_notes text := nullif(trim(p_notes), '');
begin
  select branch_id, work_date, profile_id, result_by
    into v_branch, v_day, v_profile, v_result_by
  from public.org_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  v_manager := public.org_can_replan(v_branch, v_day)
    or (v_day < public.org_day_close_since() and public.manages_org(v_branch));
  v_own := public.app_is_active() and public.app_role() = 'field_assistant' and v_profile = auth.uid()
    and v_day = (now() at time zone 'America/La_Paz')::date;
  if not v_manager and not v_own then raise exception 'forbidden'; end if;
  if not v_manager and v_result_by is not null and v_result_by <> auth.uid() then
    raise exception 'result_locked';
  end if;
  if p_result is not null and p_result not between 0 and 9999 then raise exception 'invalid_input' using detail = 'result'; end if;
  if p_share_result is not null and p_share_result not between 0 and 9999 then
    raise exception 'invalid_input' using detail = 'share_result';
  end if;
  if v_notes is not null and length(v_notes) > 300 then raise exception 'invalid_input' using detail = 'notes'; end if;
  update public.org_assignments set result = p_result, share_result = p_share_result, done = p_done, notes = v_notes,
    updated_by = auth.uid(), updated_at = now(),
    result_by = case when p_result is null and p_share_result is null and p_done is null then null else auth.uid() end,
    result_at = case when p_result is null and p_share_result is null and p_done is null then null else now() end
  where id = p_id;
end;
$function$;
revoke execute on function public.org_report_result(uuid, integer, integer, boolean, text) from public, anon;
grant execute on function public.org_report_result(uuid, integer, integer, boolean, text) to authenticated;

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
        -- spec 039: estado y autor del resultado.
        'done', a.done, 'result_by', a.result_by, 'result_by_name', rb.full_name, 'result_at', a.result_at,
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
          -- spec 039: el auxiliar registra sus tareas de hoy mientras otro no haya corregido.
          or (v_role = 'field_assistant' and a.profile_id = auth.uid()
            and a.work_date = (now() at time zone 'America/La_Paz')::date
            and (a.result_by is null or a.result_by = auth.uid()))
      ) order by a.work_date, b.name, p.full_name, a.profile_id, a.shift, a.start_time nulls last)
      from public.org_assignments a
      join public.branches b on b.id = a.branch_id
      join public.profiles p on p.id = a.profile_id
      join public.org_strategies s on s.id = a.strategy_id
      join public.org_channels c on c.id = a.channel_id
      left join public.org_subchannels sc on sc.id = a.subchannel_id
      left join public.profiles l on l.id = a.lead_id
      -- spec 039: nombre de quien registró.
      left join public.profiles rb on rb.id = a.result_by
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
  -- spec 039: conservar compartidas y hecho al determinar si queda algún resultado.
  update public.org_assignments set result = p_result, notes = v_notes, updated_by = auth.uid(), updated_at = now(),
    result_by = case when p_result is null and share_result is null and done is null then null else auth.uid() end,
    result_at = case when p_result is null and share_result is null and done is null then null else now() end
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
  -- spec 039: conservar hecho al determinar si queda algún resultado.
  update public.org_assignments set result = p_result, share_result = p_share_result, notes = v_notes,
    updated_by = auth.uid(), updated_at = now(),
    result_by = case when p_result is null and p_share_result is null and done is null then null else auth.uid() end,
    result_at = case when p_result is null and p_share_result is null and done is null then null else now() end
  where id = p_id;
end;
$function$
;
