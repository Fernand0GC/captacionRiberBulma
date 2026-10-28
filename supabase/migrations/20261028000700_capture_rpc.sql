-- RPC del registro de campo (contracts/rpc.md). Errores: raise exception '<code>' (mensaje estable).

create table public.rate_limits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null,
  primary key (user_id, bucket)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from authenticated, anon;

create function public.hit_rate_limit(p_bucket text, p_max integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c integer;
  w timestamptz := date_trunc('minute', now());
begin
  insert into public.rate_limits as r (user_id, bucket, window_start, count)
  values (auth.uid(), p_bucket, w, 1)
  on conflict (user_id, bucket) do update
    set count = case when r.window_start = excluded.window_start then r.count + 1 else 1 end,
        window_start = excluded.window_start
  returning count into c;
  if c > p_max then
    raise exception 'rate_limited';
  end if;
end;
$$;

create function public.submit_capture(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_prof public.profiles;
  v_id uuid;
  v_existing record;
  v_client timestamptz;
  v_late boolean := false;
  v_branch smallint;
  v_name text := trim(coalesce(p ->> 'full_name', ''));
  v_phone text := coalesce(p ->> 'phone', '');
  v_norm text;
  v_dup uuid;
  v_status public.prospect_status;
  v_product integer := nullif(p ->> 'product_id', '')::integer;
begin
  if v_uid is null then raise exception 'forbidden'; end if;
  select * into v_prof from public.profiles where id = v_uid;
  if not found then raise exception 'forbidden'; end if;

  begin
    v_id := (p ->> 'id')::uuid;
  exception when others then
    raise exception 'invalid_input' using detail = 'id';
  end;
  if v_id is null then raise exception 'invalid_input' using detail = 'id'; end if;

  -- Idempotencia: el mismo id devuelve el mismo resultado sin crear nada.
  select id, status, created_by into v_existing from public.prospects where id = v_id;
  if found then
    if v_existing.created_by <> v_uid then raise exception 'forbidden'; end if;
    return jsonb_build_object('id', v_id,
      'result', case when v_existing.status = 'duplicate_rejected' then 'duplicate' else 'accepted' end);
  end if;

  begin
    v_client := coalesce((p ->> 'client_created_at')::timestamptz, v_now);
  exception when others then
    raise exception 'invalid_input' using detail = 'client_created_at';
  end;
  v_client := least(v_client, v_now + interval '10 minutes');  -- sin fechas futuras (R9)

  -- Usuario dado de baja: solo lo creado antes de la baja y dentro de 7 días (R9, analyze S1).
  if not v_prof.active then
    if v_client > v_prof.deactivated_at or v_now > v_prof.deactivated_at + interval '7 days' then
      raise exception 'forbidden';
    end if;
    v_late := true;
  end if;

  perform public.hit_rate_limit('submit_capture', 120);

  -- Sucursal: el campo usa la de su perfil; el encargado solo la suya; gerente/admin la eligen.
  if v_prof.role in ('field_volunteer', 'field_assistant', 'field_supervisor') then
    v_branch := v_prof.branch_id;
  elsif v_prof.role = 'branch_manager' then
    v_branch := coalesce(nullif(p ->> 'branch_id', '')::smallint, v_prof.branch_id);
    if v_branch <> v_prof.branch_id then raise exception 'forbidden'; end if;
  else
    v_branch := nullif(p ->> 'branch_id', '')::smallint;
    if v_branch is null or not exists (select 1 from public.branches b where b.id = v_branch and b.active) then
      raise exception 'invalid_input' using detail = 'branch_id';
    end if;
  end if;

  if length(v_name) not between 3 and 120 then raise exception 'invalid_input' using detail = 'full_name'; end if;
  if not public.is_valid_phone(v_phone) then raise exception 'invalid_phone'; end if;
  -- Solo nombre y teléfono son obligatorios (FR-011); lo opcional se valida si llega.
  if v_product is not null
     and not exists (select 1 from public.products x where x.id = v_product and x.active) then
    raise exception 'invalid_input' using detail = 'product_id';
  end if;
  if nullif(p ->> 'channel_id', '') is not null
     and not exists (select 1 from public.channels x where x.id = (p ->> 'channel_id')::smallint and x.active) then
    raise exception 'invalid_input' using detail = 'channel_id';
  end if;
  if nullif(p ->> 'interest', '') is not null and p ->> 'interest' not in ('high', 'medium', 'low') then
    raise exception 'invalid_input' using detail = 'interest';
  end if;

  v_norm := public.normalize_phone(v_phone);
  select id into v_dup from public.prospects where phone_norm = v_norm and status = 'active';
  v_status := case when v_dup is null then 'active' else 'duplicate_rejected' end;

  begin
    insert into public.prospects (
      id, full_name, phone_raw, phone_norm, product_id, channel_id, interest, occupation, address,
      branch_id, created_by, client_created_at, received_at, shift, status, duplicate_of,
      late_after_deactivation, updated_by
    ) values (
      v_id, v_name, v_phone, v_norm, v_product, nullif(p ->> 'channel_id', '')::smallint,
      nullif(p ->> 'interest', '')::public.interest_level, nullif(trim(p ->> 'occupation'), ''), nullif(trim(p ->> 'address'), ''),
      v_branch, v_uid, v_client, v_now, public.shift_for(v_client), v_status, v_dup, v_late, v_uid
    );
  exception when unique_violation then
    -- Carrera: otro llegó primero con el mismo teléfono entre el SELECT y el INSERT.
    select id into v_dup from public.prospects where phone_norm = v_norm and status = 'active';
    v_status := 'duplicate_rejected';
    insert into public.prospects (
      id, full_name, phone_raw, phone_norm, product_id, channel_id, interest, occupation, address,
      branch_id, created_by, client_created_at, received_at, shift, status, duplicate_of,
      late_after_deactivation, updated_by
    ) values (
      v_id, v_name, v_phone, v_norm, v_product, nullif(p ->> 'channel_id', '')::smallint,
      nullif(p ->> 'interest', '')::public.interest_level, nullif(trim(p ->> 'occupation'), ''), nullif(trim(p ->> 'address'), ''),
      v_branch, v_uid, v_client, v_now, public.shift_for(v_client), v_status, v_dup, v_late, v_uid
    );
  end;

  if v_status = 'active' then
    insert into public.stage_events (prospect_id, from_stage, to_stage, actor_id)
    values (v_id, null, 'capture', v_uid);
  end if;

  return jsonb_build_object('id', v_id, 'result', case when v_status = 'active' then 'accepted' else 'duplicate' end);
end;
$$;

create function public.phone_available(phone text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.app_is_active() then raise exception 'forbidden'; end if;
  perform public.hit_rate_limit('phone_available', 60);
  if not public.is_valid_phone(phone) then raise exception 'invalid_phone'; end if;
  return not exists (
    select 1 from public.prospects where phone_norm = public.normalize_phone(phone) and status = 'active'
  );
end;
$$;

create function public.my_capture_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.app_is_active() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'today', (
      select count(*) from public.prospects
      where created_by = auth.uid() and status = 'active'
        and (client_created_at at time zone 'America/La_Paz')::date = (now() at time zone 'America/La_Paz')::date
    ),
    'shift', public.shift_for(now())
  );
end;
$$;

create function public.my_rejections(since timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'phone_masked', left(phone_norm, 4) || '••' || right(phone_norm, 2),
      'at', received_at
    ) order by received_at)
    from public.prospects
    where created_by = auth.uid() and status = 'duplicate_rejected' and received_at > since
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.hit_rate_limit(text, integer), public.submit_capture(jsonb), public.phone_available(text),
  public.my_capture_stats(), public.my_rejections(timestamptz) from public, anon;
grant execute on function public.submit_capture(jsonb), public.phone_available(text),
  public.my_capture_stats(), public.my_rejections(timestamptz) to authenticated;
