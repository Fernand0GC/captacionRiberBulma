-- Canales definitivos de gerencia (2026-11-03) + descripción del canal en cada captación.
--   Calle:  Volanteo, Convenio, Activación, Negociación, Freelance, Visita
--   Tienda: Marketplace, Messenger, TikTok, Facebook, WhatsApp, Clientes del sistema, Tienda
-- Los canales equivalentes se RENOMBRAN (las captaciones conservan su canal); los que salen se desactivan, no se borran.
-- La descripción ("dónde / qué": colegio, universidad, barrio, publicación…) se guarda en prospects.channel_detail.

-- 1) Catálogo ------------------------------------------------------------------------------------
create function pg_temp.rename_channel(p_old text, p_new text) returns void language sql as $$
  update public.channels set name = p_new
  where name = p_old and not exists (select 1 from public.channels where name = p_new);
$$;

select pg_temp.rename_channel('Volanteo por barrios y semáforos', 'Volanteo');
select pg_temp.rename_channel('Convenios', 'Convenio');
select pg_temp.rename_channel('Negociaciones', 'Negociación');
select pg_temp.rename_channel('Visitas a colegios', 'Visita');
select pg_temp.rename_channel('Comentarios Facebook', 'Facebook');
select pg_temp.rename_channel('WhatsApp barrios chinos', 'WhatsApp');
select pg_temp.rename_channel('Llamadas a clientes del sistema', 'Clientes del sistema');
select pg_temp.rename_channel('Clientes de consulta', 'Tienda');

update public.channels set active = false
where name in ('Volanteo de fin de semana', 'Referencia del personal', 'Referencia de clientes', 'Facebook publicidad',
               'Comentarios TikTok', 'Lives', 'Clientes de pedidos', 'Otro', 'E-commerce');

insert into public.channels (name, channel_group, sort) values
  ('Volanteo', 'street', 1), ('Convenio', 'street', 2), ('Activación', 'street', 3),
  ('Negociación', 'street', 4), ('Freelance', 'street', 5), ('Visita', 'street', 6),
  ('Marketplace', 'store', 21), ('Messenger', 'store', 22), ('TikTok', 'store', 23), ('Facebook', 'store', 24),
  ('WhatsApp', 'store', 25), ('Clientes del sistema', 'store', 26), ('Tienda', 'store', 27)
on conflict (name) do update set channel_group = excluded.channel_group, sort = excluded.sort, active = true;

-- 2) Descripción del canal en la captación -------------------------------------------------------
alter table public.prospects add column if not exists channel_detail text
  check (channel_detail is null or length(channel_detail) <= 120);

comment on column public.prospects.channel_detail is 'Dónde o qué dentro del canal (colegio, universidad, barrio, publicación…)';

-- 3) RPCs: se ajustan sobre su definición actual (sin recopiar cuerpos largos). Cada reemplazo debe aplicar;
--    si un texto no se encuentra, la migración falla en vez de dejar la función a medias.
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

-- submit_capture: acepta la descripción; y un canal ya DESACTIVADO también se acepta (captaciones hechas sin señal
-- antes del cambio de catálogo no deben rechazarse: el canal sigue existiendo).
select pg_temp.patch_function('public.submit_capture(jsonb)',
  'where x.id = (p ->> ''channel_id'')::smallint and x.active)',
  'where x.id = (p ->> ''channel_id'')::smallint)');
select pg_temp.patch_function('public.submit_capture(jsonb)',
  'product_id, channel_id, interest,',
  'product_id, channel_id, channel_detail, interest,');
select pg_temp.patch_function('public.submit_capture(jsonb)',
  'v_product, nullif(p ->> ''channel_id'', '''')::smallint,',
  'v_product, nullif(p ->> ''channel_id'', '''')::smallint, left(nullif(trim(p ->> ''channel_detail''), ''''), 120),');

-- list_prospects: devuelve la descripción y el buscador también la encuentra (ej.: "UAB").
select pg_temp.patch_function('public.list_prospects(jsonb, integer, integer)',
  'c.name as channel_name,',
  'c.name as channel_name, p.channel_detail,');
select pg_temp.patch_function('public.list_prospects(jsonb, integer, integer)',
  'or (v_qdigits is not null and p.phone_norm like',
  'or p.channel_detail ilike ''%'' || v_q || ''%''
           or (v_qdigits is not null and p.phone_norm like');

-- get_prospect: ficha y línea de tiempo con la descripción.
select pg_temp.patch_function('public.get_prospect(uuid)',
  '''channel_name'', c.name,',
  '''channel_name'', c.name, ''channel_detail'', p.channel_detail,');
select pg_temp.patch_function('public.get_prospect(uuid)',
  'jsonb_build_object(''channel'', c.name) as data',
  'jsonb_build_object(''channel'', c.name, ''detail'', p.channel_detail) as data');

-- update_prospect: el encargado puede corregir la descripción; un canal desactivado que ya tenía se puede conservar.
select pg_temp.patch_function('public.update_prospect(uuid, jsonb)',
  'where id = (patch ->> ''channel_id'')::smallint and active)',
  'where id = (patch ->> ''channel_id'')::smallint and (active or id = v.channel_id))');
select pg_temp.patch_function('public.update_prospect(uuid, jsonb)',
  'interest = case when patch ? ''interest''',
  'channel_detail = case when patch ? ''channel_detail'' then left(nullif(trim(patch ->> ''channel_detail''), ''''), 120) else channel_detail end,
    interest = case when patch ? ''interest''');

-- 4) Las correcciones de la descripción quedan en la auditoría de la ficha, como las del canal.
drop trigger if exists prospects_audit on public.prospects;
create trigger prospects_audit after update of full_name, phone_raw, product_id, channel_id, channel_detail, interest, occupation, address, status
  on public.prospects for each row execute function public.audit_row();
