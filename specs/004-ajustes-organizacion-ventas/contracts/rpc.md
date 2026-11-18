# Contratos RPC (004)

Todas `security definer`, `search_path = ''`, `grant execute` solo a `authenticated`. Errores: `forbidden`,
`not_found`, `invalid_input` con `detail` (campo).

## org_list(p_from, p_to, p_branches) — cambia (agrega campos)

Cada fila suma: `share_goal`, `share_result`, `batch_id`, `uses_goal`, `uses_share_goal` (marcas efectivas vigentes).

## org_save(p jsonb) — cambia

Acepta además `share_goal`. Aplica las reglas de metas del [data-model](../data-model.md). Detalles nuevos:
`goal` (falta meta de captación), `share_goal` (falta o fuera de rango).

## org_save_many(p jsonb) → uuid[] — nueva

```json
{ "branch_id": 5, "work_date": "2026-11-19", "shift": "morning", "start_time": "08:30", "end_time": "12:30",
  "profile_id": "…", "strategy_id": 2, "channel_id": 7, "place": "",
  "items": [ { "subchannel_id": 23, "goal": 20, "share_goal": 15 }, { "subchannel_id": 25, "goal": 10, "share_goal": 30 } ] }
```

- Permiso `manages_org(branch_id)`. Valida igual que `org_save` cada ítem.
- `items` vacío o ausente = una asignación sin subcanal con `goal`/`share_goal` del nivel superior del JSON.
- Subcanales repetidos o vacíos en `items`, más de 20 ítems o un `id` → `invalid_input` / `catalog` (o `id`).
- Todo o nada: si un ítem falla no se guarda ninguno. Todas comparten un `batch_id` nuevo (si hay más de una).
- Devuelve los ids creados.

## org_set_result(p_id, p_result, p_notes, p_share_result) — nueva sobrecarga

Igual que la de 3 argumentos y además guarda `share_result` (0–9999 o nulo; fuera de rango → `invalid_input` /
`share_result`). La de 3 argumentos sigue existiendo y no toca `share_result`.

## org_copy_day(p_branch, p_from, p_to) — cambia

Copia también `share_goal` (según marcas vigentes) y da un `batch_id` nuevo por grupo.

## org_add_subchannel(p_branch smallint, p_channel smallint, p_name text) → jsonb — nueva

- Permiso `manages_org(p_branch)`. El canal debe existir y estar activo (`invalid_input` / `catalog`).
- Nombre de 2 a 80 caracteres tras recortar (`invalid_input` / `name`).
- Mismo nombre normalizado en el canal: activo → `{ "id": n, "existed": true }`; desactivado →
  `invalid_input` / `inactive_subchannel`.
- Nuevo → `{ "id": n, "existed": false }` con `uses_goal = true`, `uses_share_goal = false`, sin horario,
  `added_by`, `added_at`.
