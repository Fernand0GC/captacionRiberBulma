-- «Del día»: filtro Persona (person_id) y lupa por celular. Reemplaza daily_report (20261119000300) sin cambiar lo que
-- devuelve cuando no se manda person_id; solo suma:
--   · person_id: registros nuevos = los que ESA persona registró; seguimiento = clientes con algún contacto suyo ese día,
--     y cada fila (contactos, efectivo, último resultado/método/hora) se calcula solo con sus contactos.
--   · people: quienes registraron o contactaron en el período, alcance y origen elegidos (sin aplicar person_id, para
--     que el selector conserve sus opciones). [{id, name}] por nombre.
--   · phone_norm en las filas, para buscar por celular (matchesNameOrPhone).
-- Deshacer: volver a correr 20261119000300_daily_report.sql (la firma es la misma).

create or replace function public.daily_report(f jsonb default '{}')
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  max_rows constant integer := 2000;
  v_branch smallint;
  v_from date;
  v_to date;
  v_origin text := coalesce(nullif(f ->> 'origin', ''), 'all');
  v_referrer smallint := nullif(f ->> 'referrer_id', '')::smallint;
  v_person_txt text := nullif(f ->> 'person_id', '');
  v_person uuid;
  v_lists boolean := coalesce(nullif(f ->> 'lists', '')::boolean, true);
  v_start timestamptz;
  v_end timestamptz;
  v_totals jsonb;
  v_people jsonb := '[]';
  v_new jsonb := '[]';
  v_followed jsonb := '[]';
  v_truncated boolean := false;
