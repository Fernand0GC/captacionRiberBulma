-- Referido al registrar (spec 010): quien registra puede escribir quién recomendó al cliente aunque la sucursal no
-- tenga lista. El referidor nuevo viaja dentro de la captación (`referrer_new`) y submit_capture lo busca por nombre
-- normalizado o lo crea en la misma transacción (research R1, R2). Nunca rechaza una captación por el referidor (R4).
-- Todo aditivo: la app publicada no manda referrer_new y sigue funcionando igual (R10).

-- Clave de comparación de nombres: sin espacios de más, sin tildes y en minúsculas (R3). Igual que normalizeText
-- del cliente (por eso ñ → n).
create function public.referrer_key(p text) returns text
language sql immutable strict set search_path = '' as $$
  select lower(translate(regexp_replace(trim(p), '\s+', ' ', 'g'),
    'áéíóúüñàèìòùâêîôûäëïöÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖ',
    'aeiouunaeiouaeiouaeioAEIOUUNAEIOUAEIOUAEIO'))
$$;
revoke execute on function public.referrer_key(text) from public, anon;
grant execute on function public.referrer_key(text) to authenticated;

-- El índice único pasa de lower(name) a referrer_key(name). Si ya hay nombres que chocan con la regla nueva, se
-- detiene con la lista para corregirlos a mano (renombrar uno de cada par) y volver a aplicar.
do $$
declare
  v text;
begin
  select string_agg(format('sucursal %s: %s', d.branch_id, d.names), '; ') into v
  from (
    select r.branch_id, string_agg(format('«%s»', r.name), ' y ' order by r.id) as names
    from public.referrers r
    group by r.branch_id, public.referrer_key(r.name)
    having count(*) > 1
  ) d;
  if v is not null then
    raise exception 'Hay referidores con el mismo nombre (sin tildes ni mayúsculas). Renombra uno de cada par: %', v;
  end if;
end $$;

drop index public.referrers_branch_name_key;
create unique index referrers_branch_key on public.referrers (branch_id, public.referrer_key(name));

-- De dónde salió el referidor: lo cargó un jefe (manager) o nació en un registro (capture) (R8).
alter table public.referrers
  add column source text not null default 'manager' check (source in ('manager', 'capture'));
comment on column public.referrers.source is 'manager = cargado en «Referidores y metas»; capture = escrito al registrar una captación (spec 010).';

-- submit_capture: se ajusta sobre su definición vigente (la base local y producción difieren en otros parches) ----
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

select pg_temp.patch_function('public.submit_capture(jsonb)',
'  v_referrer smallint;',
'  v_referrer smallint;
  v_ref_name text;
  v_ref_kind text;
  v_ref_skipped boolean := false;');

-- Después de resolver referrer_id: si no hubo uno válido y llegó referrer_new, se busca por clave o se crea.
select pg_temp.patch_function('public.submit_capture(jsonb)',
'    and r.id = case when p ->> ''referrer_id'' ~ ''^[0-9]{1,5}$'' then (p ->> ''referrer_id'')::integer end;',
'    and r.id = case when p ->> ''referrer_id'' ~ ''^[0-9]{1,5}$'' then (p ->> ''referrer_id'')::integer end;

  -- Spec 010: referidor escrito al registrar. Nunca rechaza la captación (R4).
  if v_referrer is null and jsonb_typeof(p -> ''referrer_new'') = ''object'' then
    v_ref_name := regexp_replace(trim(coalesce(p #>> ''{referrer_new,name}'', '''')), ''\s+'', '' '', ''g'');
    v_ref_kind := p #>> ''{referrer_new,kind}'';
    if length(v_ref_name) between 2 and 60 then
      select r.id into v_referrer from public.referrers r
      where r.branch_id = v_branch and public.referrer_key(r.name) = public.referrer_key(v_ref_name);
      if v_referrer is null then
        -- Tope por persona y día de La Paz (R5).
        if (select count(*) from public.referrers r
            where r.created_by = v_uid and r.source = ''capture''
              and r.created_at >= ((v_now at time zone ''America/La_Paz'')::date::timestamp at time zone ''America/La_Paz'')) >= 10 then
          v_ref_skipped := true;
        else
          insert into public.referrers (branch_id, name, kind, created_by, source)
          values (v_branch, v_ref_name,
                  case when v_ref_kind in (''staff'', ''freelance'', ''client'', ''other'') then v_ref_kind else ''other'' end,
                  v_uid, ''capture'')
          on conflict (branch_id, public.referrer_key(name)) do nothing
          returning id into v_referrer;
          if v_referrer is null then
            -- Carrera: otro registro lo creó entre el SELECT y el INSERT.
            select r.id into v_referrer from public.referrers r
            where r.branch_id = v_branch and public.referrer_key(r.name) = public.referrer_key(v_ref_name);
          end if;
        end if;
      end if;
    else
      v_ref_skipped := true;
    end if;
  end if;');

select pg_temp.patch_function('public.submit_capture(jsonb)',
'  return jsonb_build_object(''id'', v_id, ''result'', case when v_status = ''active'' then ''accepted'' else ''duplicate'' end);',
'  return jsonb_build_object(''id'', v_id, ''result'', case when v_status = ''active'' then ''accepted'' else ''duplicate'' end)
    || case when v_ref_skipped then jsonb_build_object(''referrer'', ''skipped'') else ''{}''::jsonb end;');
