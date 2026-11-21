-- Seguimiento a referidores (spec 017): pedidos de referidos, celular del referidor y datos de la pestaña
-- «Seguimiento». Todo aditivo: la app publicada no llama a las RPC nuevas y referrer_save sigue aceptando lo de antes.
-- Contrato: specs/017-referidores-seguimiento/contracts/rpc.md

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

-- Tablas ---------------------------------------------------------------------------------------------------
create table public.referrer_asks (
  id bigint generated always as identity primary key,
  referrer_id smallint not null references public.referrers (id),
  method text check (method in ('whatsapp_call', 'message', 'in_person')),
  result text not null check (result in ('no_answer', 'waiting', 'promised', 'passed', 'none_now', 'quit')),
  note text check (note is null or length(note) <= 500),
  next_on date,
  auto boolean not null default false,
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint referrer_asks_method_required check (auto or method is not null),
  constraint referrer_asks_quit_no_next check (result <> 'quit' or next_on is null)
);
create index referrer_asks_referrer_idx on public.referrer_asks (referrer_id, created_at desc);
create index referrer_asks_created_idx on public.referrer_asks (created_at);
comment on table public.referrer_asks is
  'Pedidos de referidos a un referidor (spec 017). auto = anotado al cargar referidos (016): no cuenta como pedido.';

create table public.referrer_phones (
  referrer_id smallint primary key references public.referrers (id),
  phone text not null,
  phone_norm text not null
);
comment on table public.referrer_phones is 'Celular del referidor (spec 017). Sin lectura directa: solo por RPC de Referidos.';

alter table public.referrer_asks enable row level security;
alter table public.referrer_phones enable row level security;
revoke all on public.referrer_asks, public.referrer_phones from public, anon, authenticated;

-- Promesa cumplida: en los 7 días siguientes pasó contactos (a mano o al cargar) o llegó un referido suyo ---------
create function public.referrer_ask_kept(p_referrer smallint, p_at timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.referrer_asks a
      where a.referrer_id = p_referrer and a.result = 'passed' and a.created_at >= p_at and a.created_at <= p_at + interval '7 days')
    or exists (
      select 1 from public.prospects p
      where p.referrer_id = p_referrer and p.status = 'active'
        and p.client_created_at >= p_at and p.client_created_at <= p_at + interval '7 days')
$$;
revoke execute on function public.referrer_ask_kept(smallint, timestamptz) from public, anon, authenticated;

-- Guardar pedidos (FR-002) -----------------------------------------------------------------------------------
create function public.referrer_ask_save(p jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'America/La_Paz')::date;
  v_ids smallint[];
  v_method text := p ->> 'method';
  v_result text := p ->> 'result';
  v_note text := nullif(trim(coalesce(p ->> 'note', '')), '');
  v_next date;
  v_n integer;
begin
  if v_uid is null or not public.app_is_active() then raise exception 'forbidden'; end if;
  begin
    select array_agg(distinct (x)::smallint) into v_ids from jsonb_array_elements_text(p -> 'referrer_ids') x;
  exception when others then
    raise exception 'invalid_input' using detail = 'referrer_ids';
  end;
  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n not between 1 and 50 then raise exception 'invalid_input' using detail = 'referrer_ids'; end if;
  if v_method is null or v_method not in ('whatsapp_call', 'message', 'in_person') then
    raise exception 'invalid_input' using detail = 'method';
  end if;
  if v_result is null or v_result not in ('no_answer', 'waiting', 'promised', 'passed', 'none_now', 'quit') then
    raise exception 'invalid_input' using detail = 'result';
  end if;
  if length(v_note) > 500 then raise exception 'invalid_input' using detail = 'note'; end if;
  begin
    v_next := nullif(p ->> 'next_on', '')::date;
  exception when others then
    raise exception 'invalid_input' using detail = 'next_on';
  end;
  if v_result = 'quit' then v_next := null; end if;
  if v_next is not null and (v_next < v_today or v_next > v_today + 90) then
    raise exception 'invalid_input' using detail = 'next_on';
  end if;

  -- Referidores existentes; los unidos se guardan en el que quedó. Todos de sucursales visibles.
  if (select count(*) from public.referrers r where r.id = any (v_ids)) <> v_n then
    raise exception 'invalid_input' using detail = 'referrer_ids';
  end if;
  if exists (select 1 from public.referrers r where r.id = any (v_ids) and not public.can_see_referrals(r.branch_id)) then
    raise exception 'forbidden';
  end if;

  insert into public.referrer_asks (referrer_id, method, result, note, next_on, actor_id)
  select distinct coalesce(r.merged_into, r.id), v_method, v_result, v_note, v_next, v_uid
  from public.referrers r where r.id = any (v_ids);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Datos de la pestaña Seguimiento (FR-003) -------------------------------------------------------------------
