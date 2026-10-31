-- Seguimiento por llamadas (US3, FR-033…FR-039). Insumo: planilla en papel de la auxiliar.
-- Todo por RPC: la auxiliar ve solo lo que tiene asignado; el encargado, su sucursal; gerente/Sistemas, todo.

alter table public.prospects
  add column contact_attempts smallint not null default 0,
  add column visit_at timestamptz;

create index prospects_visit_idx on public.prospects (branch_id, visit_at) where visit_at is not null;

-- Motivos de cierre que usa la bandeja de llamadas (también en producción, no solo en el seed).
insert into public.lost_reasons (name) values
  ('No contesta (3 intentos)'), ('No le interesa'), ('Número equivocado')
on conflict (name) do nothing;

create table public.followups (
  id uuid primary key,                                  -- generado en el cliente (idempotencia)
  prospect_id uuid not null references public.prospects (id),
  contacted_at timestamptz not null default now(),
  result public.contact_result not null,
  method public.contact_method not null default 'call',
  effective boolean not null,
  note text check (note is null or length(note) <= 500),
  visit_at timestamptz,
  callback_at timestamptz,
  actor_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint followups_visit check (result <> 'visit_store' or visit_at is not null),
  constraint followups_callback check (result <> 'call_later' or callback_at is not null)
);
create index followups_prospect_idx on public.followups (prospect_id, contacted_at desc);
create index followups_actor_idx on public.followups (actor_id, contacted_at);
alter table public.followups enable row level security;
revoke insert, update, delete on public.followups from authenticated, anon;
create trigger followups_immutable before update or delete on public.followups
  for each row execute function public.reject_mutation();