begin
  if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'; end if;
  v_branch := public.scoped_branch(nullif(f ->> 'branch_id', '')::smallint);
  v_from := coalesce(nullif(f ->> 'from', '')::date, (now() at time zone tz)::date);
  v_to := coalesce(nullif(f ->> 'to', '')::date, v_from);
  if v_to < v_from or v_to - v_from > 366 then raise exception 'invalid_input' using detail = 'to'; end if;
  if v_origin not in ('all', 'referred') then raise exception 'invalid_input' using detail = 'origin'; end if;
  if v_person_txt is not null then
    if v_person_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'invalid_input' using detail = 'person_id';
    end if;
    v_person := v_person_txt::uuid;
  end if;
  -- Ventana en hora de Bolivia (research R3 de la 009).
  v_start := v_from::timestamp at time zone tz;
  v_end := (v_to + 1)::timestamp at time zone tz;

  -- Clientes que cuentan, en cada consulta: activos, del alcance y del origen elegido (FR-003, FR-004 de la 009).
  with new_all as (
    select p.id, p.created_by from public.prospects p
    where p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and (v_origin = 'all' or p.referrer_id is not null)
      and (v_referrer is null or p.referrer_id = v_referrer)
      and p.client_created_at >= v_start and p.client_created_at < v_end
  ),
  new_ as (select * from new_all where v_person is null or created_by = v_person),
  week as (
    select count(*) as n from public.prospects p
    where p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and (v_origin = 'all' or p.referrer_id is not null)
      and (v_referrer is null or p.referrer_id = v_referrer)
      and (v_person is null or p.created_by = v_person)
      and p.client_created_at >= ((v_to - 6)::timestamp at time zone tz) and p.client_created_at < v_end
  ),
  contacts_all as (
    select fu.prospect_id, fu.effective, fu.actor_id from public.followups fu
    join public.prospects p on p.id = fu.prospect_id
    where p.status = 'active'
      and (v_branch is null or p.branch_id = v_branch)
      and (v_origin = 'all' or p.referrer_id is not null)
      and (v_referrer is null or p.referrer_id = v_referrer)
      and fu.contacted_at >= v_start and fu.contacted_at < v_end
  ),
  contacts as (select * from contacts_all where v_person is null or actor_id = v_person),
  people as (
    select pr.id, pr.full_name as name
    from (select created_by as pid from new_all union select actor_id from contacts_all) x
    join public.profiles pr on pr.id = x.pid
  )
  select jsonb_build_object(
      'new', (select count(*) from new_),
      'new_people', (select count(distinct created_by) from new_),
      'week_new', (select n from week),
      'followed', (select count(distinct prospect_id) from contacts),
      'effective', (select count(distinct prospect_id) from contacts where effective),
      'contacts', (select count(*) from contacts)
    ),
    (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name, id), '[]') from people)
  into v_totals, v_people;

  if v_lists then
    -- Registros nuevos, por hora (FR-002 de la 009).
    select coalesce(jsonb_agg(x.j order by x.at, x.id), '[]'), count(*) > max_rows
      into v_new, v_truncated
    from (
      select p.client_created_at as at, p.id, jsonb_build_object(
        'id', p.id, 'registered_at', p.client_created_at, 'full_name', p.full_name, 'phone', p.phone_raw,
        'phone_norm', p.phone_norm,
        'channel', ch.name, 'channel_detail', p.channel_detail, 'referrer', r.name,
        'created_by', cb.full_name, 'assigned_to', asg.full_name, 'stage', p.stage, 'branch', b.name) as j
      from public.prospects p
      join public.branches b on b.id = p.branch_id
      join public.profiles cb on cb.id = p.created_by
      left join public.profiles asg on asg.id = p.assigned_to
      left join public.channels ch on ch.id = p.channel_id
      left join public.referrers r on r.id = p.referrer_id
      where p.status = 'active'
        and (v_branch is null or p.branch_id = v_branch)
        and (v_origin = 'all' or p.referrer_id is not null)
        and (v_referrer is null or p.referrer_id = v_referrer)
        and (v_person is null or p.created_by = v_person)
        and p.client_created_at >= v_start and p.client_created_at < v_end
      order by p.client_created_at, p.id
      limit max_rows + 1
    ) x;
    if v_truncated then v_new := v_new - max_rows; end if;

    -- Clientes con seguimiento: uno por fila, con sus contactos del período y el último. Con persona, solo los suyos.
    select coalesce(jsonb_agg(x.j order by x.at desc, x.id), '[]'), v_truncated or count(*) > max_rows
      into v_followed, v_truncated
    from (
      select c.last_at as at, p.id, jsonb_build_object(
        'id', p.id, 'full_name', p.full_name, 'phone', p.phone_raw, 'phone_norm', p.phone_norm,
        'contacts', c.contacts, 'effective', c.effective, 'last_at', c.last_at,
        'last_method', c.last_method, 'last_result', c.last_result, 'last_actor', ac.full_name,
        'registered_at', p.client_created_at, 'channel', ch.name, 'referrer', r.name,
        'stage', p.stage, 'branch', b.name) as j
      from (
        select fu.prospect_id, count(*) as contacts, bool_or(fu.effective) as effective,
               max(fu.contacted_at) as last_at,
               (array_agg(fu.method order by fu.contacted_at desc))[1] as last_method,
               (array_agg(fu.result order by fu.contacted_at desc))[1] as last_result,
               (array_agg(fu.actor_id order by fu.contacted_at desc))[1] as last_actor
        from public.followups fu
        where fu.contacted_at >= v_start and fu.contacted_at < v_end
          and (v_person is null or fu.actor_id = v_person)
        group by fu.prospect_id
      ) c
      join public.prospects p on p.id = c.prospect_id
      join public.branches b on b.id = p.branch_id
      join public.profiles ac on ac.id = c.last_actor
      left join public.channels ch on ch.id = p.channel_id
      left join public.referrers r on r.id = p.referrer_id
      where p.status = 'active'
        and (v_branch is null or p.branch_id = v_branch)
        and (v_origin = 'all' or p.referrer_id is not null)
        and (v_referrer is null or p.referrer_id = v_referrer)
      order by c.last_at desc, p.id
      limit max_rows + 1
    ) x;
    if jsonb_array_length(v_followed) > max_rows then v_followed := v_followed - max_rows; end if;
  end if;

  return jsonb_build_object('from', v_from, 'to', v_to, 'totals', v_totals, 'people', v_people,
    'new_rows', v_new, 'followed_rows', v_followed, 'truncated', v_truncated);
end;
$$;

revoke execute on function public.daily_report(jsonb) from public, anon;
grant execute on function public.daily_report(jsonb) to authenticated;
