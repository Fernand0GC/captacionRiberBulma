-- Spec 022: «Mis contactos» necesita saber cuándo se le asignó cada cliente a quien consulta, para marcar como
-- «Atrasado · asignado hace N días» lo que no contactó de días anteriores y agrupar por día de asignación.
-- my_contacts suma assigned_at = último evento de asignación hacia quien consulta (aunque lo haya tomado él mismo);
-- sin evento (datos viejos), la fecha de captación. Si el cliente vino de otra persona (el encargado se lo pasó porque
-- la anterior no lo llamó), suma reassigned_from_name y, si nunca fue contactado, waiting_since = su primera asignación:
-- para quien lo recibe es trabajo de hoy, pero sabe que el cliente ya esperaba. Parchea la versión vigente (20261121000800_referral_batch.sql)
-- sin reescribirla: si el texto esperado no está, falla y no cambia nada. Si ya está aplicada, no hace nada.
-- Contrato: specs/022-mis-contactos-atrasados/contracts/rpc.md

create or replace function pg_temp.patch_function(p_sig text, p_old text, p_new text) returns void language plpgsql as $$
declare
  d text := pg_get_functiondef(p_sig::regprocedure);
begin
  if position(p_old in d) = 0 then
    raise exception 'patch_function: no se encontró el texto en %: %', p_sig, p_old;
  end if;
  execute replace(d, p_old, p_new);
end;
$$;

do $do$
begin
  if position('waiting_since' in pg_get_functiondef('public.my_contacts()'::regprocedure)) > 0 then
    raise notice 'my_contacts ya tiene los campos de la 022: no se cambia';
    return;
  end if;
perform pg_temp.patch_function('public.my_contacts()',
  'asg.full_name as assigned_by_name,',
  'asg.full_name as assigned_by_name, coalesce(ae.created_at, p.client_created_at) as assigned_at,
             fu.full_name as reassigned_from_name,
             case when not exists (select 1 from public.followups f0 where f0.prospect_id = p.id)
                  then coalesce(fa.first_at, p.client_created_at) end as waiting_since,');
perform pg_temp.patch_function('public.my_contacts()',
  ') asg on true',
  ') asg on true
      left join lateral (
        select e.created_at, e.from_user from public.assignment_events e
        where e.prospect_id = p.id and e.to_user = auth.uid()
        order by e.created_at desc limit 1
      ) ae on true
      left join public.profiles fu on fu.id = ae.from_user and ae.from_user <> auth.uid()
      left join lateral (
        select min(e.created_at) as first_at from public.assignment_events e where e.prospect_id = p.id
      ) fa on true');
end;
$do$;
