-- Unir referidores repetidos (spec 014, US7) y filtro «Referido por» en Captaciones y Seguimientos (US6).
-- Todo aditivo: la app publicada no manda `referrer` en los filtros ni llama a referrer_merge (FR-018).
-- Contrato: specs/014-referidos-mejoras/contracts/rpc.md

-- Referidor unido -----------------------------------------------------------------------------------------
alter table public.referrers add column merged_into smallint references public.referrers (id);
alter table public.referrers add constraint referrers_merged_not_self check (merged_into is null or merged_into <> id);
comment on column public.referrers.merged_into is
  'Unido a otro referidor de la sucursal (spec 014). Queda desactivado; su nombre sigue en el historial y, si se vuelve a escribir al registrar, se usa el destino.';

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

-- submit_capture: un referidor unido (por id, por nombre o creado en carrera) se guarda como su destino (FR-016).
select pg_temp.patch_function('public.submit_capture(jsonb)',
'  v_norm := public.normalize_phone(v_phone);',
'  -- Spec 014: referidor unido → el que quedó.
  if v_referrer is not null then
    select coalesce(r.merged_into, r.id) into v_referrer from public.referrers r where r.id = v_referrer;
  end if;

  v_norm := public.normalize_phone(v_phone);');

-- referrer_save: un unido no se edita ni se reactiva.
select pg_temp.patch_function('public.referrer_save(jsonb)',
'    if not found then raise exception ''not_found''; end if;',
'    if not found then raise exception ''not_found''; end if;
    if v_old.merged_into is not null then raise exception ''invalid_input'' using detail = ''merged''; end if;');

-- referrer_merge ------------------------------------------------------------------------------------------
create function public.referrer_merge(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_from public.referrers;
  v_into public.referrers;
  v_from_id smallint := case when p ->> 'from_id' ~ '^[0-9]{1,5}$' then (p ->> 'from_id')::smallint end;
  v_into_id smallint := case when p ->> 'into_id' ~ '^[0-9]{1,5}$' then (p ->> 'into_id')::smallint end;
begin
  if v_from_id is null then raise exception 'invalid_input' using detail = 'from_id'; end if;
  if v_into_id is null or v_into_id = v_from_id then raise exception 'invalid_input' using detail = 'into_id'; end if;
  -- Candado en orden de id: dos uniones cruzadas al mismo tiempo no se bloquean entre sí.
  perform 1 from public.referrers where id in (v_from_id, v_into_id) order by id for update;
  select * into v_from from public.referrers where id = v_from_id;
  if not found then raise exception 'not_found'; end if;
  select * into v_into from public.referrers where id = v_into_id;
  if not found then raise exception 'not_found'; end if;
  if not public.can_see_referrals(v_from.branch_id) then raise exception 'forbidden'; end if;
  if v_into.branch_id <> v_from.branch_id or v_into.merged_into is not null then
    raise exception 'invalid_input' using detail = 'into_id';
  end if;
  if v_from.merged_into is not null then raise exception 'invalid_input' using detail = 'from_id'; end if;

  -- Clientes: el trigger de auditoría deja «Referido por» viejo → nuevo en cada ficha.
  update public.prospects set referrer_id = v_into_id where referrer_id = v_from_id;

  -- Metas: solo a los meses en que el destino no tenía meta propia.
  insert into public.referrer_goals (referrer_id, month, goal)
  select v_into_id, g.month, g.goal from public.referrer_goals g where g.referrer_id = v_from_id
  on conflict (referrer_id, month) do nothing;
  delete from public.referrer_goals where referrer_id = v_from_id;

  -- Lo que estaba unido al origen pasa al destino (cadena de un solo salto).
  update public.referrers set merged_into = v_into_id where merged_into = v_from_id;
  update public.referrers set active = false, merged_into = v_into_id where id = v_from_id;
end;
$$;

revoke execute on function public.referrer_merge(jsonb) from public, anon;
grant execute on function public.referrer_merge(jsonb) to authenticated;

-- Filtro «Referido por» -----------------------------------------------------------------------------------
-- f.referrer = 'any' (solo referidos) o el id de un referidor. Sin él, ambas funciones responden como antes.
select pg_temp.patch_function('public.list_prospects(jsonb, integer, integer)',
'  v_product integer := nullif(f ->> ''product_id'', '''')::integer;',
'  v_product integer := nullif(f ->> ''product_id'', '''')::integer;
  v_referrer text := nullif(f ->> ''referrer'', '''');');
select pg_temp.patch_function('public.list_prospects(jsonb, integer, integer)',
'      and (v_product is null or p.product_id = v_product)',
'      and (v_product is null or p.product_id = v_product)
      and (v_referrer is null or (v_referrer = ''any'' and p.referrer_id is not null)
           or (v_referrer ~ ''^[0-9]{1,5}$'' and p.referrer_id = v_referrer::integer))');
select pg_temp.patch_function('public.list_prospects(jsonb, integer, integer)',
'           p.assigned_to, s.full_name as assigned_to_name, p.contact_attempts, p.visit_at',
'           p.assigned_to, s.full_name as assigned_to_name, p.contact_attempts, p.visit_at,
           p.referrer_id, rf.name as referrer_name');
select pg_temp.patch_function('public.list_prospects(jsonb, integer, integer)',
'    left join public.profiles s on s.id = p.assigned_to
    order by',
'    left join public.profiles s on s.id = p.assigned_to
    left join public.referrers rf on rf.id = p.referrer_id
    order by');

select pg_temp.patch_function('public.list_followup_status(jsonb, integer, integer)',
'  v_reason smallint := nullif(f ->> ''lost_reason_id'', '''')::smallint;',
'  v_reason smallint := nullif(f ->> ''lost_reason_id'', '''')::smallint;
  v_referrer text := nullif(f ->> ''referrer'', '''');');
select pg_temp.patch_function('public.list_followup_status(jsonb, integer, integer)',
'      and (v_reason is null or p.lost_reason_id = v_reason)',
'      and (v_reason is null or p.lost_reason_id = v_reason)
      and (v_referrer is null or (v_referrer = ''any'' and p.referrer_id is not null)
           or (v_referrer ~ ''^[0-9]{1,5}$'' and p.referrer_id = v_referrer::integer))');
select pg_temp.patch_function('public.list_followup_status(jsonb, integer, integer)',
'           lr.name as lost_reason, b.client_created_at, ch.name as channel_name, au.full_name as created_by_name',
'           lr.name as lost_reason, b.client_created_at, ch.name as channel_name, au.full_name as created_by_name,
           rf.name as referrer_name');
select pg_temp.patch_function('public.list_followup_status(jsonb, integer, integer)',
'    left join public.lost_reasons lr on lr.id = b.lost_reason_id
    order by',
'    left join public.lost_reasons lr on lr.id = b.lost_reason_id
    left join public.referrers rf on rf.id = b.referrer_id
    order by');
