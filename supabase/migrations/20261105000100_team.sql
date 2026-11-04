-- Mi equipo: el encargado (y el jefe de ventas en sus sucursales) gestiona a sus volanteras.
-- Las altas, bajas y claves pasan por la Edge Function admin-users (acciones team_*); aquí solo la lectura.

-- Volanteras de una sucursal con su actividad: hoy, total y última captación (para el aviso de inactividad).
-- Alcance igual que el resto de la gestión: encargado la suya, jefe una de las suyas, gerencia/Sistemas la pedida.
create function public.team_members(p_branch smallint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/La_Paz';
  v_branch smallint;
begin
  if not public.is_manager() or not public.app_is_active() then raise exception 'forbidden'; end if;
  v_branch := public.scoped_branch(p_branch);
  if v_branch is null then raise exception 'invalid_input' using detail = 'branch_id'; end if;

  return coalesce((
    select jsonb_agg(m order by m.active desc, m.full_name)
    from (
      select p.id, p.username, p.full_name, p.active, p.created_at, p.deactivated_at,
             count(x.id) filter (where (x.client_created_at at time zone tz)::date = (now() at time zone tz)::date)::int as today,
             count(x.id)::int as total,
             max(x.client_created_at) as last_capture_at
      from public.profiles p
      left join public.prospects x on x.created_by = p.id and x.status <> 'duplicate_rejected'
      where p.role = 'field_volunteer' and p.branch_id = v_branch
      group by p.id
    ) m
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.team_members(smallint) from public, anon;
grant execute on function public.team_members(smallint) to authenticated;
