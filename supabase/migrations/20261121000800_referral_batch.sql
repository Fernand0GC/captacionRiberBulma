-- Cargar y asignar referidos desde la oficina (spec 016). Todo aditivo: la app publicada no llama a las RPC nuevas
-- y no lee los campos nuevos de my_contacts ni de referral_report_range.
-- Contrato: specs/016-referidos-carga-asignacion/contracts/rpc.md

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

-- Responsables posibles de una sucursal con sus pendientes (FR-009) ------------------------------------------
create function public.referral_assignees(p_branch smallint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_see_referrals(p_branch) then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', u.id, 'full_name', u.full_name, 'role', u.role, 'pending', (
        select count(*) from public.prospects p
        where p.assigned_to = u.id and p.status = 'active' and p.stage = 'capture'
          and not exists (select 1 from public.followups f where f.prospect_id = p.id)
      )) order by u.full_name)
    from public.profiles u
    where u.branch_id = p_branch and u.active and u.role in ('field_assistant', 'field_supervisor', 'branch_manager')
  ), '[]'::jsonb);
end;
$$;

-- Celulares que ya existen (FR-010): solo nombra cliente y responsable si quien consulta maneja esa sucursal --------
create function public.referral_phone_check(p_branch smallint, p_phones text[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_see_referrals(p_branch) then raise exception 'forbidden'; end if;
  if coalesce(array_length(p_phones, 1), 0) > 50 then raise exception 'invalid_input' using detail = 'phones'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'phone', x.phone, 'norm', x.norm, 'branch_name', b.name,
      'full_name', case when public.manages_branch(p.branch_id) then p.full_name end,
      'assigned_to', case when public.manages_branch(p.branch_id) then s.full_name end))
    from (
      select distinct on (public.normalize_phone(t.phone)) t.phone, public.normalize_phone(t.phone) as norm
      from unnest(p_phones) as t(phone)
      where public.is_valid_phone(t.phone)
    ) x
    join public.prospects p on p.phone_norm = x.norm and p.status = 'active'
    join public.branches b on b.id = p.branch_id
    left join public.profiles s on s.id = p.assigned_to
  ), '[]'::jsonb);
end;
$$;

-- Guardar en lote: registra con submit_capture y asigna con assign_prospects (FR-008) ---------------------------
create function public.referral_batch_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_branch smallint;
  v_items jsonb := p -> 'items';
  v_n integer;
  v_referrer smallint;
  v_ref_name text;
  v_ref_kind text;
  v_item jsonb;
  v_to uuid;
  v_res jsonb;
  v_out jsonb := '[]'::jsonb;
  v_acc integer := 0;
  v_dups integer := 0;
  v_dup record;
