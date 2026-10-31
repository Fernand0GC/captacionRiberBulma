-- my_capture_stats devuelve también los ids de las captaciones propias de hoy, para que el contador del celular
-- cuente la UNIÓN (servidor ∪ confirmadas en el dispositivo ∪ pendientes) sin repetir ni perder ninguna.
-- Antes se tomaba el máximo, que fallaba cuando el servidor ya contaba captaciones de otro dispositivo.
create or replace function public.my_capture_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ids jsonb;
begin
  if not public.app_is_active() then raise exception 'forbidden'; end if;
  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_ids
  from public.prospects
  where created_by = auth.uid() and status = 'active'
    and (client_created_at at time zone 'America/La_Paz')::date = (now() at time zone 'America/La_Paz')::date;
  return jsonb_build_object('today', jsonb_array_length(v_ids), 'ids', v_ids, 'shift', public.shift_for(now()));
end;
$$;
