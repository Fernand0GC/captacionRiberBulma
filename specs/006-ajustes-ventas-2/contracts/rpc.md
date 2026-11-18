# Contratos RPC (006)

`security definer`, `search_path = ''`, solo `authenticated`. Errores `forbidden`, `not_found`, `invalid_input`/`detail`.

## Cambian
- **org_list**: orden `work_date, branch, person, shift, start_time`; por fila agrega `flyer_ids`, `flyers` ([{id, name}]), `uses_flyers`, `share_verified`, `share_verified_note`, `share_verified_by_name`, `share_verified_at`.
- **org_save / org_save_many**: aceptan `notes` (≤ 300; en edición, ausente = se conserva) y `flyer_ids` (uuid[]; `invalid_input`/`flyers` si alguno no es volantera activa de la sucursal, salvo las que ya tenía en edición). En carga múltiple, `notes` y `flyer_ids` van a todas.
- **org_copy_day**: copia `flyer_ids` (solo volanteras aún activas de la sucursal) y `notes` no (sigue sin observaciones).
- **org_add_subchannel**: marcas de meta del canal.
- **org_staff**: sin cambio (ya trae `role`).

## Nuevas
- **org_share_list(p_from date, p_to date, p_branches smallint[] default null) → jsonb**: rango ≤ 31 días; sucursales permitidas por `can_verify_shares`. Devuelve `{ branches: [{id, name}], rows: [...] }` (branches = sucursales que puede verificar; vacío = Cobros sin sucursales). Filas con `share_goal` o `share_result` no nulos: id, branch, work_date, shift, start/end, person, channel, subchannel, share_goal, share_result, share_verified, share_verified_note, verificado por, fecha.
- **org_verify_shares(p_id uuid, p_verified integer, p_note text) → void**: `can_verify_shares(branch)`; 0–9999 o nulo (`invalid_input`/`share_verified`); nota ≤ 300 (`notes`). Guarda autor y fecha (nulo borra la verificación).
- **admin_set_collections(p_profile uuid, p_branches smallint[]) → void**: solo admin; ≥ 1 sucursal existente; pone `role = 'collections'`, `branch_id = null` y reemplaza `profile_branches`.
