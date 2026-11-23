# Data Model: spec 019

Sin tablas ni columnas nuevas. Cambian datos del catálogo y de asignaciones.

## org_channels (fila nueva o reutilizada)

| Campo | Valor |
|---|---|
| strategy_id | Tienda |
| name | `Acomodo de tienda` |
| sort | `max(sort)` de Tienda + 1 (al final) |
| active | true (se reactiva si existía inactivo) |
| uses_goal / uses_share_goal | OR de las marcas de los subcanales viejos; sin ellos, true / false (research R5) |
| uses_flyers | false |

Sin subcanales: la Planificación no pide subcanal (spec 008 solo lo exige si el canal tiene subcanales activos).

## org_subchannels «Acomodo de tienda» (viejos)

`active: true → false`. No se borran (las asignaciones viejas ya no apuntan a ellos, pero el registro queda con
`added_by`/`added_at` como historia del catálogo).

## org_assignments (filas que usaban un subcanal viejo)

| Campo | Antes | Después |
|---|---|---|
| strategy_id | estrategia del canal padre | Tienda |
| channel_id | canal padre | canal «Acomodo de tienda» |
| subchannel_id | subcanal viejo | null |
| todo lo demás | — | sin cambio (incluye updated_at/updated_by) |

## audit_log

Una fila por asignación movida: `table_name = 'org_assignments'`, `actor_id = null`, `old`/`new` con los tres campos.

## Transiciones

```text
Subcanal «Acomodo de tienda» (activo o no) ──migración──► inactivo, sin asignaciones
Canal «Acomodo de tienda»: inexistente | inactivo | activo ──migración──► activo
```
