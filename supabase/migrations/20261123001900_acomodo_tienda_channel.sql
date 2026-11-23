-- «Acomodo de tienda» pasa a ser canal de Tienda (spec 019, 2026-11-23).
-- En producción nació como subcanal con «+ Agregar otro…» (spec 004), no sabemos bajo qué canal. Esta migración:
--  · crea (o reutiliza / reactiva) el canal Tienda → «Acomodo de tienda», sin subcanales;
--  · mueve al canal todas las asignaciones de cualquier subcanal con ese nombre normalizado: cambian solo
--    estrategia, canal y subcanal (queda vacío); metas, resultados, verificación de Cobros y autores no se tocan;
--  · desactiva (no borra) los subcanales viejos. El trigger de auditoría guarda el valor anterior de cada fila.
-- Idempotente y sin error donde el subcanal no existe (local, pruebas). Diagnóstico previo (solo lectura):
-- specs/019-acomodo-tienda-canal/diagnostico-produccion.sql. Diseño: specs/019-acomodo-tienda-canal/.
-- La función queda en la base, sin permiso para la app, para que pgTAP pruebe el movimiento con datos de prueba.

create function public.org_subchannel_to_channel(p_name text, p_strategy text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_strategy smallint;
  v_subs smallint[];
  v_goal boolean;
  v_share boolean;
  v_pending int;
  v_pending_goal boolean;
  v_pending_share boolean;
  v_channel public.org_channels;
  v_created boolean := false;
  v_reactivated boolean := false;
  v_moved int;
  v_deactivated int;
begin
  if length(v_name) not between 2 and 60 then raise exception 'invalid_input' using detail = 'name'; end if;
  select s.id into v_strategy from public.org_strategies s where public.org_norm(s.name) = public.org_norm(p_strategy);
  if v_strategy is null then raise exception 'invalid_input' using detail = 'strategy'; end if;

  -- Que nadie guarde una asignación en el subcanal viejo mientras se mueve (las lecturas siguen).
  lock table public.org_assignments in share row exclusive mode;

  -- Subcanales con ese nombre, en cualquier canal y estrategia, activos o no; y sus marcas de meta combinadas.
  select coalesce(array_agg(sc.id order by sc.id), '{}'), bool_or(sc.uses_goal), bool_or(sc.uses_share_goal)
    into v_subs, v_goal, v_share
  from public.org_subchannels sc where public.org_norm(sc.name) = public.org_norm(v_name);

  select count(*) into v_pending from public.org_assignments a where a.subchannel_id = any (v_subs);
  -- Marcas de los subcanales que todavía tienen asignaciones por mover (las que importan al reutilizar el canal).
  select bool_or(sc.uses_goal), bool_or(sc.uses_share_goal) into v_pending_goal, v_pending_share
  from public.org_subchannels sc
  where sc.id = any (v_subs) and exists (select 1 from public.org_assignments a where a.subchannel_id = sc.id);

  select * into v_channel from public.org_channels c
  where c.strategy_id = v_strategy and public.org_norm(c.name) = public.org_norm(v_name)
  order by c.active desc, c.id limit 1;

  if not found then
    insert into public.org_channels (strategy_id, name, sort, uses_goal, uses_share_goal, uses_flyers)
    values (v_strategy, v_name,
      coalesce((select max(c.sort) from public.org_channels c where c.strategy_id = v_strategy), 0) + 1,
      coalesce(v_goal, true), coalesce(v_share, false), false)
    returning * into v_channel;
    v_created := true;
  else
    if not v_channel.active then
      update public.org_channels c set active = true where c.id = v_channel.id;
      v_reactivated := true;
    end if;
    -- Solo si hay filas que mover: el canal suma las metas que ellas usaban (sin filas, se respeta Catálogo).
    if v_pending > 0 then
      update public.org_channels c set
        uses_goal = c.uses_goal or coalesce(v_pending_goal, false),
        uses_share_goal = c.uses_share_goal or coalesce(v_pending_share, false)
      where c.id = v_channel.id;
    end if;
  end if;

  update public.org_assignments a
  set strategy_id = v_strategy, channel_id = v_channel.id, subchannel_id = null
  where a.subchannel_id = any (v_subs);
  get diagnostics v_moved = row_count;

  update public.org_subchannels sc set active = false where sc.id = any (v_subs) and sc.active;
  get diagnostics v_deactivated = row_count;

  return jsonb_build_object('channel_id', v_channel.id, 'created', v_created, 'reactivated', v_reactivated,
    'subchannels', to_jsonb(v_subs), 'moved', v_moved, 'deactivated', v_deactivated);
end;
$$;

revoke execute on function public.org_subchannel_to_channel(text, text) from public, anon, authenticated;

comment on function public.org_subchannel_to_channel(text, text) is
  'Spec 019: convierte un subcanal hecho a mano en canal de la estrategia, moviendo sus asignaciones. Idempotente. Solo migraciones/tests.';

select public.org_subchannel_to_channel('Acomodo de tienda', 'Tienda');
