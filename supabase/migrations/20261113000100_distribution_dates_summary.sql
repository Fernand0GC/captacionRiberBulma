-- Resumen de prospectos por día para el calendario de reparticiones (FR-039d).
-- Devuelve, para un mes dado, cuántos prospectos pendientes y totales hay por día en La Paz.
create or replace function public.distribution_dates_summary(
  p_branch smallint,
  p_year  int,
  p_month int
)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_from date := make_date(p_year, p_month, 1);
  v_to   date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
  v_from_ts timestamptz := (v_from::timestamp at time zone tz);
  v_to_ts   timestamptz := ((v_to + 1)::timestamp at time zone tz);
begin
  if not public.manages_branch(p_branch) then raise exception 'forbidden'; end if;

  return coalesce(
    (
      select jsonb_object_agg(
        day_str,
        jsonb_build_object('pending', pending_cnt, 'total', total_cnt)
      )
      from (
        select
          to_char((p.client_created_at at time zone tz)::date, 'YYYY-MM-DD') as day_str,
          count(*) filter (where p.assigned_to is null and p.stage not in ('sale', 'lost')) as pending_cnt,
          count(*) as total_cnt
        from public.prospects p
        where
          p.branch_id = p_branch
          and p.status = 'active'
          and p.client_created_at >= v_from_ts
          and p.client_created_at < v_to_ts
        group by 1
      ) x
    ),
    '{}'::jsonb
  );
end;
$$;

revoke execute on function public.distribution_dates_summary(smallint, int, int) from public, anon;
grant  execute on function public.distribution_dates_summary(smallint, int, int) to authenticated;
