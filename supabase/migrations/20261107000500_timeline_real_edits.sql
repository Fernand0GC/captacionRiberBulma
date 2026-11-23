-- Historial de la ficha (2026-11-06): "Datos editados" solo muestra lo que se corrige a mano (editar cliente).
-- El trigger de auditoría también guarda lo que cambian registrar contacto, reasignar o anular (etapa, próximo
-- contacto, intentos, responsable…); eso ya tiene su propia línea en el historial y salía repetido con nombres
-- técnicos. No se toca audit_log: se filtra al leer, así se limpian también los registros anteriores.

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

select pg_temp.patch_function('public.get_prospect(uuid)',
'jsonb_build_object(''old'', l.old, ''new'', l.new)',
'jsonb_build_object(''old'', e.old, ''new'', e.new)');

select pg_temp.patch_function('public.get_prospect(uuid)',
'where l.table_name = ''prospects'' and l.row_id = p_id',
'cross join lateral (
          select jsonb_object_agg(k, l.old -> k) as old, jsonb_object_agg(k, l.new -> k) as new
          from jsonb_object_keys(l.new) k
          where k in (''full_name'', ''phone_raw'', ''product_id'', ''channel_id'', ''channel_detail'', ''interest'', ''occupation'', ''address'')
        ) e
        where l.table_name = ''prospects'' and l.row_id = p_id and e.new is not null');
