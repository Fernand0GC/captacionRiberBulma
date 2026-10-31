-- Pantalla de reparto de la tarde (FR-039b mejorado, pedido 2026-10-28): vista previa con la carga de cada persona
-- y reparto atómico por cupos. Alcance: encargado = su sucursal; gerente/Sistemas = la sucursal elegida.

-- Prospectos repartibles: vigentes, sin responsable, sin cerrar, de la sucursal; del rango de fechas (La Paz)
-- o, si p_include_older, también los de días anteriores.
create function public.distribution_pool(p_branch smallint, p_from date, p_to date, p_include_older boolean)
returns setof public.prospects
language sql stable security definer set search_path = '' as $$
  select p.* from public.prospects p
  where p.branch_id = p_branch and p.status = 'active' and p.assigned_to is null and p.stage not in ('sale', 'lost')
    and p.client_created_at < ((p_to + 1)::timestamp at time zone 'America/La_Paz')
    and (p_include_older or p.client_created_at >= (p_from::timestamp at time zone 'America/La_Paz'))
  order by p.client_created_at, p.id
$$;
revoke execute on function public.distribution_pool(smallint, date, date, boolean) from public, anon, authenticated;

create function public.distribution_preview(p_branch smallint, p_from date, p_to date, p_include_older boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_end_today timestamptz := (((now() at time zone tz)::date + 1)::timestamp at time zone tz);
begin
  if not public.manages_branch(p_branch) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.distribution_pool(p_branch, p_from, p_to, p_include_older)),
    'by_author', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.full_name, 'n', x.n) order by x.n desc)
      from (select a.full_name, count(*) as n
            from public.distribution_pool(p_branch, p_from, p_to, p_include_older) d
            join public.profiles a on a.id = d.created_by group by a.full_name) x
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'full_name', u.full_name, 'role', u.role,
        'pending_today', (select count(*) from public.prospects p where p.assigned_to = u.id and p.status = 'active'
                            and p.stage not in ('sale', 'lost') and (p.next_contact_at is null or p.next_contact_at < v_end_today)),
        'assigned_total', (select count(*) from public.prospects p where p.assigned_to = u.id and p.status = 'active'
                             and p.stage not in ('sale', 'lost'))
      ) order by case u.role when 'field_assistant' then 0 when 'field_supervisor' then 1 else 2 end, u.full_name)
      from public.profiles u
      where u.branch_id = p_branch and u.active and u.role in ('field_assistant', 'field_supervisor', 'branch_manager')
    ), '[]'::jsonb)
  );
end;
$$;

-- Reparte por cupos {user_id: cantidad}. Los cupos se van llenando intercalados (A, B, C, A, B, …) sobre las
-- captaciones ordenadas por hora, para que cada persona reciba una mezcla de volanteros y horarios.
create function public.distribute_prospects(p_branch smallint, p_from date, p_to date, p_include_older boolean, p_quotas jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_people uuid[];
  v_left integer[];
  v_total_quota integer := 0;
  v_i integer;
  v_k integer;
  v_n integer := 0;
  v_result jsonb := '{}'::jsonb;
  r record;
  q record;
begin
  if not public.manages_branch(p_branch) then raise exception 'forbidden'; end if;

  for q in select key::uuid as id, value::int as n from jsonb_each_text(coalesce(p_quotas, '{}'::jsonb)) loop
    if q.n < 0 then raise exception 'invalid_input' using detail = 'quotas'; end if;
    if q.n = 0 then continue; end if;
    if not exists (select 1 from public.profiles u where u.id = q.id and u.active and u.branch_id = p_branch
                   and u.role in ('field_assistant', 'field_supervisor', 'branch_manager')) then
      raise exception 'invalid_input' using detail = 'to_user';
    end if;
    v_people := array_append(v_people, q.id);
    v_left := array_append(v_left, q.n);
    v_total_quota := v_total_quota + q.n;
  end loop;
  if v_people is null then raise exception 'invalid_input' using detail = 'quotas'; end if;

  v_i := 0;
  for r in select d.id from public.distribution_pool(p_branch, p_from, p_to, p_include_older) d for update skip locked loop
    exit when v_n >= v_total_quota;
    -- siguiente persona con cupo, en ronda
    for v_k in 1 .. array_length(v_people, 1) loop
      v_i := (v_i % array_length(v_people, 1)) + 1;
      exit when v_left[v_i] > 0;
    end loop;
    update public.prospects set assigned_to = v_people[v_i], updated_at = now(), updated_by = auth.uid() where id = r.id;
    insert into public.assignment_events (prospect_id, from_user, to_user, actor_id) values (r.id, null, v_people[v_i], auth.uid());
    v_left[v_i] := v_left[v_i] - 1;
    v_n := v_n + 1;
    v_result := jsonb_set(v_result, array[v_people[v_i]::text], to_jsonb(coalesce((v_result ->> v_people[v_i]::text)::int, 0) + 1));
  end loop;

  return jsonb_build_object('assigned', v_n, 'by_person', v_result);
end;
$$;

revoke execute on function public.distribution_preview(smallint, date, date, boolean),
  public.distribute_prospects(smallint, date, date, boolean, jsonb) from public, anon;
grant execute on function public.distribution_preview(smallint, date, date, boolean),
  public.distribute_prospects(smallint, date, date, boolean, jsonb) to authenticated;
