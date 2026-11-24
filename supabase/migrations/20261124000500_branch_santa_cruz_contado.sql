-- Sucursal Santa Cruz Contado (ventas al contado en la ciudad de Santa Cruz), separada de SANTA CRUZ (10, crédito).
-- branches.id no es autoincremental: en producción la 11 ya es SANTA ROSA (cargada a mano), por eso va la 12.
-- Idempotente: si ya existe con este código no hace nada; si la 12 la ocupa otra sucursal, se detiene con error
-- en vez de seguir en silencio.
-- Deshacer (solo si nadie la usó todavía): delete from public.branches where id = 12 and code = 'SANTACRUZCONTADO';
do $$
declare
  v_code text;
begin
  select code into v_code from public.branches where id = 12;
  if v_code is not null and v_code <> 'SANTACRUZCONTADO' then
    raise exception 'branch id 12 is already used by %', v_code;
  end if;

  insert into public.branches (id, code, name)
  values (12, 'SANTACRUZCONTADO', 'SANTA CRUZ CONTADO')
  on conflict (code) do nothing;
end $$;