begin
  begin
    v_branch := nullif(p ->> 'branch_id', '')::smallint;
  exception when others then
    raise exception 'invalid_input' using detail = 'branch_id';
  end;
  if v_uid is null or v_branch is null or not public.can_see_referrals(v_branch) then raise exception 'forbidden'; end if;

  if jsonb_typeof(v_items) <> 'array' then raise exception 'invalid_input' using detail = 'items'; end if;
  v_n := jsonb_array_length(v_items);
  if v_n not between 1 and 50 then raise exception 'invalid_input' using detail = 'items'; end if;
  if (select count(distinct e ->> 'id') from jsonb_array_elements(v_items) e) <> v_n then
    raise exception 'invalid_input' using detail = 'items';
  end if;

  -- Responsables: todos válidos antes de escribir nada.
  if exists (
    select 1 from jsonb_array_elements(v_items) e
    where nullif(e ->> 'assigned_to', '') is not null
      and not exists (
        select 1 from public.profiles u
        where u.id::text = e ->> 'assigned_to' and u.active and u.branch_id = v_branch
          and u.role in ('field_assistant', 'field_supervisor', 'branch_manager'))
  ) then
    raise exception 'invalid_input' using detail = 'assigned_to';
  end if;

  -- Referidor: de la sucursal (si está unido, el que quedó) o nuevo cargado por el jefe.
  if p ->> 'referrer_id' ~ '^[0-9]{1,5}$' then
    select coalesce(r.merged_into, r.id) into v_referrer from public.referrers r
    where r.id = (p ->> 'referrer_id')::integer and r.branch_id = v_branch;
    if v_referrer is null then raise exception 'invalid_input' using detail = 'referrer_id'; end if;
  elsif jsonb_typeof(p -> 'referrer_new') = 'object' then
    v_ref_name := regexp_replace(trim(coalesce(p #>> '{referrer_new,name}', '')), '\s+', ' ', 'g');
    v_ref_kind := p #>> '{referrer_new,kind}';
    if length(v_ref_name) not between 2 and 60 or v_ref_kind is null
       or v_ref_kind not in ('staff', 'freelance', 'client', 'channel', 'other') then
      raise exception 'invalid_input' using detail = 'referrer_new';
    end if;
    select coalesce(r.merged_into, r.id) into v_referrer from public.referrers r
    where r.branch_id = v_branch and public.referrer_key(r.name) = public.referrer_key(v_ref_name);
    if v_referrer is null then
      insert into public.referrers (branch_id, name, kind, created_by, source)
      values (v_branch, v_ref_name, v_ref_kind, v_uid, 'manager')
      on conflict (branch_id, public.referrer_key(name)) do nothing
      returning id into v_referrer;
      if v_referrer is null then
        select coalesce(r.merged_into, r.id) into v_referrer from public.referrers r
        where r.branch_id = v_branch and public.referrer_key(r.name) = public.referrer_key(v_ref_name);
      end if;
    end if;
  else
    raise exception 'invalid_input' using detail = 'referrer_id';
  end if;

  for v_item in select e from jsonb_array_elements(v_items) e loop
    v_res := public.submit_capture(jsonb_build_object(
      'id', v_item ->> 'id', 'full_name', v_item ->> 'full_name', 'phone', v_item ->> 'phone',
      'product_id', v_item ->> 'product_id', 'branch_id', v_branch, 'referrer_id', v_referrer));
    v_to := nullif(v_item ->> 'assigned_to', '')::uuid;
    if v_res ->> 'result' = 'accepted' then
      v_acc := v_acc + 1;
      if v_to is not null then perform public.assign_prospects(array[(v_res ->> 'id')::uuid], v_to); end if;
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_res ->> 'id', 'result', 'accepted', 'assigned_to', v_to));
    else
      v_dups := v_dups + 1;
      select b.name as branch_name,
             case when public.manages_branch(o.branch_id) then o.full_name end as full_name,
             case when public.manages_branch(o.branch_id) then s.full_name end as assigned_to_name
        into v_dup
      from public.prospects d
      join public.prospects o on o.id = d.duplicate_of
      join public.branches b on b.id = o.branch_id
      left join public.profiles s on s.id = o.assigned_to
      where d.id = (v_res ->> 'id')::uuid;
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_res ->> 'id', 'result', 'duplicate',
        'branch_name', v_dup.branch_name, 'full_name', v_dup.full_name, 'assigned_to_name', v_dup.assigned_to_name));
    end if;
  end loop;

  return jsonb_build_object('referrer_id', v_referrer,
    'referrer_name', (select r.name from public.referrers r where r.id = v_referrer),
    'accepted', v_acc, 'duplicates', v_dups, 'items', v_out);
end;
$$;

revoke execute on function public.referral_assignees(smallint), public.referral_phone_check(smallint, text[]),
  public.referral_batch_save(jsonb) from public, anon;
grant execute on function public.referral_assignees(smallint), public.referral_phone_check(smallint, text[]),
  public.referral_batch_save(jsonb) to authenticated;

-- Mis contactos: quién lo recomendó y quién me lo asignó (FR-011) ------------------------------------------------
select pg_temp.patch_function('public.my_contacts()',
  'a.full_name as created_by_name,',
  'a.full_name as created_by_name, rf.name as referrer_name, asg.full_name as assigned_by_name,');
select pg_temp.patch_function('public.my_contacts()',
  'left join public.channels c on c.id = p.channel_id',
  'left join public.channels c on c.id = p.channel_id
      left join public.referrers rf on rf.id = p.referrer_id
      left join lateral (
        select ap.full_name from public.assignment_events e
        join public.profiles ap on ap.id = e.actor_id
        where e.prospect_id = p.id and e.to_user = auth.uid() and e.actor_id <> auth.uid()
          and not exists (select 1 from public.assignment_events e2
                          where e2.prospect_id = p.id and e2.created_at > e.created_at)
        order by e.created_at desc limit 1
      ) asg on true');

-- Reporte por rango: cantidad, primer y último contacto de cada referido (FR-013) ------------------------------
select pg_temp.patch_function('public.referral_report_range(jsonb)',
  '''last_contact_at'', (select max(f.contacted_at) from public.followups f where f.prospect_id = c.id),',
  '''last_contact_at'', (select max(f.contacted_at) from public.followups f where f.prospect_id = c.id),
          ''contacts'', (select count(*) from public.followups f where f.prospect_id = c.id),
          ''first_contact_at'', (select min(f.contacted_at) from public.followups f where f.prospect_id = c.id),
          ''last_method'', lf.method, ''last_result'', lf.result, ''last_note'', lf.note,');
select pg_temp.patch_function('public.referral_report_range(jsonb)',
  'left join public.profiles a on a.id = c.created_by), ''[]''::jsonb) else ''[]''::jsonb end,',
  'left join public.profiles a on a.id = c.created_by
        left join lateral (
          select f.method, f.result, f.note from public.followups f
          where f.prospect_id = c.id order by f.contacted_at desc limit 1
        ) lf on true), ''[]''::jsonb) else ''[]''::jsonb end,');