create table public.assignment_events (
  id bigint generated always as identity primary key,
  prospect_id uuid not null references public.prospects (id),
  from_user uuid references public.profiles (id),
  to_user uuid references public.profiles (id),
  actor_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index assignment_events_prospect_idx on public.assignment_events (prospect_id, created_at);
alter table public.assignment_events enable row level security;
revoke insert, update, delete on public.assignment_events from authenticated, anon;
create trigger assignment_events_immutable before update or delete on public.assignment_events
  for each row execute function public.reject_mutation();

-- ¿El usuario actual puede trabajar este prospecto? (responsable asignado o gestor del alcance)
create function public.can_work_prospect(p_branch smallint, p_assigned uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.app_is_active() and (
    public.manages_branch(p_branch) or (p_assigned = auth.uid() and public.can_follow_up())
  )
$$;

-- Asignar (o quitar con to_user = null) el responsable de seguimiento (FR-035).
create function public.assign_prospects(p_ids uuid[], p_to uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_to public.profiles;
  v_n integer := 0;
  r record;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  if p_to is not null then
    select * into v_to from public.profiles where id = p_to;
    if not found or not v_to.active or v_to.role not in ('field_assistant', 'field_supervisor', 'branch_manager') then
      raise exception 'invalid_input' using detail = 'to_user';
    end if;
  end if;
  for r in select id, branch_id, assigned_to from public.prospects where id = any (p_ids) for update loop
    if not public.manages_branch(r.branch_id) then raise exception 'forbidden'; end if;
    if p_to is not null and v_to.branch_id <> r.branch_id then raise exception 'invalid_input' using detail = 'to_user'; end if;
    if r.assigned_to is distinct from p_to then
      update public.prospects set assigned_to = p_to, updated_at = now(), updated_by = auth.uid() where id = r.id;
      insert into public.assignment_events (prospect_id, from_user, to_user, actor_id) values (r.id, r.assigned_to, p_to, auth.uid());
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

-- Bandeja del responsable: 'today' (para contactar hoy o vencidos), 'followup' (seguimiento), 'clients' (cliente),
-- 'visits' (visitas pactadas desde hoy).
create function public.list_my_followups(p_view text default 'today') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_end_today timestamptz := (((now() at time zone tz)::date + 1)::timestamp at time zone tz);
  v_start_today timestamptz := (((now() at time zone tz)::date)::timestamp at time zone tz);
begin
  if not public.app_is_active() or not public.can_follow_up() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'counts', (
      select jsonb_build_object(
        'today', count(*) filter (where p.next_contact_at is null or p.next_contact_at < v_end_today),
        'followup', count(*) filter (where p.stage = 'followup'),
        'clients', count(*) filter (where p.stage = 'interested'),
        'visits', count(*) filter (where p.visit_at >= v_start_today))
      from public.prospects p
      where p.assigned_to = auth.uid() and p.status = 'active' and p.stage not in ('sale', 'lost')
    ),
    'rows', coalesce((
      select jsonb_agg(row_to_json(x) order by x.sort_key nulls first, x.client_created_at)
      from (
        select p.id, p.full_name, p.phone_raw, p.phone_norm, p.stage, p.contact_attempts, p.next_contact_at, p.visit_at,
               p.client_created_at, p.product_id, pr.name as product_name, c.name as channel_name, a.full_name as created_by_name,
               lf.result as last_result, lf.method as last_method, lf.note as last_note, lf.contacted_at as last_contacted_at,
               case when p_view = 'visits' then p.visit_at else p.next_contact_at end as sort_key
        from public.prospects p
        join public.profiles a on a.id = p.created_by
        left join public.products pr on pr.id = p.product_id
        left join public.channels c on c.id = p.channel_id
        left join lateral (
          select f.result, f.method, f.note, f.contacted_at from public.followups f
          where f.prospect_id = p.id order by f.contacted_at desc limit 1
        ) lf on true
        where p.assigned_to = auth.uid() and p.status = 'active' and p.stage not in ('sale', 'lost')
          and case p_view
                when 'followup' then p.stage = 'followup'
                when 'clients' then p.stage = 'interested'
                when 'visits' then p.visit_at >= v_start_today
                else p.next_contact_at is null or p.next_contact_at < v_end_today
              end
        limit 300
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

-- Registrar un contacto (llamada, mensaje, en tienda) y aplicar las reglas de etapa (FR-037…FR-039). Idempotente por id.
create function public.add_followup(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_id uuid;
  v_result public.contact_result;
  v_method public.contact_method;
  v_note text := nullif(trim(coalesce(p ->> 'note', '')), '');
  v_visit timestamptz;
  v_callback timestamptz;
  v_product integer;
  v_pr public.prospects;
  v_target public.prospect_stage;
  v_stage public.prospect_stage;
  v_attempts smallint;
  v_next timestamptz;
  v_reason text;
  v_tomorrow9 timestamptz := (((now() at time zone tz)::date + 1)::timestamp + time '09:00') at time zone tz;
begin
  begin
    v_id := (p ->> 'id')::uuid;
    v_result := (p ->> 'result')::public.contact_result;
    v_method := coalesce(nullif(p ->> 'method', '')::public.contact_method, 'call');
    v_visit := nullif(p ->> 'visit_at', '')::timestamptz;
    v_callback := nullif(p ->> 'callback_at', '')::timestamptz;
    v_product := nullif(p ->> 'product_id', '')::integer;
  exception when others then
    raise exception 'invalid_input' using detail = 'result';
  end;
  if v_id is null or v_result is null then raise exception 'invalid_input' using detail = 'result'; end if;

  if exists (select 1 from public.followups where id = v_id) then
    select * into v_pr from public.prospects where id = (select prospect_id from public.followups where id = v_id);
    return jsonb_build_object('stage', v_pr.stage, 'contact_attempts', v_pr.contact_attempts,
                              'next_contact_at', v_pr.next_contact_at, 'visit_at', v_pr.visit_at);
  end if;

  select * into v_pr from public.prospects where id = (p ->> 'prospect_id')::uuid for update;
  if not found or v_pr.status <> 'active' then raise exception 'not_found'; end if;
  if not public.can_work_prospect(v_pr.branch_id, v_pr.assigned_to) then raise exception 'forbidden'; end if;
  if v_pr.stage in ('sale', 'lost') then raise exception 'invalid_transition'; end if;

  v_attempts := 0;  -- todo contacto efectivo reinicia los intentos
  case v_result
    when 'no_answer' then
      v_attempts := v_pr.contact_attempts + 1;
      if v_attempts >= 3 then v_target := 'lost'; v_reason := 'No contesta (3 intentos)';
      else v_target := 'recapture'; v_next := v_tomorrow9;
      end if;
    when 'looking_product' then
      v_target := 'followup'; v_next := (((now() at time zone tz)::date + 2)::timestamp + time '09:00') at time zone tz;
    when 'visit_store' then
      if v_visit is null or v_visit < now() - interval '1 hour' then raise exception 'invalid_input' using detail = 'visit_at'; end if;
      v_target := 'followup'; v_next := v_visit;
    when 'call_later' then
      if v_callback is null or v_callback < now() - interval '1 hour' then raise exception 'invalid_input' using detail = 'callback_at'; end if;
      v_target := 'followup'; v_next := v_callback;
    when 'very_interested' then
      v_target := 'interested'; v_next := v_tomorrow9;
    when 'sold' then
      v_product := coalesce(v_product, v_pr.product_id);
      if v_product is null or not exists (select 1 from public.products x where x.id = v_product and x.active) then
        raise exception 'invalid_input' using detail = 'product_id';
      end if;
      v_target := 'sale';
    when 'not_interested' then v_target := 'lost'; v_reason := 'No le interesa';
    when 'wrong_number' then v_target := 'lost'; v_reason := 'Número equivocado';
  end case;

  -- Las etapas positivas no retroceden (1 < 2 < 3 < 4); venta y sin interés se aplican siempre.
  v_stage := case
    when v_target in ('sale', 'lost') then v_target
    when array_position(enum_range(null::public.prospect_stage), v_target)
         > array_position(enum_range(null::public.prospect_stage), v_pr.stage) then v_target
    else v_pr.stage
  end;

  insert into public.followups (id, prospect_id, result, method, effective, note, visit_at, callback_at, actor_id)
  values (v_id, v_pr.id, v_result, v_method, v_result <> 'no_answer', v_note,
          case when v_result = 'visit_store' then v_visit end,
          case when v_result = 'call_later' then v_callback end, auth.uid());

  update public.prospects set
    stage = v_stage,
    stage_changed_at = case when v_stage <> v_pr.stage then now() else stage_changed_at end,
    contact_attempts = v_attempts,
    next_contact_at = case when v_stage in ('sale', 'lost') then null else v_next end,
    visit_at = case when v_result = 'visit_store' then v_visit else visit_at end,
    product_id = case when v_result = 'sold' then v_product else product_id end,
    sold_at = case when v_stage = 'sale' then now() else sold_at end,
    lost_reason_id = case when v_stage = 'lost' then (select id from public.lost_reasons where name = v_reason) else lost_reason_id end,
    updated_at = now(), updated_by = auth.uid()
  where id = v_pr.id;

  if v_stage <> v_pr.stage then
    insert into public.stage_events (prospect_id, from_stage, to_stage, lost_reason_id, note, actor_id)
    values (v_pr.id, v_pr.stage, v_stage,
            case when v_stage = 'lost' then (select id from public.lost_reasons where name = v_reason) end, v_note, auth.uid());
  end if;

  return jsonb_build_object('stage', v_stage, 'contact_attempts', v_attempts,
                            'next_contact_at', case when v_stage in ('sale', 'lost') then null else v_next end,
                            'visit_at', case when v_result = 'visit_store' then v_visit else v_pr.visit_at end);
end;
$$;

-- Personas a las que el gestor puede asignar (auxiliar, supervisor, encargado activos de la sucursal).
create function public.assignee_options(p_branch smallint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.manages_branch(p_branch) then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'full_name', full_name, 'role', role) order by full_name)
    from public.profiles
    where branch_id = p_branch and active and role in ('field_assistant', 'field_supervisor', 'branch_manager')
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.can_work_prospect(smallint, uuid), public.assign_prospects(uuid[], uuid),
  public.list_my_followups(text), public.add_followup(jsonb), public.assignee_options(smallint) from public, anon;
grant execute on function public.assign_prospects(uuid[], uuid), public.list_my_followups(text),
  public.add_followup(jsonb), public.assignee_options(smallint) to authenticated;

-- Panel de gestión: responsable, intentos y visita; filtros 'sin asignar', etapa y vista de visitas pactadas.
create or replace function public.list_prospects(f jsonb default '{}', p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_branch smallint;
  v_from date;
  v_to date;
  v_q text := nullif(trim(coalesce(f ->> 'q', '')), '');
  v_qdigits text;
  v_created_by uuid := nullif(f ->> 'created_by', '')::uuid;
  v_channel smallint := nullif(f ->> 'channel_id', '')::smallint;
  v_assigned text := nullif(f ->> 'assigned', '');           -- 'none' o uuid del responsable
  v_stage text := nullif(f ->> 'stage', '');
  v_by_visit boolean := coalesce(f ->> 'view', '') = 'visits'; -- el rango de fechas aplica a la visita pactada
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
  v_rows jsonb;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;

  if public.app_role() = 'branch_manager' then
    v_branch := public.app_branch();
    if nullif(f ->> 'branch_id', '') is not null and (f ->> 'branch_id')::smallint <> v_branch then
      raise exception 'forbidden';
    end if;
  else
    v_branch := nullif(f ->> 'branch_id', '')::smallint;
  end if;

  v_from := coalesce(nullif(f ->> 'from', '')::date, (now() at time zone tz)::date);
  v_to := coalesce(nullif(f ->> 'to', '')::date, v_from);
  if v_to < v_from or v_to - v_from > 366 then raise exception 'invalid_input' using detail = 'to'; end if;

  if v_q is not null then
    v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
    v_qdigits := nullif(public.normalize_phone(v_q), '');
    if v_qdigits is not null and length(v_qdigits) < 3 then v_qdigits := null; end if;
  end if;

  with base as (
    select p.*
    from public.prospects p
    where p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and (case when v_by_visit then p.visit_at else p.client_created_at end) >= (v_from::timestamp at time zone tz)
      and (case when v_by_visit then p.visit_at else p.client_created_at end) < ((v_to + 1)::timestamp at time zone tz)
      and (v_assigned is null or (v_assigned = 'none' and p.assigned_to is null)
           or (v_assigned <> 'none' and p.assigned_to::text = v_assigned))
      and (v_stage is null or p.stage::text = v_stage)
      and (v_created_by is null or p.created_by = v_created_by)
      and (v_channel is null or p.channel_id = v_channel)
      and (v_q is null or p.full_name ilike '%' || v_q || '%'
           or (v_qdigits is not null and p.phone_norm like '%' || v_qdigits || '%'))
  ),
  page as (
    select p.id, p.full_name, p.phone_raw, p.interest, p.occupation, p.address, p.client_created_at, p.shift, p.stage,
           p.late_after_deactivation, p.branch_id, b.name as branch_name,
           p.created_by, a.full_name as created_by_name, a.role as created_by_role,
           c.name as channel_name, pr.name as product_name, pr.product_group,
           p.assigned_to, s.full_name as assigned_to_name, p.contact_attempts, p.visit_at
    from base p
    join public.branches b on b.id = p.branch_id
    join public.profiles a on a.id = p.created_by
    left join public.channels c on c.id = p.channel_id
    left join public.products pr on pr.id = p.product_id
    left join public.profiles s on s.id = p.assigned_to
    order by case when v_by_visit then p.visit_at end, p.client_created_at desc, p.id
    limit v_limit offset v_offset
  )
  select (select count(*) from base),
         coalesce((select jsonb_agg(row_to_json(pg) order by case when v_by_visit then pg.visit_at end, pg.client_created_at desc, pg.id) from page pg), '[]'::jsonb)
  into v_total, v_rows;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

