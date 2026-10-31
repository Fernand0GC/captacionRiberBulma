-- Canales de CAPTACIÓN (catálogo real, también en producción). Definidos por el usuario el 2026-10-28:
-- "Llamadas" no es captación sino recaptación (se contacta por llamada en add_followup); "Visitas" pasa a
-- "Visitas de negociación"; se agrega Volantes. (Afiches se probó y el usuario lo quitó el 2026-10-28.) Idempotente: sirve en una base nueva y en una existente.

update public.channels set name = 'Visitas de negociación' where name = 'Visitas'
  and not exists (select 1 from public.channels where name = 'Visitas de negociación');

-- Llamadas: se borra si nadie la usó; si ya tiene captaciones, solo se desactiva (no se borra historia).
delete from public.channels c where c.name = 'Llamadas' and not exists (select 1 from public.prospects p where p.channel_id = c.id);
update public.channels set active = false where name = 'Llamadas';

insert into public.channels (name, sort) values
  ('Volantes', 1), ('Activación', 3), ('Visitas de negociación', 4), ('TikTok', 5),
  ('Facebook', 6), ('Messenger', 7), ('Marketplace', 8), ('E-commerce', 9), ('Otro', 99)
on conflict (name) do update set sort = excluded.sort;
