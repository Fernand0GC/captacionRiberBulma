-- Interés alto al captar (FR-011d): la captación entra directo como Cliente potencial y con responsable.
-- - Volantero: responsable = encargado de la sucursal (el más antiguo si hay varios; sin encargado queda para Repartir).
-- - Cualquier otro rol (auxiliar, supervisor, encargado, jefe de ventas, gerencia, Sistemas): responsable = quien registra.
-- - Usuario dado de baja que sincroniza tarde: se trata como volantero (no puede quedar de responsable).
-- Sin next_contact_at: aparece en Mis contactos como "toca contactar" desde ya.

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

select pg_temp.patch_function('public.submit_capture(jsonb)',
'  v_product integer := nullif(p ->> ''product_id'', '''')::integer;
begin',
'  v_product integer := nullif(p ->> ''product_id'', '''')::integer;
  v_owner uuid;
begin');

select pg_temp.patch_function('public.submit_capture(jsonb)',
'    insert into public.stage_events (prospect_id, from_stage, to_stage, actor_id)
    values (v_id, null, ''capture'', v_uid);
  end if;',
'    insert into public.stage_events (prospect_id, from_stage, to_stage, actor_id)
    values (v_id, null, ''capture'', v_uid);

    if p ->> ''interest'' = ''high'' then
      if v_prof.role = ''field_volunteer'' or not v_prof.active then
        select u.id into v_owner from public.profiles u
        where u.branch_id = v_branch and u.active and u.role = ''branch_manager''
        order by u.created_at, u.id limit 1;
      else
        v_owner := v_uid;
      end if;

      update public.prospects set stage = ''interested'', stage_changed_at = v_now, assigned_to = v_owner
      where id = v_id;
      insert into public.stage_events (prospect_id, from_stage, to_stage, note, actor_id)
      values (v_id, ''capture'', ''interested'', ''Interés alto al captar'', v_uid);
      if v_owner is not null then
        insert into public.assignment_events (prospect_id, from_user, to_user, actor_id)
        values (v_id, null, v_owner, v_uid);
      end if;
    end if;
  end if;');
