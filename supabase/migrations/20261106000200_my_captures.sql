-- Mis registros: cada persona ve solo lo que ella registró (pantalla de la auxiliar), en un rango de días.
-- Incluye los repetidos (no se guardaron) para que sepa qué pasó con cada uno.
create function public.my_captures(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
begin
  if auth.uid() is null or not public.app_is_active() then raise exception 'forbidden'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 92 then
    raise exception 'invalid_input' using detail = 'range';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'phone_raw', p.phone_raw,
      'product_name', pr.name, 'channel_name', c.name, 'channel_detail', p.channel_detail, 'interest', p.interest,
      'occupation', p.occupation, 'address', p.address, 'client_created_at', p.client_created_at,
      'stage', p.stage, 'status', p.status, 'assigned_to_me', p.assigned_to = auth.uid(), 'assigned_to_name', s.full_name
    ) order by p.client_created_at desc)
    from public.prospects p
    left join public.products pr on pr.id = p.product_id
    left join public.channels c on c.id = p.channel_id
    left join public.profiles s on s.id = p.assigned_to
    where p.created_by = auth.uid() and p.status in ('active', 'duplicate_rejected')
      and p.client_created_at >= (p_from::timestamp at time zone tz)
      and p.client_created_at < ((p_to + 1)::timestamp at time zone tz)
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.my_captures(date, date) from public, anon;
grant execute on function public.my_captures(date, date) to authenticated;
