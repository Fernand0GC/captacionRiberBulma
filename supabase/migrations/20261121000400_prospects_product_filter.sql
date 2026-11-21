-- Captaciones: filtro por producto (filtros en los títulos de la tabla, fase 2).
-- `f.product_id` es opcional: sin él, list_prospects responde igual que antes (compatible con la app anterior).
-- Se parchea el texto vigente de la función para no repetirla entera; si el texto no está, la migración falla.

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

select pg_temp.patch_function('public.list_prospects(jsonb, integer, integer)',
'  v_stage text := nullif(f ->> ''stage'', '''');',
'  v_stage text := nullif(f ->> ''stage'', '''');
  v_product integer := nullif(f ->> ''product_id'', '''')::integer;');

select pg_temp.patch_function('public.list_prospects(jsonb, integer, integer)',
'      and (v_stage is null or p.stage::text = v_stage)',
'      and (v_stage is null or p.stage::text = v_stage)
      and (v_product is null or p.product_id = v_product)');
