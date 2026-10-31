-- Ficha del cliente (US2: T043/T046): ver con historial completo, editar (auditado), anular (solo Sistemas).
-- Ven la ficha: gestores del alcance (encargado su sucursal; gerente/Sistemas todas) y el responsable asignado.

-- Auditoría de ediciones de datos del cliente (no de los cambios de etapa, que ya tienen su propio historial).
create trigger prospects_audit after update of full_name, phone_raw, product_id, channel_id, interest, occupation, address, status
  on public.prospects for each row execute function public.audit_row();

create function public.get_prospect(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.prospects;
  v_manage boolean;
begin
  select * into v from public.prospects where id = p_id;
  if not found then raise exception 'not_found'; end if;
  v_manage := public.manages_branch(v.branch_id);
  if not (v_manage or public.can_work_prospect(v.branch_id, v.assigned_to)) then raise exception 'forbidden'; end if;
  if v.status <> 'active' and not v_manage then raise exception 'not_found'; end if;

  return jsonb_build_object(
    'prospect', (
      select jsonb_build_object(
        'id', p.id, 'full_name', p.full_name, 'phone_raw', p.phone_raw, 'phone_norm', p.phone_norm,
        'product_id', p.product_id, 'product_name', pr.name, 'product_group', pr.product_group,
        'channel_id', p.channel_id, 'channel_name', c.name, 'interest', p.interest,
        'occupation', p.occupation, 'address', p.address, 'branch_id', p.branch_id, 'branch_name', b.name,
        'created_by_name', a.full_name, 'created_by_role', a.role, 'client_created_at', p.client_created_at, 'shift', p.shift,
        'stage', p.stage, 'stage_changed_at', p.stage_changed_at, 'lost_reason', lr.name, 'sold_at', p.sold_at,
        'assigned_to', p.assigned_to, 'assigned_to_name', s.full_name, 'contact_attempts', p.contact_attempts,
        'next_contact_at', p.next_contact_at, 'visit_at', p.visit_at, 'status', p.status,
        'void_reason', p.void_reason, 'voided_at', p.voided_at, 'late_after_deactivation', p.late_after_deactivation)
      from public.prospects p
      join public.branches b on b.id = p.branch_id
      join public.profiles a on a.id = p.created_by
      left join public.products pr on pr.id = p.product_id
      left join public.channels c on c.id = p.channel_id
      left join public.profiles s on s.id = p.assigned_to
      left join public.lost_reasons lr on lr.id = p.lost_reason_id
      where p.id = p_id
    ),
    'can_edit', v_manage and v.status = 'active',
    'can_void', public.app_is_active() and public.app_role() = 'admin' and v.status = 'active',
    'can_contact', v.status = 'active' and v.stage not in ('sale', 'lost'),
    'timeline', coalesce((
      select jsonb_agg(t order by t.at desc, t.ord desc) from (
        -- captación
        select 0 as ord, p.client_created_at as at, 'capture' as type, a.full_name as actor,
               jsonb_build_object('channel', c.name) as data
        from public.prospects p join public.profiles a on a.id = p.created_by left join public.channels c on c.id = p.channel_id
        where p.id = p_id
        union all
        -- asignaciones
        select 1, e.created_at, 'assignment', x.full_name, jsonb_build_object('to', t.full_name, 'from', f.full_name)
        from public.assignment_events e join public.profiles x on x.id = e.actor_id
        left join public.profiles t on t.id = e.to_user left join public.profiles f on f.id = e.from_user
        where e.prospect_id = p_id
        union all
        -- contactos
        select 3, fu.contacted_at, 'contact', x.full_name,
               jsonb_build_object('result', fu.result, 'method', fu.method, 'note', fu.note, 'visit_at', fu.visit_at, 'callback_at', fu.callback_at)
        from public.followups fu join public.profiles x on x.id = fu.actor_id
        where fu.prospect_id = p_id
        union all
        -- cambios de etapa (el inicial "captación" ya está arriba)
        select 2, e.created_at, 'stage', x.full_name, jsonb_build_object('from', e.from_stage, 'to', e.to_stage, 'reason', lr.name, 'note', e.note)
        from public.stage_events e join public.profiles x on x.id = e.actor_id left join public.lost_reasons lr on lr.id = e.lost_reason_id
        where e.prospect_id = p_id and e.from_stage is not null
        union all
        -- ediciones de datos
        select 4, l.at, 'edit', x.full_name, jsonb_build_object('old', l.old, 'new', l.new)
        from public.audit_log l left join public.profiles x on x.id = l.actor_id
        where l.table_name = 'prospects' and l.row_id = p_id
        union all
        -- intentos de registrar el mismo teléfono (rechazados por duplicado)
        select 5, d.received_at, 'duplicate', x.full_name, jsonb_build_object('name', d.full_name, 'branch', b.name)
        from public.prospects d join public.profiles x on x.id = d.created_by join public.branches b on b.id = d.branch_id
        where d.duplicate_of = p_id
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

-- Editar datos del cliente (gestores del alcance). El teléfono se revalida como único global.
create function public.update_prospect(p_id uuid, patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.prospects;
  v_name text;
  v_phone text;
  v_norm text;
begin
  select * into v from public.prospects where id = p_id for update;
  if not found or v.status <> 'active' then raise exception 'not_found'; end if;
  if not public.manages_branch(v.branch_id) then raise exception 'forbidden'; end if;

  v_name := coalesce(trim(patch ->> 'full_name'), v.full_name);
  if length(v_name) not between 3 and 120 then raise exception 'invalid_input' using detail = 'full_name'; end if;
  v_phone := coalesce(nullif(trim(patch ->> 'phone'), ''), v.phone_raw);
  if not public.is_valid_phone(v_phone) then raise exception 'invalid_phone'; end if;
  v_norm := public.normalize_phone(v_phone);
  if v_norm <> v.phone_norm and exists (select 1 from public.prospects where phone_norm = v_norm and status = 'active' and id <> p_id) then
    raise exception 'invalid_input' using detail = 'phone_duplicate';
  end if;
  if patch ? 'product_id' and nullif(patch ->> 'product_id', '') is not null
     and not exists (select 1 from public.products where id = (patch ->> 'product_id')::integer and active) then
    raise exception 'invalid_input' using detail = 'product_id';
  end if;
  if patch ? 'channel_id' and nullif(patch ->> 'channel_id', '') is not null
     and not exists (select 1 from public.channels where id = (patch ->> 'channel_id')::smallint and active) then
    raise exception 'invalid_input' using detail = 'channel_id';
  end if;
  if patch ? 'interest' and nullif(patch ->> 'interest', '') is not null and patch ->> 'interest' not in ('high', 'medium', 'low') then
    raise exception 'invalid_input' using detail = 'interest';
  end if;
  if v.stage = 'sale' and patch ? 'product_id' and nullif(patch ->> 'product_id', '') is null then
    raise exception 'invalid_input' using detail = 'product_id';  -- una venta necesita producto
  end if;

  update public.prospects set
    full_name = v_name,
    phone_raw = v_phone,
    phone_norm = v_norm,
    product_id = case when patch ? 'product_id' then nullif(patch ->> 'product_id', '')::integer else product_id end,
    channel_id = case when patch ? 'channel_id' then nullif(patch ->> 'channel_id', '')::smallint else channel_id end,
    interest = case when patch ? 'interest' then nullif(patch ->> 'interest', '')::public.interest_level else interest end,
    occupation = case when patch ? 'occupation' then nullif(trim(patch ->> 'occupation'), '') else occupation end,
    address = case when patch ? 'address' then nullif(trim(patch ->> 'address'), '') else address end,
    updated_at = now(), updated_by = auth.uid()
  where id = p_id;
end;
$$;

-- Anular (solo Sistemas): sale de listas y reportes; se conserva con motivo (no se borra).
create function public.void_prospect(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.app_is_active() or public.app_role() <> 'admin' then raise exception 'forbidden'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'invalid_input' using detail = 'reason'; end if;
  update public.prospects set status = 'voided', void_reason = trim(p_reason), voided_by = auth.uid(), voided_at = now(),
    updated_at = now(), updated_by = auth.uid()
  where id = p_id and status = 'active';
  if not found then raise exception 'not_found'; end if;
end;
$$;

revoke execute on function public.get_prospect(uuid), public.update_prospect(uuid, jsonb), public.void_prospect(uuid, text) from public, anon;
grant execute on function public.get_prospect(uuid), public.update_prospect(uuid, jsonb), public.void_prospect(uuid, text) to authenticated;
