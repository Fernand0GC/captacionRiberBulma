-- Cuenta única (specs/002-cuenta-unica-portal): CI de la persona, para encontrar su perfil al volver de la cuenta única.
-- Opcional y único; se guarda en mayúsculas (7788990-1B). Lo escribe solo Sistemas por la Edge Function admin-users.
alter table public.profiles
  add column ci text,
  add constraint profiles_ci_key unique (ci),
  add constraint profiles_ci_format check (ci ~ '^[0-9]{4,12}(-[0-9A-Z]{1,4})?$');

comment on column public.profiles.ci is 'CI de la cuenta única (mayúsculas, número-complemento). Null = sin cuenta única.';
