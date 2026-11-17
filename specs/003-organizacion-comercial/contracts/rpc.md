# Contract: RPC de la organización comercial

Funciones de Postgres por PostgREST (`/rest/v1/rpc/<name>`). Todas son `security definer` con `search_path = ''`,
validan rol, sucursal y `app_is_active()` dentro de la función, y solo `authenticated` puede ejecutarlas.

## Errores

| code | Significado |
|---|---|
| `forbidden` | Rol o sucursal sin permiso, usuario inactivo, o cambio bloqueado por fecha (FR-029) |
| `invalid_input` | Validación; `detail` indica el campo (`profile`, `catalog`, `time`, `goal`, `result`, `notes`, `range`, `day`) |
| `not_found` | La asignación no existe |

## `org_list(p_from date, p_to date, p_branches smallint[]) → jsonb`

Devuelve las asignaciones del rango. `p_branches` vacío o null = todas las que el usuario puede ver.
El rango no puede pasar de 31 días (`invalid_input`, `range`).

Qué devuelve según el rol:

| Rol | Filas |
|---|---|
| Gerente general, Sistemas | Todas las sucursales pedidas |
| Jefe de ventas | Solo sus sucursales; pedir una ajena da `forbidden` |
| Encargado, supervisor | Solo su sucursal; pedir otra da `forbidden` |
| Auxiliar | Solo las filas donde él es la persona asignada |
| Volantera | `forbidden` |

Salida:

```json
{
  "can_manage": true,
  "rows": [
    {
      "id": "…", "branch_id": 5, "branch": "VERDOLAGO", "work_date": "2026-11-18", "shift": "morning",
      "start_time": "10:00", "end_time": "12:00",
      "profile_id": "…", "person": "Guillermo Aguirre Caya",
      "strategy_id": 1, "strategy": "Calle", "channel_id": 2, "channel": "Activación",
      "subchannel_id": 7, "subchannel": "Activaciones en barrios",
      "place": "Barrio Litoral", "goal": 30, "result": 15, "notes": "5 ventas concretadas",
      "lead_id": "…", "lead": "Jessica Margareth Cortez Sandoval",
      "can_replan": false, "can_set_result": true
    }
  ]
}
```

- `can_manage`: el usuario puede crear asignaciones en al menos una sucursal de las devueltas.
- `can_replan` y `can_set_result`: permisos sobre esa fila, para que la pantalla muestre u oculte acciones. La base los vuelve a verificar al guardar.
- Orden: `work_date`, `branch`, `shift`, `start_time`, `person`.

## `org_save(p jsonb) → uuid`

Crea (sin `id`) o edita (con `id`) una asignación. Devuelve su id.

```json
{
  "id": null, "branch_id": 5, "work_date": "2026-11-18", "shift": "morning",
  "start_time": "10:00", "end_time": "12:00", "profile_id": "…",
  "strategy_id": 1, "channel_id": 2, "subchannel_id": 7,
  "place": "Barrio Litoral", "goal": 30
}
```

Reglas:

- Crear exige `manages_org(branch)`. Cualquier día, incluido hoy.
- Editar exige `org_can_replan(branch, work_date)`; si no, `forbidden`.
- Obligatorios: `branch_id`, `work_date`, `shift`, `profile_id`, `strategy_id`, `channel_id`.
- `profile_id` debe ser un usuario activo de esa sucursal (`invalid_input`, `profile`). Al editar sin cambiar la persona no se vuelve a exigir que siga activa.
- Estrategia, canal y subcanal deben pertenecer uno al otro y estar activos (`invalid_input`, `catalog`).
- Con las dos horas, fin > inicio (`invalid_input`, `time`).
- `goal` de 0 a 9999 o vacío (`invalid_input`, `goal`).
- Si la estrategia no usa ubicación (`uses_place = false`) se guarda `place` vacío; si el canal no lleva meta (`uses_goal = false`), `goal` vacío. No es error (FR-030). `org_copy_day` aplica la misma regla.
- Al crear se guarda `lead_id = branch_lead(branch_id)`. Al editar no cambia.
- No acepta `result` ni `notes`; eso va por `org_set_result`.

## `org_set_result(p_id uuid, p_result smallint, p_notes text) → void`

Registra o corrige resultado y observaciones. Exige `manages_org` de la sucursal de la fila; no depende de la fecha.
`p_result` null = volver a «sin resultado». `p_result` de 0 a 9999; `p_notes` hasta 300 caracteres.

## `org_delete(p_id uuid) → void`

Elimina una asignación. Exige `org_can_replan`. Antes de borrar inserta la fila completa en `audit_log`
(`table_name = 'org_assignments'`, `old` = la fila, `new` = null).

## `org_copy_day(p_branch smallint, p_from date, p_to date) → integer`

Copia las asignaciones de un día a otro de la misma sucursal, sin `result` ni `notes`, y recalcula `lead_id`.
Devuelve cuántas copió. Exige `manages_org(p_branch)`. `p_from = p_to` da `invalid_input` (`day`).
No copia las asignaciones de personas que ya no están activas.

## `org_staff(p_branch smallint) → jsonb`

Lista de personal para el selector de persona: usuarios activos cuya sucursal es `p_branch`, ordenados por nombre.
Exige `manages_org(p_branch)`.

```json
[{ "id": "…", "full_name": "Guillermo Aguirre Caya", "role": "field_assistant" }]
```

## Catálogo

Lectura directa por PostgREST con RLS (cualquier usuario activo): `org_strategies`, `org_channels`, `org_subchannels`.
Escritura directa solo para Sistemas (política RLS), igual que `channels`. No hay borrado: se desactiva con `active = false`.

## Funciones que se retiran

Se quita el permiso de ejecutar `save_activity`, `set_activity_result`, `delete_activity` y `copy_agenda`.
`agenda_day` sigue disponible y devuelve `can_edit = false`.