create function public.referrer_followup(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_branch smallint;
  v_branches smallint[];
  v_from date;
  v_to date;
  v_prev_from date;
  v_t0 timestamptz;
  v_t1 timestamptz;
begin
  begin
    v_branch := nullif(p ->> 'branch_id', '')::smallint;
    v_from := (p ->> 'from')::date;
    v_to := (p ->> 'to')::date;
  exception when others then
    raise exception 'invalid_input' using detail = 'from';
  end;
  if v_from is null then raise exception 'invalid_input' using detail = 'from'; end if;
  if v_to is null or v_to < v_from or v_to - v_from > 366 then raise exception 'invalid_input' using detail = 'to'; end if;
  v_branches := public.referral_branches(v_branch);
  v_prev_from := v_from - (v_to - v_from + 1);
  v_t0 := v_prev_from::timestamp at time zone tz;
  v_t1 := (v_to + 1)::timestamp at time zone tz;

  return jsonb_build_object(
    'today', (now() at time zone tz)::date,
    'from', v_from, 'to', v_to, 'prev_from', v_prev_from, 'prev_to', v_from - 1,
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.name)
                          from public.branches b where b.id = any (v_branches)), '[]'::jsonb),
    'referrers', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', r.id, 'branch_id', r.branch_id, 'name', r.name, 'kind', r.kind, 'active', r.active,
          'phone', ph.phone, 'created_at', r.created_at, 'created_by', r.created_by, 'created_by_name', cr.full_name,
          'last_ask', (
            select jsonb_build_object('at', a.created_at, 'method', a.method, 'result', a.result, 'next_on', a.next_on,
                                      'kept', public.referrer_ask_kept(r.id, a.created_at), 'actor_name', ap.full_name)
            from public.referrer_asks a left join public.profiles ap on ap.id = a.actor_id
            where a.referrer_id = r.id and not a.auto order by a.created_at desc limit 1),
          'last_load_at', (select max(a.created_at) from public.referrer_asks a where a.referrer_id = r.id and a.auto)
        ) order by r.branch_id, r.sort, r.name)
      from public.referrers r
      left join public.referrer_phones ph on ph.referrer_id = r.id
      left join public.profiles cr on cr.id = r.created_by
      -- «Canal o app» no es una persona: no se le piden referidos.
      where r.branch_id = any (v_branches) and r.merged_into is null and r.kind <> 'channel'), '[]'::jsonb),
    'asks', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', a.id, 'referrer_id', a.referrer_id, 'at', a.created_at, 'day', (a.created_at at time zone tz)::date,
          'method', a.method, 'result', a.result, 'next_on', a.next_on, 'note', a.note, 'auto', a.auto,
          'kept', case when a.result = 'promised' then public.referrer_ask_kept(a.referrer_id, a.created_at) end,
          'actor_id', a.actor_id, 'actor_name', ap.full_name) order by a.created_at)
      from public.referrer_asks a
      join public.referrers r on r.id = a.referrer_id
      left join public.profiles ap on ap.id = a.actor_id
      where r.branch_id = any (v_branches) and a.created_at >= v_t0 and a.created_at < v_t1), '[]'::jsonb),
    'arrivals', coalesce((
      select jsonb_agg(jsonb_build_object('referrer_id', x.referrer_id, 'day', x.day, 'n', x.n))
      from (
        select p.referrer_id, (p.client_created_at at time zone tz)::date as day, count(*)::int as n
        from public.prospects p
        where p.branch_id = any (v_branches) and p.status = 'active' and p.referrer_id is not null
          and p.client_created_at >= v_t0 and p.client_created_at < v_t1
        group by 1, 2
      ) x), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'full_name', u.full_name, 'role', u.role,
               'branch_ids', (select coalesce(jsonb_agg(pb.branch_id order by pb.branch_id), '[]'::jsonb)
                              from public.profile_branches pb where pb.profile_id = u.id and pb.branch_id = any (v_branches)))
             order by u.full_name)
      from public.profiles u
      where (u.active and u.role = 'sales_lead'
             and exists (select 1 from public.profile_branches pb where pb.profile_id = u.id and pb.branch_id = any (v_branches)))
         or exists (select 1 from public.referrer_asks a join public.referrers r on r.id = a.referrer_id
                    where a.actor_id = u.id and not a.auto and r.branch_id = any (v_branches)
                      and a.created_at >= v_t0 and a.created_at < v_t1)
         or exists (select 1 from public.referrers r where r.created_by = u.id and r.branch_id = any (v_branches)
                      and r.created_at >= v_t0 and r.created_at < v_t1)), '[]'::jsonb)
  );
