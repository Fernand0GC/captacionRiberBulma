-- Limpieza (2026-10-29): se quita la vista 'later' ("Después") de list_my_followups. Mis contactos ahora usa
-- my_contacts() y marca en la misma tabla lo resuelto hoy y lo que toca contactar. Se vuelve a la versión anterior.
create or replace function public.list_my_followups(p_view text default 'today') returns jsonb
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

