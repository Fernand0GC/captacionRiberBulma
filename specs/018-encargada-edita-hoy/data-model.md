# Data Model: La encargada edita la planificación de hoy

Sin cambios de esquema. Solo cambia la regla de permisos sobre una entidad existente.

## org_assignments (existente, spec 003)

| Campo relevante | Uso en esta feature |
|---|---|
| `branch_id` | Sucursal: la encargada/supervisor solo actúa sobre la suya (`manages_org`). |
| `work_date` | Fecha de la asignación: decide si se puede replanificar. |

## Matriz de permisos para editar/quitar (después de la 018)

| Rol | Día pasado | Hoy | Futuro |
|---|---|---|---|
| Gerente, Sistemas, Jefe de ventas (sus sucursales) | ✅ | ✅ | ✅ |
| Encargado (su sucursal) | ❌ | ✅ **(nuevo)** | ✅ |
| Supervisor de campo (su sucursal) | ❌ | ✅ **(nuevo)** | ✅ |
| Auxiliar, volantera, Cobros | ❌ | ❌ | ❌ |

Registrar resultado y observaciones: sin cambios (encargado y supervisor, cualquier fecha).
