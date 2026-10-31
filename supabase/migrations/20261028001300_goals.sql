-- Metas (US5, redefinida el 2026-10-28):
--  · DIARIAS por sucursal y etapa del embudo (captación, contactos de recaptación, clientes potenciales, ventas), cada una
--    opcional: una BASE fija por sucursal + AJUSTES para días puntuales.
--  · MENSUALES de ventas por línea (CELULARES/ELECTROS) para gerencia, como el Excel Unificado.
-- Ponen metas: el encargado (su sucursal), gerente y Sistemas (todas).

create table public.daily_goal_base (
  branch_id smallint primary key references public.branches (id),
  captures integer check (captures >= 0),
  contacts integer check (contacts >= 0),
  potential integer check (potential >= 0),
  sales integer check (sales >= 0),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.daily_goal_overrides (
  branch_id smallint not null references public.branches (id),
  day date not null,
  captures integer check (captures >= 0),
  contacts integer check (contacts >= 0),
  potential integer check (potential >= 0),
  sales integer check (sales >= 0),
  note text check (note is null or length(note) <= 200),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  primary key (branch_id, day)
);

create table public.monthly_goals (
  branch_id smallint not null references public.branches (id),
  line public.product_line not null,
  month date not null check (extract(day from month) = 1),
  units integer not null check (units >= 0),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  primary key (branch_id, line, month)
);

alter table public.daily_goal_base enable row level security;
alter table public.daily_goal_overrides enable row level security;
alter table public.monthly_goals enable row level security;
revoke all on public.daily_goal_base, public.daily_goal_overrides, public.monthly_goals from authenticated, anon;

-- Lo logrado en un día por sucursal (hora de La Paz). Misma base que el panel.
create function public.day_actuals(p_branch smallint, p_day date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with w as (
    select (p_day::timestamp at time zone 'America/La_Paz') as s, ((p_day + 1)::timestamp at time zone 'America/La_Paz') as e
  )
  select jsonb_build_object(
    'captures', (select count(*) from public.prospects p, w where p.status = 'active' and (p_branch is null or p.branch_id = p_branch)
                   and p.client_created_at >= w.s and p.client_created_at < w.e),
    'contacts', (select count(*) from public.followups f join public.prospects p on p.id = f.prospect_id, w
                   where p.status = 'active' and (p_branch is null or p.branch_id = p_branch) and f.contacted_at >= w.s and f.contacted_at < w.e),
    'potential', (select count(distinct e.prospect_id) from public.stage_events e join public.prospects p on p.id = e.prospect_id, w
                   where p.status = 'active' and (p_branch is null or p.branch_id = p_branch) and e.to_stage = 'interested'
                     and e.created_at >= w.s and e.created_at < w.e),
    'sales', (select count(distinct e.prospect_id) from public.stage_events e join public.prospects p on p.id = e.prospect_id, w
                   where p.status = 'active' and (p_branch is null or p.branch_id = p_branch) and e.to_stage = 'sale'
                     and e.created_at >= w.s and e.created_at < w.e)
  )
$$;
revoke execute on function public.day_actuals(smallint, date) from public, anon, authenticated;

-- Metas del día (ajuste si existe, si no la base) + lo logrado. p_branch null = suma de las sucursales del alcance.
create function public.goals_for_day(p_branch smallint default null, p_day date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_day date := coalesce(p_day, (now() at time zone 'America/La_Paz')::date);
  v_branch smallint := p_branch;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  if public.app_role() = 'branch_manager' then
    if p_branch is not null and p_branch <> public.app_branch() then raise exception 'forbidden'; end if;
    v_branch := public.app_branch();
  end if;
  return (
    with eff as (
      select b.id as branch_id,
             coalesce(o.branch_id is not null, false) as adjusted,
             case when o.branch_id is not null then o.captures else g.captures end as captures,
             case when o.branch_id is not null then o.contacts else g.contacts end as contacts,
             case when o.branch_id is not null then o.potential else g.potential end as potential,
             case when o.branch_id is not null then o.sales else g.sales end as sales,
             o.note
      from public.branches b
      left join public.daily_goal_base g on g.branch_id = b.id
      left join public.daily_goal_overrides o on o.branch_id = b.id and o.day = v_day
      where b.active and (v_branch is null or b.id = v_branch)
    )
    select jsonb_build_object(
      'day', v_day,
      'adjusted', coalesce(bool_or(adjusted), false),
      'note', (select string_agg(note, ' · ') from eff where note is not null),
      'goals', jsonb_build_object('captures', sum(captures), 'contacts', sum(contacts), 'potential', sum(potential), 'sales', sum(sales)),
      'actuals', public.day_actuals(v_branch, v_day)
    ) from eff
  );
end;
$$;

-- Base y ajustes de una sucursal (para la pantalla de metas).
create function public.daily_goals_config(p_branch smallint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.manages_branch(p_branch) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'base', (select to_jsonb(g) - 'branch_id' - 'updated_by' from public.daily_goal_base g where g.branch_id = p_branch),
    'overrides', coalesce((select jsonb_agg(to_jsonb(o) - 'branch_id' - 'updated_by' order by o.day)
                           from public.daily_goal_overrides o
                           where o.branch_id = p_branch and o.day >= (now() at time zone 'America/La_Paz')::date - 7), '[]'::jsonb)
  );
end;
$$;

create function public._goal_int(g jsonb, k text) returns integer
language sql immutable set search_path = '' as $$
  select case when nullif(g ->> k, '') is null then null
              when (g ->> k)::integer < 0 then null else (g ->> k)::integer end
$$;
revoke execute on function public._goal_int(jsonb, text) from public, anon, authenticated;

create function public.set_daily_base(p_branch smallint, g jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.manages_branch(p_branch) then raise exception 'forbidden'; end if;
  insert into public.daily_goal_base as t (branch_id, captures, contacts, potential, sales, updated_by)
  values (p_branch, public._goal_int(g, 'captures'), public._goal_int(g, 'contacts'), public._goal_int(g, 'potential'),
          public._goal_int(g, 'sales'), auth.uid())
  on conflict (branch_id) do update set captures = excluded.captures, contacts = excluded.contacts,
    potential = excluded.potential, sales = excluded.sales, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

-- Ajuste de un día (g null = quitar el ajuste y volver a la base).
create function public.set_daily_override(p_branch smallint, p_day date, g jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.manages_branch(p_branch) then raise exception 'forbidden'; end if;
  if p_day < (now() at time zone 'America/La_Paz')::date - 7 then raise exception 'invalid_input' using detail = 'day'; end if;
  if g is null then
    delete from public.daily_goal_overrides where branch_id = p_branch and day = p_day;
    return;
  end if;
  insert into public.daily_goal_overrides as t (branch_id, day, captures, contacts, potential, sales, note, updated_by)
  values (p_branch, p_day, public._goal_int(g, 'captures'), public._goal_int(g, 'contacts'), public._goal_int(g, 'potential'),
          public._goal_int(g, 'sales'), nullif(trim(g ->> 'note'), ''), auth.uid())
  on conflict (branch_id, day) do update set captures = excluded.captures, contacts = excluded.contacts,
    potential = excluded.potential, sales = excluded.sales, note = excluded.note, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

-- Metas mensuales de ventas por línea + avance (ventas = eventos a 'sale' del mes, por línea del producto).
create function public.monthly_goals_progress(p_month date, p_branch smallint default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_month date := date_trunc('month', p_month)::date;
  v_today date := (now() at time zone tz)::date;
  v_days_left integer;
  v_branch smallint := p_branch;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  if public.app_role() = 'branch_manager' then
    if p_branch is not null and p_branch <> public.app_branch() then raise exception 'forbidden'; end if;
    v_branch := public.app_branch();
  end if;
  v_days_left := case
    when v_today < v_month then (v_month + interval '1 month')::date - v_month
    when v_today >= (v_month + interval '1 month')::date then 0
    else (v_month + interval '1 month')::date - v_today end;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'branch_id', b.id, 'branch_name', b.name, 'line', l.line, 'goal', mg.units,
      'sales', s.n, 'remaining', greatest(coalesce(mg.units, 0) - s.n, 0), 'days_left', v_days_left,
      'daily_target', case when v_days_left > 0 and mg.units is not null then ceil(greatest(mg.units - s.n, 0)::numeric / v_days_left) end
    ) order by b.id, l.line)
    from public.branches b
    cross join (select unnest(enum_range(null::public.product_line)) as line) l
    left join public.monthly_goals mg on mg.branch_id = b.id and mg.line = l.line and mg.month = v_month
    cross join lateral (
      select count(distinct e.prospect_id) as n
      from public.stage_events e
      join public.prospects p on p.id = e.prospect_id
      join public.products pr on pr.id = p.product_id
      where e.to_stage = 'sale' and p.status = 'active' and p.branch_id = b.id and pr.line = l.line
        and e.created_at >= (v_month::timestamp at time zone tz)
        and e.created_at < ((v_month + interval '1 month')::timestamp at time zone tz)
    ) s
    where b.active and (v_branch is null or b.id = v_branch)
  ), '[]'::jsonb);
end;
$$;

create function public.set_monthly_goal(p_branch smallint, p_line public.product_line, p_month date, p_units integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.manages_branch(p_branch) then raise exception 'forbidden'; end if;
  if p_units is null then
    delete from public.monthly_goals where branch_id = p_branch and line = p_line and month = date_trunc('month', p_month)::date;
    return;
  end if;
  if p_units < 0 then raise exception 'invalid_input' using detail = 'units'; end if;
  insert into public.monthly_goals as t (branch_id, line, month, units, updated_by)
  values (p_branch, p_line, date_trunc('month', p_month)::date, p_units, auth.uid())
  on conflict (branch_id, line, month) do update set units = excluded.units, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

revoke execute on function public.goals_for_day(smallint, date), public.daily_goals_config(smallint),
  public.set_daily_base(smallint, jsonb), public.set_daily_override(smallint, date, jsonb),
  public.monthly_goals_progress(date, smallint), public.set_monthly_goal(smallint, public.product_line, date, integer) from public, anon;
grant execute on function public.goals_for_day(smallint, date), public.daily_goals_config(smallint),
  public.set_daily_base(smallint, jsonb), public.set_daily_override(smallint, date, jsonb),
  public.monthly_goals_progress(date, smallint), public.set_monthly_goal(smallint, public.product_line, date, integer) to authenticated;
