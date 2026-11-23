# Data Model: 020

Sin tablas nuevas ni cambios de esquema. Solo cambia la forma de una respuesta de lectura.

## Fila de `list_agent_assigned` (cliente asignado)

Campos existentes (spec 012) sin cambios, más:

| Campo | Tipo | Origen | Para qué |
|---|---|---|---|
| `phone_raw` | text | `prospects.phone_raw` | Mostrar el celular bajo el nombre |
| `phone_norm` | text | `prospects.phone_norm` | Buscar por dígitos |
| `branch_id` | smallint | `prospects.branch_id` | Opciones de «Asignar a…» de la sucursal del cliente |

## Derivados en el cliente (puros, `src/features/monitoring/assigned.ts`)

- `AssignedFilter.q: string` — texto de la lupa (solo en memoria, nunca en la URL).
- `reassignable(rows)` — filas con `contacts === 0 && !reassigned`.
- `singleBranch(rows)` — sucursal común de esas filas o `undefined`.

## Asignación (sin cambios)

`assign_prospects` actualiza `prospects.assigned_to` y agrega un `assignment_events` (de, a, quién, cuándo).
`agent_activity` / `list_agent_assigned` calculan «Asignados» de la persona original desde `assignment_events`, por eso
reasignar no cambia sus números del período (FR-011); la fila pasa a `reassigned = true` con `reassigned_to`.
