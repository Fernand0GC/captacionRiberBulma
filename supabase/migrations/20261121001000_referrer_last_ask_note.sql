-- Seguimiento a referidores (spec 017, ajuste): el último pedido de cada referidor trae también su observación,
-- para mostrar «En qué quedó» en la tabla sin depender del período elegido. Aditivo: solo suma la clave «note».

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

select pg_temp.patch_function(
  'public.referrer_followup(jsonb)',
  $old$'kept', public.referrer_ask_kept(r.id, a.created_at), 'actor_name', ap.full_name)$old$,
  $new$'kept', public.referrer_ask_kept(r.id, a.created_at), 'actor_name', ap.full_name,
                                      'note', a.note)$new$
);
