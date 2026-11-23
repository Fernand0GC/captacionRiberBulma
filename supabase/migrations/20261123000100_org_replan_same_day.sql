-- Spec 018 (2026-11-23): la encargada y el supervisor de campo replanifican hasta el MISMO día de la asignación.
-- Cambia FR-029 de la spec 003: antes solo días posteriores a hoy (`>`); ahora también hoy (`>=`). Los días pasados
-- siguen reservados a gerencia, Sistemas y el jefe de ventas. La usan org_upsert (org_save / org_save_many),
-- org_delete y org_list (campo can_replan, que muestra «Editar» y «✕» en la pantalla).
create or replace function public.org_can_replan(p_branch smallint, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.manages_org(p_branch) and (
    public.app_role() in ('general_manager', 'admin', 'sales_lead')
    or p_day >= (now() at time zone 'America/La_Paz')::date
  )
$$;

revoke execute on function public.org_can_replan(smallint, date) from public, anon;
grant execute on function public.org_can_replan(smallint, date) to authenticated;
