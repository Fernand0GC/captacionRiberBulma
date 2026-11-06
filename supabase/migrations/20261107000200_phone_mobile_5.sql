-- Bolivia ya asigna celulares que empiezan con 5 (además de 6 y 7).
-- Solo amplía la regla: todo número que ya era válido lo sigue siendo.
create or replace function public.is_valid_phone(p text) returns boolean
language sql immutable set search_path = '' as $$
  select public.normalize_phone(p) ~ '^([567][0-9]{7}|[234][0-9]{6,7})$'
$$;
