-- Planificación sin cierre a mano (2026-10-30): cuando termina el horario de una actividad, el plan la da por
-- cumplida o no según sus captaciones contra la meta. El encargado solo corrige si hace falta (lo manual manda).
-- El plan también trae la meta de captaciones del día (la de Metas) y lo captado en el día, para no escribirla dos veces.

-- Las metas escritas como texto antes de existir el campo numérico ("50", "30 captaciones") pasan al número.
update public.agenda_activities
set goal_count = substring(goal from '\d{1,4}')::smallint, goal = null
where goal_count is null
  and goal ~* '^\s*\d{1,4}\s*(captaciones?|clientes?)?\s*$'
  and substring(goal from '\d{1,4}')::integer between 1 and 9999;

create or replace function public.agenda_day(p_branch smallint, p_day date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_today date := (now() at time zone tz)::date;
  v_now time := (now() at time zone tz)::time;
begin
  if not (public.manages_branch(p_branch) or (public.app_is_active() and public.app_branch() = p_branch)) then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object(
    'can_edit', public.manages_branch(p_branch),
    -- Meta de captaciones del día según Metas (ajuste del día si existe, si no la base) y lo captado en el día.
    'day_goal', (select case when o.branch_id is not null then o.captures else g.captures end
                 from public.branches b
                 left join public.daily_goal_base g on g.branch_id = b.id
                 left join public.daily_goal_overrides o on o.branch_id = b.id and o.day = p_day
                 where b.id = p_branch),
    'day_captures', (public.day_actuals(p_branch, p_day) ->> 'captures')::integer,
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'shift', x.shift, 'start_time', to_char(x.start_time, 'HH24:MI'), 'end_time', to_char(x.end_time, 'HH24:MI'),
        'strategy_id', x.strategy_id, 'strategy', x.strategy, 'description', x.description, 'responsibles', x.responsibles,
        'goal', x.goal, 'places', x.places, 'status', x.status, 'result', x.result,
        'channel_id', x.channel_id, 'channel', x.channel, 'goal_count', x.goal_count, 'captures', x.captures,
        'ended', x.ended,
        -- Solo con meta y horario terminado; sin meta no hay con qué juzgar.
        'auto_status', case when x.ended and x.goal_count is not null
                            then case when x.captures >= x.goal_count then 'done' else 'not_done' end end
      ) order by x.shift, x.start_time, x.created_at)
      from (
        select a.*, s.name as strategy, c.name as channel, public.activity_captures(a) as captures,
               (a.activity_date < v_today or (a.activity_date = v_today and v_now >= coalesce(
                  a.end_time, case a.shift when 'morning' then time '13:00' else time '23:59' end))) as ended
        from public.agenda_activities a
        left join public.agenda_strategies s on s.id = a.strategy_id
        left join public.channels c on c.id = a.channel_id
        where a.branch_id = p_branch and a.activity_date = p_day
      ) x
    ), '[]'::jsonb)
  );
end;
$$;
