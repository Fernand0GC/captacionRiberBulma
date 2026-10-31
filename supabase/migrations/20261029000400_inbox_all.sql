-- Mis contactos rediseñado (2026-10-29): una sola consulta con TODOS los asignados abiertos y cuántos contactos tiene
-- cada uno; la app los separa en "No recaptados" / "Recaptados" (Seguimiento, No contestó) y marca en la misma tabla
-- lo resuelto hoy y lo que toca contactar.
create or replace function public.my_contacts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.app_is_active() or not public.can_follow_up() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.client_created_at)
    from (
      select p.id, p.full_name, p.phone_raw, p.phone_norm, p.stage, p.contact_attempts, p.next_contact_at, p.visit_at,
             p.client_created_at, p.product_id, pr.name as product_name, c.name as channel_name, a.full_name as created_by_name,
             (select count(*) from public.followups f where f.prospect_id = p.id) as contacts_count,
             lf.result as last_result, lf.method as last_method, lf.note as last_note, lf.contacted_at as last_contacted_at
      from public.prospects p
      join public.profiles a on a.id = p.created_by
      left join public.products pr on pr.id = p.product_id
      left join public.channels c on c.id = p.channel_id
      left join lateral (
        select f.result, f.method, f.note, f.contacted_at from public.followups f
        where f.prospect_id = p.id order by f.contacted_at desc limit 1
      ) lf on true
      where p.assigned_to = auth.uid() and p.status = 'active' and p.stage not in ('sale', 'lost')
      limit 1000
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke execute on function public.my_contacts() from public, anon;
grant execute on function public.my_contacts() to authenticated;
