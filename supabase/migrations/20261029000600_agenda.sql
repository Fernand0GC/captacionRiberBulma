-- Planificación diaria (US4, versión simple, 2026-10-29), con la forma de las planillas de las sucursales:
-- por sucursal, día y turno (mañana/tarde): hora, estrategia, actividad, responsables, meta, lugares; al cierre,
-- cumplida/no cumplida y lo logrado. Arman: encargado (su sucursal), gerente y Sistemas (todas). Ven: todo el personal
-- de la sucursal.

-- Estrategias de las planillas reales (también en producción, no solo en el seed).
insert into public.agenda_strategies (name) values
  ('Mensajería'), ('Marketing'), ('Creación de contenido'), ('En vivo TikTok'), ('Estrategia contacto'), ('Negociación'),
  ('Activación'), ('Llamadas'), ('Atención en tienda'), ('Vista de la tienda'), ('Distribuir tareas'), ('Kardex de ventas'), ('Otra')
on conflict (name) do nothing;

create type public.activity_result as enum ('pending', 'done', 'not_done');

create table public.agenda_activities (
  id uuid primary key default gen_random_uuid(),
  branch_id smallint not null references public.branches (id),
  activity_date date not null,
  shift public.shift not null,
  start_time time not null,
  end_time time,
  strategy_id smallint references public.agenda_strategies (id),
  description text not null check (length(trim(description)) between 2 and 300),
  responsibles text check (responsibles is null or length(responsibles) <= 200),
  goal text check (goal is null or length(goal) <= 200),
  places text check (places is null or length(places) <= 500),
  status public.activity_result not null default 'pending',
  result text check (result is null or length(result) <= 300),
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_end_after_start check (end_time is null or end_time > start_time)
);
create index agenda_branch_day_idx on public.agenda_activities (branch_id, activity_date, shift, start_time);
alter table public.agenda_activities enable row level security;
revoke all on public.agenda_activities from authenticated, anon;

-- Ver el plan de un día: gestores del alcance o cualquier usuario activo de esa sucursal.
create function public.agenda_day(p_branch smallint, p_day date) returns jsonb
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
        'goal', a.goal, 'places', a.places, 'status', a.status, 'result', a.result
      ) order by a.shift, a.start_time, a.created_at)
      from public.agenda_activities a left join public.agenda_strategies s on s.id = a.strategy_id
      where a.branch_id = p_branch and a.activity_date = p_day
    ), '[]'::jsonb)
  );
end;
$$;

-- Crear o editar una actividad (con id = editar).
create function public.save_activity(p jsonb) returns uuid
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
      responsibles, goal, places, created_by, updated_by)
    values (v_branch, (p ->> 'activity_date')::date, (p ->> 'shift')::public.shift, (p ->> 'start_time')::time,
      nullif(p ->> 'end_time', '')::time, nullif(p ->> 'strategy_id', '')::smallint, trim(p ->> 'description'),
      nullif(trim(p ->> 'responsibles'), ''), nullif(trim(p ->> 'goal'), ''), nullif(trim(p ->> 'places'), ''), auth.uid(), auth.uid())
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
      updated_by = auth.uid(), updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end;
$$;

-- Cierre: cumplida / no cumplida / volver a pendiente, con lo logrado.
create function public.set_activity_result(p_id uuid, p_status public.activity_result, p_result text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_branch smallint;
begin
  select branch_id into v_branch from public.agenda_activities where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if not public.manages_branch(v_branch) then raise exception 'forbidden'; end if;
  update public.agenda_activities set status = p_status, result = nullif(trim(p_result), ''), updated_by = auth.uid(), updated_at = now()
  where id = p_id;
end;
$$;

create function public.delete_activity(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_branch smallint;
begin
  select branch_id into v_branch from public.agenda_activities where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if not public.manages_branch(v_branch) then raise exception 'forbidden'; end if;
  delete from public.agenda_activities where id = p_id;
end;
$$;

-- Copiar el plan de un día a otro (como pendiente y sin resultados). Devuelve cuántas actividades copió.
create function public.copy_agenda(p_branch smallint, p_from date, p_to date) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if not public.manages_branch(p_branch) then raise exception 'forbidden'; end if;
  if p_from = p_to then raise exception 'invalid_input' using detail = 'day'; end if;
  insert into public.agenda_activities (branch_id, activity_date, shift, start_time, end_time, strategy_id, description,
    responsibles, goal, places, created_by, updated_by)
  select branch_id, p_to, shift, start_time, end_time, strategy_id, description, responsibles, goal, places, auth.uid(), auth.uid()
  from public.agenda_activities where branch_id = p_branch and activity_date = p_from;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.agenda_day(smallint, date), public.save_activity(jsonb),
  public.set_activity_result(uuid, public.activity_result, text), public.delete_activity(uuid),
  public.copy_agenda(smallint, date, date) from public, anon;
grant execute on function public.agenda_day(smallint, date), public.save_activity(jsonb),
  public.set_activity_result(uuid, public.activity_result, text), public.delete_activity(uuid),
  public.copy_agenda(smallint, date, date) to authenticated;
