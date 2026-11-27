-- Spec 033: captación de freelancers como venta directa a cargo de quien registra.
-- Deshacer: con el mismo ayudante temporal, ejecutar estos tres parches inversos.
/*
select pg_temp.patch_function('public.submit_capture(jsonb)',
$old$  -- Spec 033: conservar la etapa y el responsable anteriores en el historial.
  if v_sold and v_status = 'active' then
    insert into public.stage_events (prospect_id, from_stage, to_stage, note, actor_id)
    select v_id, stage, 'sale', 'Venta directa (freelancer)', v_uid
    from public.prospects where id = v_id;

    insert into public.assignment_events (prospect_id, from_user, to_user, actor_id)
    select v_id, assigned_to, v_uid, v_uid
    from public.prospects where id = v_id and assigned_to is distinct from v_uid;

    update public.prospects
    set stage = 'sale', stage_changed_at = v_now, sold_at = v_now, assigned_to = v_uid
    where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'result', case when v_status = 'active' then 'accepted' else 'duplicate' end)$old$,
$new$  return jsonb_build_object('id', v_id, 'result', case when v_status = 'active' then 'accepted' else 'duplicate' end)$new$);

select pg_temp.patch_function('public.submit_capture(jsonb)',
$old$  -- Spec 033: una venta directa exige producto y freelancer resueltos.
  if v_sold then
    if v_product is null then
      raise exception 'invalid_input' using detail = 'product_id';
    end if;
    if v_referrer is null then
      raise exception 'invalid_input' using detail = 'referrer';
    end if;
  end if;

  -- Spec 014: referidor unido → el que quedó.$old$,
$new$  -- Spec 014: referidor unido → el que quedó.$new$);

select pg_temp.patch_function('public.submit_capture(jsonb)',
$old$  v_ref_skipped boolean := false;
  v_sold boolean := coalesce((p ->> 'sold')::boolean, false);  -- spec 033$old$,
$new$  v_ref_skipped boolean := false;$new$);

*/

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
$old$  v_ref_skipped boolean := false;$old$,
$new$  v_ref_skipped boolean := false;
  v_sold boolean := coalesce((p ->> 'sold')::boolean, false);  -- spec 033$new$);

select pg_temp.patch_function('public.submit_capture(jsonb)',
$old$  -- Spec 014: referidor unido → el que quedó.$old$,
$new$  -- Spec 033: una venta directa exige producto y freelancer resueltos.
  if v_sold then
    if v_product is null then
      raise exception 'invalid_input' using detail = 'product_id';
    end if;
    if v_referrer is null then
      raise exception 'invalid_input' using detail = 'referrer';
    end if;
  end if;

  -- Spec 014: referidor unido → el que quedó.$new$);

select pg_temp.patch_function('public.submit_capture(jsonb)',
$old$  return jsonb_build_object('id', v_id, 'result', case when v_status = 'active' then 'accepted' else 'duplicate' end)$old$,
$new$  -- Spec 033: conservar la etapa y el responsable anteriores en el historial.
  if v_sold and v_status = 'active' then
    insert into public.stage_events (prospect_id, from_stage, to_stage, note, actor_id)
    select v_id, stage, 'sale', 'Venta directa (freelancer)', v_uid
    from public.prospects where id = v_id;

    insert into public.assignment_events (prospect_id, from_user, to_user, actor_id)
    select v_id, assigned_to, v_uid, v_uid
    from public.prospects where id = v_id and assigned_to is distinct from v_uid;

    update public.prospects
    set stage = 'sale', stage_changed_at = v_now, sold_at = v_now, assigned_to = v_uid
    where id = v_id;
  end if;

  return jsonb_build_object('id', v_id, 'result', case when v_status = 'active' then 'accepted' else 'duplicate' end)$new$);
