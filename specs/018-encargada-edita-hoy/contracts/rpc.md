# Contrato RPC: La encargada edita la planificación de hoy

Cambia el comportamiento, no la firma, de estas funciones. El contrato completo sigue en
`specs/003-organizacion-comercial/contracts/rpc.md`.

## `org_can_replan(p_branch smallint, p_day date) → boolean`

`true` si el usuario gestiona la sucursal (`manages_org`) **y** (es gerente / Sistemas / jefe de ventas **o**
`p_day >= hoy en America/La_Paz`).

Antes: `p_day > hoy`.

## Efectos en las funciones que la usan

| Función | Antes (encargado/supervisor, día = hoy) | Después |
|---|---|---|
| `org_save` (editar existente) | `forbidden` | OK |
| `org_delete(id)` | `forbidden` | OK |
| `org_list` → `rows[].can_replan` | `false` | `true` |

| Función | Encargado/supervisor, día < hoy |
|---|---|
| `org_save` (editar) | `forbidden` (sin cambio) |
| `org_delete` | `forbidden` (sin cambio) |
| `org_list` → `can_replan` | `false` (sin cambio) |
| `org_set_result` | OK (sin cambio) |
