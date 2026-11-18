-- Seguimiento de referidos por origen (spec 005, 2026-11-18).
--  · Cada sucursal tiene su lista de referidores (quién pasó el contacto) con meta mensual de contactos que llegan.
--  · La captación guarda de quién vino (prospects.referrer_id, opcional). Es un dato aparte del canal (research R1).
--  · Reporte mensual calculado de las captaciones y sus eventos de etapa (principio III); solo jefe de ventas
--    (sus sucursales), gerencia y Sistemas, verificado aquí (principio IV). El encargado NO (research R7).
-- Todo aditivo: la app publicada no manda referrer_id y sigue funcionando (research R10).
-- Diseño: specs/005-referidos/{research,data-model}.md y contracts/rpc.md.

-- Tablas -------------------------------------------------------------------------------------------------
create table public.referrers (
  id smallint generated always as identity primary key,
  branch_id smallint not null references public.branches (id),
  name text not null check (length(name) between 2 and 60 and name = trim(name)),
  kind text not null check (kind in ('staff', 'freelance', 'client', 'channel', 'other')),
  sort smallint not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create unique index referrers_branch_name_key on public.referrers (branch_id, lower(name));

comment on table public.referrers is 'Origen de contactos referidos de una sucursal (spec 005). Nunca se borra: se desactiva.';

create table public.referrer_goals (
  referrer_id smallint not null references public.referrers (id),
  month date not null check (extract(day from month) = 1),
  goal smallint not null check (goal between 0 and 9999),
  primary key (referrer_id, month)
);

comment on table public.referrer_goals is 'Meta mensual de contactos referidos que llegan. Un mes sin fila usa la del mes anterior más cercano.';

alter table public.referrers enable row level security;
alter table public.referrer_goals enable row level security;
revoke all on public.referrers, public.referrer_goals from anon;
revoke all on public.referrer_goals from authenticated;
revoke insert, update, delete, truncate on public.referrers from authenticated;
grant select on public.referrers to authenticated;
-- Los nombres de referidores no son datos de clientes: los lee todo usuario activo (catálogo sin señal, R2).
create policy referrers_read on public.referrers for select to authenticated using (public.app_is_active());

-- Captación ----------------------------------------------------------------------------------------------
alter table public.prospects add column referrer_id smallint references public.referrers (id);
create index prospects_referrer_idx on public.prospects (referrer_id, client_created_at) where referrer_id is not null;

comment on column public.prospects.referrer_id is 'De quién vino el contacto (spec 005). Se guarda también en duplicados.';

-- Las correcciones del origen quedan en el historial de la ficha (FR-003, research R8).
drop trigger if exists prospects_audit on public.prospects;
create trigger prospects_audit after update of full_name, phone_raw, product_id, channel_id, channel_detail, interest,
  occupation, address, status, referrer_id
  on public.prospects for each row execute function public.audit_row();

-- Permisos -----------------------------------------------------------------------------------------------
-- Reporte y administración: gerencia, Sistemas y el jefe de ventas de la sucursal. No el encargado (R7).
create function public.can_see_referrals(p_branch smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_is_active() and (
    public.is_global() or (public.app_role() = 'sales_lead' and public.manages_branch(p_branch))
  ), false)
$$;

-- Meta vigente de un referidor en un mes: la del mes o la anterior más cercana (FR-007, R6).
create function public.referral_month_goal(p_referrer smallint, p_month date) returns smallint
language sql stable security definer set search_path = '' as $$
  select g.goal from public.referrer_goals g
  where g.referrer_id = p_referrer and g.month <= date_trunc('month', p_month)::date
  order by g.month desc limit 1
$$;

revoke execute on function public.can_see_referrals(smallint), public.referral_month_goal(smallint, date) from public, anon;
grant execute on function public.can_see_referrals(smallint) to authenticated;
revoke execute on function public.referral_month_goal(smallint, date) from authenticated;

-- RPC existentes: se ajustan sobre su definición vigente (sin recopiar cuerpos largos) -------------------
create or replace function pg_temp.patch_function(p_sig text, p_old text, p_new text) returns void language plpgsql as $$
declare
  d text := pg_get_functiondef(p_sig::regprocedure);
begin
  if position(p_old in d) = 0 then
    raise exception 'patch_function: no se encontró el texto en %: %', p_sig, p_old;
  end if;
  execute replace(d, p_old, p_new);
end;
$$;

-- submit_capture: acepta referrer_id. Si no existe o es de otra sucursal se guarda nulo, sin rechazar (R3);
-- un referidor desactivado después de registrar sin señal se acepta igual. Va en los dos inserts (también duplicados).
select pg_temp.patch_function('public.submit_capture(jsonb)',
  'v_product integer := nullif(p ->> ''product_id'', '''')::integer;',
  'v_product integer := nullif(p ->> ''product_id'', '''')::integer;
  v_referrer smallint;');
select pg_temp.patch_function('public.submit_capture(jsonb)',
  '  v_norm := public.normalize_phone(v_phone);',
  '  select r.id into v_referrer from public.referrers r
  where r.branch_id = v_branch
    and r.id = case when p ->> ''referrer_id'' ~ ''^[0-9]{1,5}$'' then (p ->> ''referrer_id'')::integer end;

  v_norm := public.normalize_phone(v_phone);');
select pg_temp.patch_function('public.submit_capture(jsonb)',
  'late_after_deactivation, updated_by',
  'late_after_deactivation, updated_by, referrer_id');
select pg_temp.patch_function('public.submit_capture(jsonb)',
  'v_dup, v_late, v_uid',
  'v_dup, v_late, v_uid, v_referrer');

-- update_prospect: corrige el origen (nulo lo quita). Referidor de la sucursal, activo o el que ya tenía.
select pg_temp.patch_function('public.update_prospect(uuid,jsonb)',
  '  update public.prospects set
    full_name = v_name,',
  '  if patch ? ''referrer_id'' and nullif(patch ->> ''referrer_id'', '''') is not null and not exists (
    select 1 from public.referrers r
    where r.id = case when patch ->> ''referrer_id'' ~ ''^[0-9]{1,5}$'' then (patch ->> ''referrer_id'')::integer end
      and r.branch_id = v.branch_id and (r.active or r.id = v.referrer_id)) then
    raise exception ''invalid_input'' using detail = ''referrer_id'';
  end if;

  update public.prospects set
    full_name = v_name,');
select pg_temp.patch_function('public.update_prospect(uuid,jsonb)',
  '    updated_at = now(), updated_by = auth.uid()',
  '    referrer_id = case when patch ? ''referrer_id'' then nullif(patch ->> ''referrer_id'', '''')::smallint else referrer_id end,
    updated_at = now(), updated_by = auth.uid()');

-- get_prospect: ficha con el origen; el historial muestra «Referido por» con nombres, no ids.
select pg_temp.patch_function('public.get_prospect(uuid)',
  '''channel_detail'', p.channel_detail,',
  '''channel_detail'', p.channel_detail, ''referrer_id'', p.referrer_id, ''referrer'', rf.name,');
select pg_temp.patch_function('public.get_prospect(uuid)',
  'left join public.lost_reasons lr on lr.id = p.lost_reason_id',
  'left join public.lost_reasons lr on lr.id = p.lost_reason_id
      left join public.referrers rf on rf.id = p.referrer_id');
select pg_temp.patch_function('public.get_prospect(uuid)',
  'select jsonb_object_agg(k, l.old -> k) as old, jsonb_object_agg(k, l.new -> k) as new',
  'select jsonb_object_agg(k, case when k = ''referrer_id''
                   then to_jsonb((select r.name from public.referrers r where r.id = (l.old ->> k)::smallint))
                   else l.old -> k end) as old,
                 jsonb_object_agg(k, case when k = ''referrer_id''
                   then to_jsonb((select r.name from public.referrers r where r.id = (l.new ->> k)::smallint))
                   else l.new -> k end) as new');
select pg_temp.patch_function('public.get_prospect(uuid)',
  '''interest'', ''occupation'', ''address'')',
  '''interest'', ''occupation'', ''address'', ''referrer_id'')');

-- referrer_save ------------------------------------------------------------------------------------------
-- Crea o edita un referidor (no cambia de sucursal). Nombre repetido en la sucursal → invalid_input/name_taken.
create function public.referrer_save(p jsonb) returns smallint
language plpgsql security definer set search_path = '' as $$
declare
  v_id smallint := nullif(p ->> 'id', '')::smallint;
  v_branch smallint := nullif(p ->> 'branch_id', '')::smallint;
  v_name text := regexp_replace(trim(coalesce(p ->> 'name', '')), '\s+', ' ', 'g');
  v_kind text := p ->> 'kind';
  v_sort smallint := coalesce(nullif(p ->> 'sort', '')::smallint, 0);
  v_active boolean := coalesce((p ->> 'active')::boolean, true);
  v_old public.referrers;
begin
  if v_id is not null then
    select * into v_old from public.referrers where id = v_id for update;
    if not found then raise exception 'not_found'; end if;
    if v_branch is not null and v_branch <> v_old.branch_id then raise exception 'invalid_input' using detail = 'branch_id'; end if;
    v_branch := v_old.branch_id;
  end if;
  if v_branch is null or not exists (select 1 from public.branches b where b.id = v_branch) then
    raise exception 'invalid_input' using detail = 'branch_id';
  end if;
  if not public.can_see_referrals(v_branch) then raise exception 'forbidden'; end if;
  if length(v_name) not between 2 and 60 then raise exception 'invalid_input' using detail = 'name'; end if;
  if v_kind is null or v_kind not in ('staff', 'freelance', 'client', 'channel', 'other') then
    raise exception 'invalid_input' using detail = 'kind';
  end if;

  begin
    if v_id is null then
      insert into public.referrers (branch_id, name, kind, sort, active, created_by)
      values (v_branch, v_name, v_kind, v_sort, v_active, auth.uid())
      returning id into v_id;
    else
      update public.referrers set name = v_name, kind = v_kind, sort = v_sort, active = v_active where id = v_id;
    end if;
  exception when unique_violation then
    raise exception 'invalid_input' using detail = 'name_taken';
  end;
  return v_id;
end;
$$;

-- referral_goals_save ------------------------------------------------------------------------------------
-- Metas de un mes para referidores de una sucursal. goal nulo borra la fila del mes (vuelve a arrastrar la anterior).
create function public.referral_goals_save(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_branch smallint := nullif(p ->> 'branch_id', '')::smallint;
  v_month date;
  r jsonb;
  v_ref smallint;
  v_goal integer;
begin
  if v_branch is null then raise exception 'invalid_input' using detail = 'branch_id'; end if;
  if not public.can_see_referrals(v_branch) then raise exception 'forbidden'; end if;
  begin
    v_month := date_trunc('month', (p ->> 'month')::date)::date;
  exception when others then
    raise exception 'invalid_input' using detail = 'month';
  end;
  if v_month is null then raise exception 'invalid_input' using detail = 'month'; end if;
  if jsonb_typeof(p -> 'referrers') is distinct from 'array' then raise exception 'invalid_input' using detail = 'referrers'; end if;

  for r in select * from jsonb_array_elements(p -> 'referrers') loop
    v_ref := nullif(r ->> 'id', '')::smallint;
    if not exists (select 1 from public.referrers x where x.id = v_ref and x.branch_id = v_branch) then
      raise exception 'invalid_input' using detail = 'referrer_id';
    end if;
    v_goal := nullif(r ->> 'goal', '')::integer;
    if v_goal is null then
      delete from public.referrer_goals where referrer_id = v_ref and month = v_month;
    elsif v_goal not between 0 and 9999 then
      raise exception 'invalid_input' using detail = 'goal';
    else
      insert into public.referrer_goals (referrer_id, month, goal) values (v_ref, v_month, v_goal)
      on conflict (referrer_id, month) do update set goal = excluded.goal;
    end if;
  end loop;
end;
$$;

-- referral_report ----------------------------------------------------------------------------------------
-- Cohorte del mes (fecha de registro en La Paz), solo fichas activas (R4). Cada contacto cae en un solo grupo:
-- compró (tiene evento de venta) o, si no, su etapa actual: sin contactar / en seguimiento / sin interés (R5).
create function public.referral_report(p_branch smallint, p_month date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_next date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_from timestamptz := v_month::timestamp at time zone 'America/La_Paz';
  v_to timestamptz := v_next::timestamp at time zone 'America/La_Paz';
begin
  if p_branch is null then raise exception 'invalid_input' using detail = 'branch_id'; end if;
  if p_month is null then raise exception 'invalid_input' using detail = 'month'; end if;
  if not public.can_see_referrals(p_branch) then raise exception 'forbidden'; end if;

  return (
    with c as (
      select p.id, p.referrer_id, p.full_name, p.phone_raw, pr.name as product, s.full_name as assigned_to, p.stage,
             p.client_created_at as arrived_at,
             (select min(e.created_at) from public.stage_events e where e.prospect_id = p.id and e.to_stage = 'sale') as sold_at
      from public.prospects p
      left join public.products pr on pr.id = p.product_id
      left join public.profiles s on s.id = p.assigned_to
      where p.branch_id = p_branch and p.status = 'active' and p.referrer_id is not null
        and p.client_created_at >= v_from and p.client_created_at < v_to
    ),
    days as (
      select x.referrer_id, x.day, sum(x.a)::int as arrived, sum(x.s)::int as sold from (
        select c.referrer_id, extract(day from c.arrived_at at time zone 'America/La_Paz')::int as day, 1 as a, 0 as s from c
        union all
        select c.referrer_id, extract(day from c.sold_at at time zone 'America/La_Paz')::int, 0, 1 from c
        where c.sold_at >= v_from and c.sold_at < v_to
      ) x group by x.referrer_id, x.day
    ),
    rows as (
      select r.id, r.name, r.kind, r.active, r.sort,
             public.referral_month_goal(r.id, v_month) as goal,
             (select max(g.month) from public.referrer_goals g where g.referrer_id = r.id and g.month <= v_month) as goal_from,
             count(c.id)::int as arrived,
             count(c.id) filter (where c.sold_at is null and c.stage = 'capture')::int as uncontacted,
             count(c.id) filter (where c.sold_at is null and c.stage in ('recapture', 'followup', 'interested'))::int as in_followup,
             count(c.id) filter (where c.sold_at is not null)::int as sold,
             count(c.id) filter (where c.sold_at is null and c.stage = 'lost')::int as lost
      from public.referrers r
      left join c on c.referrer_id = r.id
      where r.branch_id = p_branch
      group by r.id
      having r.active or count(c.id) > 0
    )
    select jsonb_build_object(
      'branch', (select b.name from public.branches b where b.id = p_branch),
      'month', v_month,
      'days', (v_next - v_month),
      'referrers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', w.id, 'name', w.name, 'kind', w.kind, 'active', w.active, 'sort', w.sort,
          'goal', w.goal, 'goal_from', w.goal_from,
          'arrived', w.arrived, 'uncontacted', w.uncontacted, 'in_followup', w.in_followup, 'sold', w.sold, 'lost', w.lost,
          'by_day', coalesce((
            select jsonb_object_agg(d.day::text, jsonb_build_object('arrived', d.arrived, 'sold', d.sold))
            from days d where d.referrer_id = w.id), '{}'::jsonb)
        ) order by w.sort, lower(w.name))
        from rows w), '[]'::jsonb),
      'contacts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id, 'referrer_id', c.referrer_id, 'full_name', c.full_name, 'phone', c.phone_raw, 'product', c.product,
          'assigned_to', c.assigned_to, 'stage', c.stage, 'arrived_at', c.arrived_at, 'sold_at', c.sold_at
        ) order by c.arrived_at, c.id)
        from c), '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function public.referrer_save(jsonb), public.referral_goals_save(jsonb),
  public.referral_report(smallint, date) from public, anon;
grant execute on function public.referrer_save(jsonb), public.referral_goals_save(jsonb),
  public.referral_report(smallint, date) to authenticated;
