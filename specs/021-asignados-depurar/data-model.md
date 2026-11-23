# Data Model: 021 Depurar «Clientes asignados»

## Tabla nueva `public.assigned_hidden`

| Columna | Tipo | Notas |
|---|---|---|
| `prospect_id` | uuid | FK `prospects(id)` `on delete cascade` (los scripts de limpieza que borran clientes de prueba siguen funcionando) |
| `agent_id` | uuid | FK `profiles(id)`: la persona del modal |
| `hidden_by` | uuid | FK `profiles(id)`: quién ocultó |
| `hidden_at` | timestamptz | `default now()` |

- PK `(prospect_id, agent_id)` → ocultar dos veces no duplica (FR-014).
- Índice `(agent_id)` para `list_agent_assigned`.
- RLS activado, sin políticas; `revoke all` a `anon` y `authenticated`. Acceso solo por RPC.

## Reglas

- Ocultar: `insert … on conflict do nothing`. Mostrar: `delete` de la marca. Nada más cambia.
- Contactado (igual que `list_agent_assigned`): existe un `followup` del agente sobre el cliente con
  `contacted_at >=` su primera asignación al agente dentro del período.
- Permiso: `app_is_active() and is_manager() and manages_branch(prospect.branch_id)` para cada cliente.

## Fila del modal (`AgentAssignedRow`) — campos nuevos

- `hidden: boolean`.

## Respuesta de `list_agent_assigned` — campos nuevos

- `hidden_total: number` — ocultos del período (para «N ocultos»).
- `contacted_visible: number` — contactados no ocultos del período (cantidad del aviso).
