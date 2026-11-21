-- Seguimientos accionable (spec 015): filtro por producto y más contexto por fila en list_followup_status.
-- Todo aditivo: sin `f.product_id` responde igual que antes y los campos nuevos los ignora la app anterior.
-- Contrato: specs/015-seguimientos-accionable/contracts/rpc.md

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

-- Filtro: en el CTE `scope`, así cuenta para el total, las pestañas y las filas.
select pg_temp.patch_function('public.list_followup_status(jsonb, integer, integer)',
'  v_referrer text := nullif(f ->> ''referrer'', '''');',
'  v_referrer text := nullif(f ->> ''referrer'', '''');
  v_product integer := nullif(f ->> ''product_id'', '''')::integer;');
select pg_temp.patch_function('public.list_followup_status(jsonb, integer, integer)',
'      and (v_reason is null or p.lost_reason_id = v_reason)',
'      and (v_reason is null or p.lost_reason_id = v_reason)
      and (v_product is null or p.product_id = v_product)');

-- Campos nuevos por fila: producto, detalle del canal y cargo de quien registró.
select pg_temp.patch_function('public.list_followup_status(jsonb, integer, integer)',
'           rf.name as referrer_name',
'           rf.name as referrer_name, b.channel_detail, pr.name as product_name, au.role as created_by_role');
select pg_temp.patch_function('public.list_followup_status(jsonb, integer, integer)',
'    left join public.referrers rf on rf.id = b.referrer_id',
'    left join public.referrers rf on rf.id = b.referrer_id
    left join public.products pr on pr.id = b.product_id');