end;
$$;

-- Historial de un referidor (FR-004) -------------------------------------------------------------------------
create function public.referrer_history(p_referrer smallint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_branch smallint;
begin
  select r.branch_id into v_branch from public.referrers r where r.id = p_referrer;
  if v_branch is null then raise exception 'not_found'; end if;
  if not public.can_see_referrals(v_branch) then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('at', x.created_at, 'method', x.method, 'result', x.result, 'next_on', x.next_on,
             'note', x.note, 'auto', x.auto, 'actor_name', x.actor_name,
             'kept', case when x.result = 'promised' then public.referrer_ask_kept(x.referrer_id, x.created_at) end)
           order by x.created_at desc)
    from (
      select a.*, ap.full_name as actor_name from public.referrer_asks a
      left join public.profiles ap on ap.id = a.actor_id
      where a.referrer_id = p_referrer order by a.created_at desc limit 100
    ) x), '[]'::jsonb);
end;
$$;

revoke execute on function public.referrer_ask_save(jsonb), public.referrer_followup(jsonb), public.referrer_history(smallint)
  from public, anon;
grant execute on function public.referrer_ask_save(jsonb), public.referrer_followup(jsonb), public.referrer_history(smallint)
  to authenticated;

-- referrer_save: celular opcional (FR-005) -------------------------------------------------------------------
select pg_temp.patch_function('public.referrer_save(jsonb)',
  '  return v_id;
end;',
  '  -- Spec 017: celular (ausente = no cambia; vacío = se borra; repetido en la sucursal = rechazo).
  if p ? ''phone'' then
    if nullif(trim(coalesce(p ->> ''phone'', '''')), '''') is null then
      delete from public.referrer_phones where referrer_id = v_id;
    elsif not public.is_valid_phone(p ->> ''phone'') then
      raise exception ''invalid_input'' using detail = ''phone'';
    else
      if exists (select 1 from public.referrer_phones x join public.referrers o on o.id = x.referrer_id
                 where x.phone_norm = public.normalize_phone(p ->> ''phone'') and o.branch_id = v_branch
                   and o.id <> v_id and o.merged_into is null) then
        raise exception ''invalid_input'' using detail = ''phone_taken'', hint = (
          select o.name from public.referrer_phones x join public.referrers o on o.id = x.referrer_id
          where x.phone_norm = public.normalize_phone(p ->> ''phone'') and o.branch_id = v_branch
            and o.id <> v_id and o.merged_into is null limit 1);
      end if;
      insert into public.referrer_phones (referrer_id, phone, phone_norm)
      values (v_id, trim(p ->> ''phone''), public.normalize_phone(p ->> ''phone''))
      on conflict (referrer_id) do update set phone = excluded.phone, phone_norm = excluded.phone_norm;
    end if;
  end if;
  return v_id;
end;');

-- referrer_merge: los pedidos y el celular pasan al que queda ------------------------------------------------
select pg_temp.patch_function('public.referrer_merge(jsonb)',
  'update public.prospects set referrer_id = v_into_id where referrer_id = v_from_id;',
  'update public.prospects set referrer_id = v_into_id where referrer_id = v_from_id;
  update public.referrer_asks set referrer_id = v_into_id where referrer_id = v_from_id;
  if exists (select 1 from public.referrer_phones where referrer_id = v_into_id) then
    delete from public.referrer_phones where referrer_id = v_from_id;
  else
    update public.referrer_phones set referrer_id = v_into_id where referrer_id = v_from_id;
  end if;');

-- referral_batch_save: anota «Pasó contactos» automático (FR-006) ---------------------------------------------
select pg_temp.patch_function('public.referral_batch_save(jsonb)',
  '  return jsonb_build_object(''referrer_id'', v_referrer,',
  '  if v_acc > 0 then
    insert into public.referrer_asks (referrer_id, result, note, auto, actor_id)
    values (v_referrer, ''passed'', v_acc || '' referidos cargados'', true, v_uid);
  end if;

  return jsonb_build_object(''referrer_id'', v_referrer,');
