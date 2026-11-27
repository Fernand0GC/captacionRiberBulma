-- Deshacer: recrear public.goals_for_day con specs/037-metas-desglose-canal/codex/vigente.sql.
CREATE OR REPLACE FUNCTION public.goals_for_day(p_branch smallint DEFAULT NULL::smallint, p_day date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_day date := coalesce(p_day, (now() at time zone 'America/La_Paz')::date);
  v_branch smallint := p_branch;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  v_branch := public.scoped_branch(p_branch);
  return (
    with eff as (
      select b.id as branch_id,
             coalesce(o.branch_id is not null, false) as adjusted,
             coalesce(p.plan_captures, case when o.branch_id is not null then o.captures else g.captures end) as captures,
             p.plan_captures,
             p.plan_captures is not null as from_plan,
             case when p.plan_captures is not null then p.plan_result
                  else (public.day_actuals(b.id, v_day) ->> 'captures')::int end as captures_done,
             p.plan_shares,
             p.plan_share_done,
             case when o.branch_id is not null then o.contacts else g.contacts end as contacts,
             case when o.branch_id is not null then o.potential else g.potential end as potential,
             case when o.branch_id is not null then o.sales else g.sales end as sales,
             o.note
      from public.branches b
      left join public.daily_goal_base g on g.branch_id = b.id
      left join public.daily_goal_overrides o on o.branch_id = b.id and o.day = v_day
      left join lateral (
        select sum(a.goal) filter (where a.goal is not null) as plan_captures,
               coalesce(sum(a.result) filter (where a.goal is not null), 0) as plan_result,
               sum(a.share_goal) filter (where a.share_goal is not null) as plan_shares,
               coalesce(sum(a.share_result), 0) as plan_share_done
        from public.org_assignments a
        where a.branch_id = b.id and a.work_date = v_day
      ) p on true
      where b.active and (v_branch is null or b.id = v_branch)
    )
    select jsonb_build_object(
      'day', v_day,
      'adjusted', coalesce(bool_or(adjusted), false),
      'note', (select string_agg(note, ' · ') from eff where note is not null),
      'captures_from_plan', coalesce(bool_or(from_plan), false),
      'goals', jsonb_build_object('captures', sum(captures), 'contacts', sum(contacts), 'potential', sum(potential), 'sales', sum(sales), 'shares', sum(plan_shares)),
      'actuals', public.day_actuals(v_branch, v_day) || jsonb_build_object('shares', coalesce(sum(plan_share_done), 0))
                 || jsonb_build_object('captures', coalesce(sum(captures_done), 0)),
      'by_channel', (
        select coalesce(jsonb_agg(to_jsonb(ch) order by ch.goal desc, ch.channel), '[]'::jsonb)
        from (
          select c.name as channel,
                 coalesce(sum(a.goal), 0) as goal,
                 coalesce(sum(a.result), 0) as result,
                 coalesce(sum(a.share_goal), 0) as share_goal,
                 coalesce(sum(a.share_result), 0) as share_result
          from public.org_assignments a
          join public.org_channels c on c.id = a.channel_id
          where a.work_date = v_day and a.branch_id in (select branch_id from eff)
          group by c.name
          having bool_or(a.goal is not null or a.share_goal is not null)
        ) ch
      )
    ) from eff
  );
end;
$function$
;
