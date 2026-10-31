-- Planificación unida a las captaciones (2026-10-30): cada actividad puede tener un canal y una meta de
-- captaciones (número). El plan cuenta solo las captaciones de su sucursal, día y horario (desde–hasta; sin
-- "hasta", todo el turno) y, si tiene canal, solo las de ese canal. No cambia el registro del volantero: se
-- cuenta al leer el plan, así sigue funcionando sin señal.

alter table public.agenda_activities
  add column channel_id smallint references public.channels (id),
  add column goal_count smallint check (goal_count is null or goal_count between 1 and 9999);

-- Captaciones válidas que caen en la actividad (hora de La Paz).
create function public.activity_captures(a public.agenda_activities) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.prospects p
  where p.branch_id = a.branch_id
    and p.status = 'active'
    and (p.client_created_at at time zone 'America/La_Paz')::date = a.activity_date
    and case
          when a.end_time is null then p.shift = a.shift
          else (p.client_created_at at time zone 'America/La_Paz')::time >= a.start_time
           and (p.client_created_at at time zone 'America/La_Paz')::time < a.end_time
        end
    and (a.channel_id is null or p.channel_id = a.channel_id)
$$;
revoke execute on function public.activity_captures(public.agenda_activities) from public, anon, authenticated;

create or replace function public.agenda_day(p_branch smallint, p_day date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.manages_branch(p_branch) or (public.app_is_active() and public.app_branch() = p_branch)) then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object(
    'can_edit', public.manages_branch(p_branch),
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'shift', a.shift, 'start_time', to_char(a.start_time, 'HH24:MI'), 'end_time', to_char(a.end_time, 'HH24:MI'),
        'strategy_id', a.strategy_id, 'strategy', s.name, 'description', a.description, 'responsibles', a.responsibles,
        'goal', a.goal, 'places', a.places, 'status', a.status, 'result', a.result,
        'channel_id', a.channel_id, 'channel', c.name, 'goal_count', a.goal_count, 'captures', public.activity_captures(a)
      ) order by a.shift, a.start_time, a.created_at)
      from public.agenda_activities a
      left join public.agenda_strategies s on s.id = a.strategy_id
      left join public.channels c on c.id = a.channel_id
      where a.branch_id = p_branch and a.activity_date = p_day
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_activity(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_branch smallint := (p ->> 'branch_id')::smallint;
  v_existing public.agenda_activities;
begin
  if v_id is not null then
    select * into v_existing from public.agenda_activities where id = v_id;
    if not found then raise exception 'not_found'; end if;
    v_branch := v_existing.branch_id;
  end if;
  if v_branch is null or not public.manages_branch(v_branch) then raise exception 'forbidden'; end if;
  if nullif(trim(p ->> 'description'), '') is null then raise exception 'invalid_input' using detail = 'description'; end if;

  if v_id is null then
    insert into public.agenda_activities (branch_id, activity_date, shift, start_time, end_time, strategy_id, description,
      responsibles, goal, places, channel_id, goal_count, created_by, updated_by)
    values (v_branch, (p ->> 'activity_date')::date, (p ->> 'shift')::public.shift, (p ->> 'start_time')::time,
      nullif(p ->> 'end_time', '')::time, nullif(p ->> 'strategy_id', '')::smallint, trim(p ->> 'description'),
      nullif(trim(p ->> 'responsibles'), ''), nullif(trim(p ->> 'goal'), ''), nullif(trim(p ->> 'places'), ''),
      nullif(p ->> 'channel_id', '')::smallint, nullif(p ->> 'goal_count', '')::smallint, auth.uid(), auth.uid())
    returning id into v_id;
  else
    update public.agenda_activities set
      shift = coalesce(nullif(p ->> 'shift', '')::public.shift, shift),
      start_time = coalesce(nullif(p ->> 'start_time', '')::time, start_time),
      end_time = nullif(p ->> 'end_time', '')::time,
      strategy_id = nullif(p ->> 'strategy_id', '')::smallint,
      description = trim(p ->> 'description'),
      responsibles = nullif(trim(p ->> 'responsibles'), ''),
      goal = nullif(trim(p ->> 'goal'), ''),
      places = nullif(trim(p ->> 'places'), ''),
      channel_id = nullif(p ->> 'channel_id', '')::smallint,
      goal_count = nullif(p ->> 'goal_count', '')::smallint,
      updated_by = auth.uid(), updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.copy_agenda(p_branch smallint, p_from date, p_to date) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if not public.manages_branch(p_branch) then raise exception 'forbidden'; end if;
  if p_from = p_to then raise exception 'invalid_input' using detail = 'day'; end if;
  insert into public.agenda_activities (branch_id, activity_date, shift, start_time, end_time, strategy_id, description,
    responsibles, goal, places, channel_id, goal_count, created_by, updated_by)
  select branch_id, p_to, shift, start_time, end_time, strategy_id, description, responsibles, goal, places, channel_id,
    goal_count, auth.uid(), auth.uid()
  from public.agenda_activities where branch_id = p_branch and activity_date = p_from;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
