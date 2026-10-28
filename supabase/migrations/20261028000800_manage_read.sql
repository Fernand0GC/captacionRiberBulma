-- Panel de captaciones de solo lectura (US2, re-alcance 2026-10-28).
-- Se consulta por RPC (POST) para que la búsqueda por nombre o celular nunca viaje en una URL (constitución IV).
-- El alcance se aplica adentro: encargado = su sucursal; gerente/admin = todas; el resto, prohibido.

create function public.list_prospects(f jsonb default '{}', p_limit integer default 50, p_offset integer default 0)
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
      and p.client_created_at >= (v_from::timestamp at time zone tz)
      and p.client_created_at < ((v_to + 1)::timestamp at time zone tz)
      and (v_created_by is null or p.created_by = v_created_by)
      and (v_channel is null or p.channel_id = v_channel)
      and (v_q is null or p.full_name ilike '%' || v_q || '%'
           or (v_qdigits is not null and p.phone_norm like '%' || v_qdigits || '%'))
  ),
  page as (
    select p.id, p.full_name, p.phone_raw, p.interest, p.occupation, p.address, p.client_created_at, p.shift, p.stage,
           p.late_after_deactivation, p.branch_id, b.name as branch_name,
           p.created_by, a.full_name as created_by_name, a.role as created_by_role,
           c.name as channel_name, pr.name as product_name, pr.product_group
    from base p
    join public.branches b on b.id = p.branch_id
    join public.profiles a on a.id = p.created_by
    left join public.channels c on c.id = p.channel_id
    left join public.products pr on pr.id = p.product_id
    order by p.client_created_at desc, p.id
    limit v_limit offset v_offset
  )
  select (select count(*) from base),
         coalesce((select jsonb_agg(row_to_json(pg) order by pg.client_created_at desc, pg.id) from page pg), '[]'::jsonb)
  into v_total, v_rows;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

-- Personal para el filtro "registrado por": encargado = su sucursal; gerente/admin = todos (incluye dados de baja).
create function public.staff_options() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'role', p.role,
                                        'branch_id', p.branch_id, 'active', p.active) order by p.full_name)
    from public.profiles p
    where public.is_global() or p.branch_id = public.app_branch()
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.list_prospects(jsonb, integer, integer), public.staff_options() from public, anon;
grant execute on function public.list_prospects(jsonb, integer, integer), public.staff_options() to authenticated;
