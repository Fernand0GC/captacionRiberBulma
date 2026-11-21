-- Referidos por período y sucursales (spec 014, 2026-11-21).
--  · referral_report_range: cualquier rango (≤ 366 días), una sucursal o todas las del alcance, meta prorrateada,
--    lista plana de contactos y «quién registra». Mismas reglas de conteo que referral_report (spec 005 R4/R5).
--  · referral_report queda igual: la app publicada lo sigue usando (FR-018).
-- Contrato: specs/014-referidos-mejoras/contracts/rpc.md

-- Sucursales de Referidos que puede ver quien consulta (nulo = todas las del alcance) -------------------
create function public.referral_branches(p_branch smallint) returns smallint[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v smallint[];
begin
  if not public.app_is_active() then raise exception 'forbidden'; end if;
  if p_branch is not null then
    if not public.can_see_referrals(p_branch) then raise exception 'forbidden'; end if;
    return array[p_branch];
  end if;
  if public.is_global() then
    select array_agg(b.id order by b.id) into v from public.branches b;
  elsif public.app_role() = 'sales_lead' then
    select array_agg(pb.branch_id order by pb.branch_id) into v from public.profile_branches pb where pb.profile_id = auth.uid();
  end if;
  if v is null then raise exception 'forbidden'; end if;
  return v;
end;
$$;

-- Meta de un referidor en un rango: por mes tocado, completa si el rango cubre el mes (hasta su fin o hasta hoy),
-- si no prorrateada por días (FR-003). Nula si ningún mes tiene meta. Devuelve también si hubo prorrateo.
create function public.referral_range_goal(p_referrer smallint, p_from date, p_to date, out goal numeric, out prorated boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/La_Paz')::date;
  m date := date_trunc('month', p_from)::date;
  m_end date;
  g smallint;
  d_in integer;
begin
  prorated := false;
  while m <= p_to loop
    m_end := (m + interval '1 month')::date - 1;
    g := public.referral_month_goal(p_referrer, m);
    if g is not null then
      if p_from <= m and p_to >= least(m_end, greatest(v_today, m)) then
        goal := coalesce(goal, 0) + g;
      else
        d_in := least(p_to, m_end) - greatest(p_from, m) + 1;
        goal := coalesce(goal, 0) + g::numeric * d_in / (m_end - m + 1);
        prorated := true;
      end if;
    end if;
    m := (m + interval '1 month')::date;
  end loop;
  goal := round(goal, 1);
end;
$$;

create function public.referral_report_range(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_branch smallint := nullif(p ->> 'branch_id', '')::smallint;
  v_branches smallint[];
  v_from date;
  v_to date;
  v_lists boolean := coalesce(nullif(p ->> 'lists', '')::boolean, true);
  v_today date := (now() at time zone tz)::date;
  v_t0 timestamptz;
  v_t1 timestamptz;
  v_result jsonb;
begin
  begin
    v_from := (p ->> 'from')::date;
    v_to := (p ->> 'to')::date;
  exception when others then
    raise exception 'invalid_input' using detail = 'from';
  end;
  if v_from is null then raise exception 'invalid_input' using detail = 'from'; end if;
  if v_to is null or v_to < v_from or v_to - v_from > 366 then raise exception 'invalid_input' using detail = 'to'; end if;
  v_branches := public.referral_branches(v_branch);
  v_t0 := v_from::timestamp at time zone tz;
  v_t1 := (v_to + 1)::timestamp at time zone tz;

  with c as (
    select p.id, p.branch_id, p.referrer_id, p.full_name, p.phone_raw, p.stage, p.created_by, p.assigned_to, p.product_id,
           p.client_created_at as arrived_at,
           (select min(e.created_at) from public.stage_events e where e.prospect_id = p.id and e.to_stage = 'sale') as sold_at
    from public.prospects p
    where p.branch_id = any (v_branches) and p.status = 'active' and p.referrer_id is not null
      and p.client_created_at >= v_t0 and p.client_created_at < v_t1
  ),
  caps as (                     -- todas las captaciones del período (para «quién registra» y el % de referidas)
    select p.branch_id, p.created_by, count(*)::int as captures, count(p.referrer_id)::int as referred
    from public.prospects p
    where p.branch_id = any (v_branches) and p.status = 'active'
      and p.client_created_at >= v_t0 and p.client_created_at < v_t1
    group by p.branch_id, p.created_by
  ),
  refs as (
    select r.id, r.branch_id, r.name, r.kind, r.active, r.sort, r.source, r.merged_into, g.goal, g.prorated
    from public.referrers r
    cross join lateral public.referral_range_goal(r.id, v_from, v_to) g
    where r.branch_id = any (v_branches)
  ),
  rows as (
    select r.id, r.branch_id, r.name, r.kind, r.active, r.sort, r.source, r.goal, r.prorated,
           count(c.id)::int as arrived,
           count(c.id) filter (where c.sold_at is null and c.stage = 'capture')::int as uncontacted,
           count(c.id) filter (where c.sold_at is null and c.stage in ('recapture', 'followup', 'interested'))::int as in_followup,
           count(c.id) filter (where c.sold_at is not null)::int as sold,
           count(c.id) filter (where c.sold_at is null and c.stage = 'lost')::int as lost
    from refs r
    left join c on c.referrer_id = r.id
    group by r.id, r.branch_id, r.name, r.kind, r.active, r.sort, r.source, r.goal, r.prorated, r.merged_into
    having (r.active and r.merged_into is null) or count(c.id) > 0
  ),
  br as (
    select b.id, b.name,
           (select count(*) from public.referrers r where r.branch_id = b.id and r.active and r.merged_into is null)::int as referrers,
           coalesce(sum(w.arrived), 0)::int as arrived, coalesce(sum(w.uncontacted), 0)::int as uncontacted,
           coalesce(sum(w.in_followup), 0)::int as in_followup, coalesce(sum(w.sold), 0)::int as sold,
           coalesce(sum(w.lost), 0)::int as lost,
           sum(w.goal) as goal,
           coalesce((select sum(k.captures) from caps k where k.branch_id = b.id), 0)::int as captures
    from public.branches b
    left join rows w on w.branch_id = b.id
    where b.id = any (v_branches)
    group by b.id, b.name
  )
  select jsonb_build_object(
    'branch_id', v_branch,
    'branch', (select b.name from public.branches b where b.id = v_branch),
    'from', v_from, 'to', v_to, 'days', v_to - v_from + 1,
    'goal_prorated', coalesce((select bool_or(w.prorated) from rows w where w.goal is not null), false),
    'totals', (select jsonb_build_object(
        'arrived', coalesce(sum(x.arrived), 0), 'uncontacted', coalesce(sum(x.uncontacted), 0),
        'in_followup', coalesce(sum(x.in_followup), 0), 'sold', coalesce(sum(x.sold), 0), 'lost', coalesce(sum(x.lost), 0),
        'goal', sum(x.goal), 'captures', coalesce(sum(x.captures), 0)) from br x),
    'by_branch', coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'name', x.name, 'referrers', x.referrers, 'arrived', x.arrived, 'uncontacted', x.uncontacted,
        'in_followup', x.in_followup, 'sold', x.sold, 'lost', x.lost, 'goal', x.goal, 'captures', x.captures) order by x.id)
      from br x), '[]'::jsonb),
    'referrers', case when v_lists and v_branch is not null then coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', w.id, 'name', w.name, 'kind', w.kind, 'active', w.active, 'sort', w.sort, 'source', w.source,
          'goal', w.goal, 'arrived', w.arrived, 'uncontacted', w.uncontacted, 'in_followup', w.in_followup,
          'sold', w.sold, 'lost', w.lost,
          'by_day', coalesce((
            select jsonb_object_agg(d.day::text, jsonb_build_object('arrived', d.a, 'sold', d.s))
            from (
              select x.day, sum(x.a)::int as a, sum(x.s)::int as s from (
                select (c.arrived_at at time zone tz)::date as day, 1 as a, 0 as s from c where c.referrer_id = w.id
                union all
                select (c.sold_at at time zone tz)::date, 0, 1 from c
                where c.referrer_id = w.id and c.sold_at >= v_t0 and c.sold_at < v_t1
              ) x group by x.day
            ) d), '{}'::jsonb)
        ) order by w.sort, lower(w.name))
        from rows w), '[]'::jsonb) else '[]'::jsonb end,
    'contacts', case when v_lists then coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id, 'branch_id', c.branch_id, 'branch_name', b.name, 'referrer_id', c.referrer_id, 'referrer_name', r.name,
          'full_name', c.full_name, 'phone', c.phone_raw, 'product', pr.name, 'assigned_to', s.full_name,
          'registered_by', a.full_name, 'stage', c.stage, 'arrived_at', c.arrived_at, 'sold_at', c.sold_at,
          'last_contact_at', (select max(f.contacted_at) from public.followups f where f.prospect_id = c.id),
          'days_waiting', case when c.sold_at is null and c.stage = 'capture'
                               then v_today - (c.arrived_at at time zone tz)::date end
        ) order by c.arrived_at, c.id)
        from c
        join public.branches b on b.id = c.branch_id
        join public.referrers r on r.id = c.referrer_id
        left join public.products pr on pr.id = c.product_id
        left join public.profiles s on s.id = c.assigned_to
        left join public.profiles a on a.id = c.created_by), '[]'::jsonb) else '[]'::jsonb end,
    'registrars', case when v_lists then coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', k.created_by, 'name', a.full_name, 'role', a.role, 'branch_name', b.name,
          'captures', k.captures, 'referred', k.referred) order by k.referred desc, k.captures desc, a.full_name)
        from caps k
        join public.profiles a on a.id = k.created_by
        join public.branches b on b.id = k.branch_id), '[]'::jsonb) else '[]'::jsonb end
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.referral_branches(smallint), public.referral_range_goal(smallint, date, date),
  public.referral_report_range(jsonb) from public, anon;
revoke execute on function public.referral_range_goal(smallint, date, date) from authenticated;
grant execute on function public.referral_report_range(jsonb) to authenticated;
