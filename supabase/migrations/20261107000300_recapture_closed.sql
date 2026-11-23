-- Recaptar cerrados (2026-11-06): los que no les interesó, no contestaron 3 veces o ya compraron siguen en
-- "Mis contactos" (check "Ver cerrados anteriores") y se les puede registrar un contacto nuevo.
-- Registrar sobre un cerrado abre un ciclo nuevo en la misma ficha: la etapa sale del resultado (sin el
-- "no retroceder"), los intentos empiezan de cero y la historia anterior queda en stage_events.
-- Número equivocado sigue cerrado para siempre.

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

-- true si la ficha está cerrada y se puede volver a contactar.
create function public.can_recapture(p public.prospects) returns boolean
language sql stable security definer set search_path = '' as $$
  select p.status = 'active' and p.stage in ('sale', 'lost')
     and p.lost_reason_id is distinct from (select id from public.lost_reasons where name = 'Número equivocado')
$$;
revoke execute on function public.can_recapture(public.prospects) from public, anon;

select pg_temp.patch_function('public.add_followup(jsonb)',
'  v_reason text;',
'  v_reason text;
  v_reopen boolean;');

select pg_temp.patch_function('public.add_followup(jsonb)',
'  if v_pr.stage in (''sale'', ''lost'') then raise exception ''invalid_transition''; end if;',
'  v_reopen := public.can_recapture(v_pr);
  if v_pr.stage in (''sale'', ''lost'') and not v_reopen then raise exception ''invalid_transition''; end if;');

-- Ciclo nuevo: los intentos sin respuesta empiezan de cero.
select pg_temp.patch_function('public.add_followup(jsonb)',
'      v_attempts := v_pr.contact_attempts + 1;',
'      v_attempts := case when v_reopen then 0 else v_pr.contact_attempts end + 1;');

-- Desde un cerrado la etapa es la del resultado (de Sin interés a Seguimiento sí "retrocede").
select pg_temp.patch_function('public.add_followup(jsonb)',
'    when v_target in (''sale'', ''lost'') then v_target',
'    when v_target in (''sale'', ''lost'') or v_reopen then v_target');

-- El motivo de pérdida es del cierre vigente: al salir de Sin interés se limpia (queda en stage_events).
select pg_temp.patch_function('public.add_followup(jsonb)',
'(select id from public.lost_reasons where name = v_reason) else lost_reason_id end,',
'(select id from public.lost_reasons where name = v_reason) end,');

-- Comprar otra vez (o volver a decir que no) también deja evento: cada venta se cuenta en las métricas.
select pg_temp.patch_function('public.add_followup(jsonb)',
'    stage_changed_at = case when v_stage <> v_pr.stage then now() else stage_changed_at end,',
'    stage_changed_at = case when v_stage <> v_pr.stage or v_reopen then now() else stage_changed_at end,');
select pg_temp.patch_function('public.add_followup(jsonb)',
'  if v_stage <> v_pr.stage then
    insert into public.stage_events',
'  if v_stage <> v_pr.stage or v_reopen then
    insert into public.stage_events');

select pg_temp.patch_function('public.get_prospect(uuid)',
'''can_contact'', v.status = ''active'' and v.stage not in (''sale'', ''lost''),',
'''can_contact'', v.status = ''active'' and v.stage not in (''sale'', ''lost'') or public.can_recapture(v),');

-- Mis cerrados (para el check de Mis contactos): mismas columnas que my_contacts más cómo terminó.
-- contact_attempts va en 0 porque registrar abre un ciclo nuevo.
create function public.my_closed_contacts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.app_is_active() or not public.can_follow_up() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.stage_changed_at desc)
    from (
      select p.id, p.full_name, p.phone_raw, p.phone_norm, p.stage, 0 as contact_attempts, null::timestamptz as next_contact_at,
             null::timestamptz as visit_at, p.client_created_at, p.interest, p.product_id, pr.name as product_name,
             c.name as channel_name, a.full_name as created_by_name,
             (select count(*) from public.followups f where f.prospect_id = p.id) as contacts_count,
             lf.result as last_result, lf.method as last_method, lf.note as last_note, lf.contacted_at as last_contacted_at,
             p.stage_changed_at, p.sold_at, lr.name as lost_reason
      from public.prospects p
      join public.profiles a on a.id = p.created_by
      left join public.products pr on pr.id = p.product_id
      left join public.channels c on c.id = p.channel_id
      left join public.lost_reasons lr on lr.id = p.lost_reason_id
      left join lateral (
        select f.result, f.method, f.note, f.contacted_at from public.followups f
        where f.prospect_id = p.id order by f.contacted_at desc limit 1
      ) lf on true
      where p.assigned_to = auth.uid() and public.can_recapture(p)
      order by p.stage_changed_at desc
      limit 500
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.my_closed_contacts() from public, anon;
grant execute on function public.my_closed_contacts() to authenticated;
