-- Canales de captación en dos grupos, Calle y Tienda, según la lista de estrategias de gerencia (2026-10-31).
-- Los canales que ya existían se RENOMBRAN (las captaciones viejas conservan su canal); E-commerce se desactiva.
-- "Otro" queda sin grupo. Idempotente: sirve en una base nueva y en una existente.

alter table public.channels add column if not exists channel_group text
  check (channel_group in ('street', 'store'));

comment on column public.channels.channel_group is 'street = Calle, store = Tienda; null = sin grupo (Otro)';

update public.channels set name = 'Volanteo por barrios y semáforos' where name = 'Volantes'
  and not exists (select 1 from public.channels where name = 'Volanteo por barrios y semáforos');
update public.channels set name = 'Negociaciones' where name = 'Visitas de negociación'
  and not exists (select 1 from public.channels where name = 'Negociaciones');
update public.channels set name = 'Comentarios Facebook' where name = 'Facebook'
  and not exists (select 1 from public.channels where name = 'Comentarios Facebook');

update public.channels set active = false where name = 'E-commerce';

insert into public.channels (name, channel_group, sort) values
  ('Volanteo por barrios y semáforos', 'street', 1),
  ('Convenios', 'street', 2),
  ('Activación', 'street', 3),
  ('Visitas a colegios', 'street', 4),
  ('Negociaciones', 'street', 5),
  ('Volanteo de fin de semana', 'street', 6),
  ('Freelance', 'street', 7),
  ('Referencia del personal', 'street', 8),
  ('Referencia de clientes', 'street', 9),
  ('Marketplace', 'store', 21),
  ('Messenger', 'store', 22),
  ('TikTok', 'store', 23),
  ('Facebook publicidad', 'store', 24),
  ('Comentarios Facebook', 'store', 25),
  ('Comentarios TikTok', 'store', 26),
  ('Lives', 'store', 27),
  ('Llamadas a clientes del sistema', 'store', 28),
  ('WhatsApp barrios chinos', 'store', 29),
  ('Clientes de consulta', 'store', 30),
  ('Clientes de pedidos', 'store', 31),
  ('Otro', null, 99)
on conflict (name) do update set channel_group = excluded.channel_group, sort = excluded.sort, active = true;
