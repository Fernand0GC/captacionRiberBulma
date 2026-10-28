-- Seed SOLO para desarrollo local (`supabase db reset`). Nunca se aplica en producción.
-- Usuarios de prueba: contraseña común `Captacion.2026` (solo local).
-- Login con el usuario (sin dominio); la app lo mapea a <usuario>@captacion.riberbulma.local.

insert into public.branches (id, code, name) values
  (1, 'RURRE', 'RURRE'),
  (2, 'COBIJA', 'COBIJA'),
  (3, 'REYES', 'REYES'),
  (4, 'GUAYARAMERIN', 'GUAYARAMERÍN'),
  (5, 'VERDOLAGO', 'VERDOLAGO'),
  (6, 'SANJOSE', 'SAN JOSÉ'),
  (7, 'TRINIDAD', 'TRINIDAD'),
  (8, 'SANIGNACIO', 'SAN IGNACIO'),
  (9, 'SANBORJA', 'SAN BORJA'),
  (10, 'SANTACRUZ', 'SANTA CRUZ');

insert into public.channels (name, sort) values
  ('TikTok', 1), ('Facebook', 2), ('Activación', 3), ('Llamadas', 4), ('Marketplace', 5),
  ('E-commerce', 6), ('Visitas', 7), ('Messenger', 8), ('Otro', 99);

-- Productos: los carga la migración 20261028000250_product_catalog.sql (catálogo real de riber-bulma).

insert into public.lost_reasons (name) values
  ('Precio'), ('Ya compró en otro lado'), ('No lo necesita'), ('Sin capacidad de pago'), ('Otro');

insert into public.agenda_strategies (name) values
  ('Marketing'), ('Mensajería'), ('Negociación'), ('Activación'), ('Llamadas'),
  ('Atención en tienda'), ('Contenido'), ('En vivo'), ('Kardex'), ('Otra');

-- Usuarios de prueba (auth.users + auth.identities + profiles).
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'admin',          'Admin Prueba',         'admin'::public.app_role,            null::smallint, 'permanent'::public.contract_type),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'gerente',        'Gerente Prueba',       'general_manager'::public.app_role,  null::smallint, 'permanent'::public.contract_type),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'enc.verdolago',  'Encargado Verdolago',  'branch_manager'::public.app_role,   5::smallint,    'permanent'::public.contract_type),
      ('00000000-0000-4000-8000-000000000004'::uuid, 'aux.verdolago',  'Auxiliar Verdolago',   'field_assistant'::public.app_role,  5::smallint,    'permanent'::public.contract_type),
      ('00000000-0000-4000-8000-000000000005'::uuid, 'sup.verdolago',  'Supervisor Verdolago', 'field_supervisor'::public.app_role, 5::smallint,    'permanent'::public.contract_type),
      ('00000000-0000-4000-8000-000000000006'::uuid, 'vol.verdolago',  'Volantera Verdolago',  'field_volunteer'::public.app_role,  5::smallint,    'temporary'::public.contract_type),
      ('00000000-0000-4000-8000-000000000007'::uuid, 'enc.trinidad',   'Encargado Trinidad',   'branch_manager'::public.app_role,   7::smallint,    'permanent'::public.contract_type),
      ('00000000-0000-4000-8000-000000000008'::uuid, 'vol.trinidad',   'Volantera Trinidad',   'field_volunteer'::public.app_role,  7::smallint,    'temporary'::public.contract_type)
    ) as t(id, username, full_name, role, branch_id, contract_type)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
      u.username || '@captacion.riberbulma.local', extensions.crypt('Captacion.2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.username || '@captacion.riberbulma.local', 'email_verified', true),
      'email', now(), now(), now()
    );
    insert into public.profiles (id, username, full_name, role, branch_id, contract_type)
    values (u.id, u.username, u.full_name, u.role, u.branch_id, u.contract_type);
  end loop;
end $$;
