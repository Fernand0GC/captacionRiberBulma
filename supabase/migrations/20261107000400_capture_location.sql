-- Ubicación del cliente marcada en el mapa al captar (opcional): coordenadas junto a la dirección escrita.
-- Precisión de 6 decimales (~10 cm); las dos van juntas o ninguna.

alter table public.prospects
  add column lat numeric(9, 6) check (lat between -90 and 90),
  add column lng numeric(9, 6) check (lng between -180 and 180),
  add constraint prospects_lat_lng_together check ((lat is null) = (lng is null));

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

-- Los dos INSERT (normal y el de la carrera por teléfono repetido) guardan lat/lng si llegan.
select pg_temp.patch_function('public.submit_capture(jsonb)',
'interest, occupation, address,',
'interest, occupation, address, lat, lng,');
select pg_temp.patch_function('public.submit_capture(jsonb)',
'nullif(trim(p ->> ''address''), ''''),',
'nullif(trim(p ->> ''address''), ''''),
      round(nullif(p ->> ''lat'', '''')::numeric, 6), round(nullif(p ->> ''lng'', '''')::numeric, 6),');

select pg_temp.patch_function('public.get_prospect(uuid)',
'''address'', p.address,',
'''address'', p.address, ''lat'', p.lat, ''lng'', p.lng,');
