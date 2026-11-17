-- Organización comercial (spec 003, mejora del 2026-11-17 tras la prueba con ventas):
--  · La ubicación solo se pide en las estrategias que la usan (Calle). En Tienda la persona está en la sucursal.
--  · La meta solo se pide en los canales que la llevan. Mensajería, Comentarios y Tareas administrativas no.
--  · Nuevo canal «Tareas administrativas» en Tienda: el tiempo que el personal de tienda dedica a lo administrativo
--    se planifica como un canal más, sin meta, para ver el día completo de cada persona.
-- Ambas marcas se editan desde la pantalla Catálogo (Sistemas). La base hace cumplir las marcas al guardar.

alter table public.org_strategies add column uses_place boolean not null default true;
alter table public.org_channels add column uses_goal boolean not null default true;

update public.org_strategies set uses_place = false where name = 'Tienda';

insert into public.org_channels (strategy_id, name, sort, uses_goal)
select s.id, 'Tareas administrativas', 8, false from public.org_strategies s where s.name = 'Tienda'
on conflict (strategy_id, name) do nothing;

update public.org_channels c set uses_goal = false
from public.org_strategies s
where s.id = c.strategy_id and s.name = 'Tienda'
  and c.name in ('RRSS-Mensajería', 'Comentarios', 'Tareas administrativas');

-- org_save: si la estrategia no usa ubicación o el canal no lleva meta, se guardan vacías aunque lleguen.
create or replace function public.org_save(p jsonb) returns uuid
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

  if not (select s.uses_place from public.org_strategies s where s.id = v_strategy) then v_place := null; end if;
  if not (select c.uses_goal from public.org_channels c where c.id = v_channel) then v_goal := null; end if;

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

-- org_copy_day: al copiar también se respetan las marcas vigentes del catálogo.
create or replace function public.org_copy_day(p_branch smallint, p_from date, p_to date) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if not public.manages_org(p_branch) then raise exception 'forbidden'; end if;
  if p_from is null or p_to is null or p_from = p_to then raise exception 'invalid_input' using detail = 'day'; end if;
  insert into public.org_assignments (branch_id, work_date, shift, start_time, end_time, profile_id, strategy_id,
    channel_id, subchannel_id, place, goal, lead_id, created_by, updated_by)
  select a.branch_id, p_to, a.shift, a.start_time, a.end_time, a.profile_id, a.strategy_id, a.channel_id,
    a.subchannel_id,
    case when s.uses_place then a.place end,
    case when c.uses_goal then a.goal end,
    public.branch_lead(p_branch), auth.uid(), auth.uid()
  from public.org_assignments a
  join public.profiles p on p.id = a.profile_id and p.active and p.branch_id = p_branch
  join public.org_strategies s on s.id = a.strategy_id
  join public.org_channels c on c.id = a.channel_id
  where a.branch_id = p_branch and a.work_date = p_from;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
