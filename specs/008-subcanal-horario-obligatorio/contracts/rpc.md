# Contratos RPC (008)

## Cambian
- **org_upsert** (vía `org_save` / `org_save_many`): `start_time` o `end_time` vacíos → `invalid_input`/`time`.
  `subchannel_id` vacío cuando el canal tiene al menos un subcanal activo → `invalid_input`/`subchannel`.
  Sin otros cambios. `org_set_result`, `org_copy_day` y `org_copy_day_v2` no cambian.
