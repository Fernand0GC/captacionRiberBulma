-- "Hacer seguimiento" (Captaciones): registrar un seguimiento a una captación sin responsable hace responsable
-- a quien lo registra. Gerencia también tiene "Mis contactos" para atender lo que tomó.

create function pg_temp.patch_function(p_sig text, p_old text, p_new text) returns void language plpgsql as $$
declare
  d text := pg_get_functiondef(p_sig::regprocedure);
begin
  if position(p_old in d) = 0 then
    raise exception 'patch_function: no se encontró el texto en %: %', p_sig, p_old;
  end if;
  execute replace(d, p_old, p_new);
end;
$$;

select pg_temp.patch_function('public.add_followup(jsonb)',
'  if v_pr.stage in (''sale'', ''lost'') then raise exception ''invalid_transition''; end if;',
'  if v_pr.stage in (''sale'', ''lost'') then raise exception ''invalid_transition''; end if;
  if v_pr.assigned_to is null then
    update public.prospects set assigned_to = auth.uid() where id = v_pr.id;
    insert into public.assignment_events (prospect_id, from_user, to_user, actor_id) values (v_pr.id, null, auth.uid(), auth.uid());
  end if;');

create or replace function public.can_follow_up() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_role() in ('field_assistant', 'field_supervisor', 'branch_manager', 'sales_lead', 'general_manager', 'admin'), false)
$$;
