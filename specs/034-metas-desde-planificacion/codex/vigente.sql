-- Cuerpo VIGENTE (base local, 2026-11-27) de goals_for_day. Solo referencia: no es una migración.
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
$function$
;
