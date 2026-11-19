# Contratos RPC (007)

`security definer`, `search_path = ''`, solo `authenticated`. Errores `forbidden`, `not_found`, `invalid_input`/`detail`.

## Cambian
- **org_upsert** (vía `org_save` / `org_save_many`): `share_goal` vacío ya no da `invalid_input`/`share_goal` cuando el subcanal usa compartidas; se guarda `null`. Rango 0–9999 sin cambio. `goal` sin cambio.
- **org_copy_day(p_branch smallint, p_from date, p_to date) → integer**: misma firma; ahora delega en `org_copy_day_v2` y devuelve `copied`.

## Nuevas
- **org_copy_day_v2(p_branch smallint, p_from date, p_to date) → jsonb**: `{ "copied": int, "skipped": int }`. Mismos permisos y validaciones que `org_copy_day` (`manages_org`, días distintos). Toma `pg_advisory_xact_lock` por (sucursal, `p_to`). Copia las filas de `p_from` (personas activas de la sucursal; volanteras activas; metas según marcas; sin observaciones; nuevo `batch_id` por carga) que no tengan una igual en `p_to` (sucursal, día, persona, turno, inicio, fin, canal, subcanal). `skipped` = filas del origen no copiadas por existir.
