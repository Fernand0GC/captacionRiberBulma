# Contract: RPC (Postgres functions vía PostgREST `/rest/v1/rpc/<name>`)

Todas son `security definer`, con `search_path=''`. Validan rol, sucursal y `app_is_active()` dentro de la función
y devuelven errores con un `code` estable (para que la UI muestre el mensaje correcto).
Las lecturas del módulo de gestión van por las vistas o tablas con RLS, no por RPC.

## Errores comunes
| code | Significado |
|---|---|
| `forbidden` | Rol o sucursal sin permiso, o usuario inactivo |
| `invalid_input` | Validación (`details.field` indica cuál) |
| `invalid_phone` | Teléfono no válido según R10 |
| `invalid_transition` | Cambio de etapa no permitido |
| `not_found` | No existe o no es visible para el usuario |
| `rate_limited` | Límite de `phone_available` |

---

## `submit_capture(p jsonb) → jsonb`
Crea una captación. **Idempotente por `p.id`**: si el id ya existe, devuelve el mismo resultado sin crear nada.

Entrada:
```json
{
  "id": "0192f5c4-…",            // UUID v7 del cliente, obligatorio
  "full_name": "Juan Pérez",
  "phone": "+591 7123-4567",
  "product_id": 12,               // opcional (categoría)
  "channel_id": 3,                // canal de la jornada (opcional si no se eligió)
  "interest": "high",             // opcional
  "occupation": "Albañil",        // opcional
  "address": "Barrio Litoral…",   // opcional
  "branch_id": 5,                 // solo gestión; el campo usa la sucursal del perfil
  "client_created_at": "2026-10-28T09:14:03-04:00"
}
```
Salida:
```json
{ "id": "…", "result": "accepted" }
{ "id": "…", "result": "duplicate" }     // se guardó con status='duplicate_rejected'
```
Reglas:
- Usuario inactivo: se acepta solo si `client_created_at <= deactivated_at` **y** `now() <= deactivated_at + 7 días`; se guarda con `late_after_deactivation = true`. Fuera de la ventana: `forbidden`.
- Límite: 120 llamadas por minuto por usuario (`rate_limited`); el outbox lo trata como error transitorio, con backoff.
- Usuario de campo: `branch_id` del perfil (se ignora el que mande); `created_by = auth.uid()`.
- Encargado: `branch_id` debe ser el suyo. Gerente o admin: obligatorio.
- `phone_norm` duplicado con un prospecto `active`: se inserta con `status='duplicate_rejected'` y `duplicate_of`, y devuelve `duplicate`. **Nunca** devuelve datos del prospecto existente.
- Obligatorios: `id`, `full_name`, `phone`. Si llegan `product_id`, `channel_id` o `interest`, se validan (activos / valor válido).
- Inserta el evento `null → capture` en `stage_events`. Calcula `shift`. Ajusta `client_created_at` (R9).

## `phone_available(phone text) → boolean`
`true` si no hay un prospecto `active` con ese `phone_norm`. Exige un usuario activo. Límite: 60 llamadas por minuto por usuario (`rate_limited`). Si el teléfono no es válido devuelve `invalid_phone`.

## `my_capture_stats() → jsonb`
`{ "today": 12, "shift": "morning" }`: captaciones `active` del usuario hoy (fecha en La Paz según `client_created_at`). No devuelve filas.

## `my_rejections(since timestamptz) → jsonb[]`
Para el aviso al autor (FR-017): `[{ "id": "…", "phone_masked": "7123••67", "at": "…" }]`. Solo devuelve sus propias captaciones con `duplicate_rejected`, y el teléfono enmascarado.

## `list_prospects(f jsonb, p_limit int = 50, p_offset int = 0) → jsonb` *(panel de solo lectura)*
Encargado (su sucursal; otra → `forbidden`), gerente y admin (todas, o `f.branch_id`). Por POST: la búsqueda nunca viaja en una URL.
Filtros `f`: `from`, `to` (fechas de La Paz, por defecto hoy; máximo 366 días), `branch_id`, `created_by`, `channel_id`, `q` (nombre o celular en cualquier formato).
Excluye anuladas y duplicados rechazados. Salida: `{ total, rows: [{ id, full_name, phone_raw, interest, occupation, address, client_created_at, shift, stage, late_after_deactivation, branch_id, branch_name, created_by, created_by_name, created_by_role, channel_name, product_name, product_group }] }`, ordenado del más reciente al más antiguo; `p_limit` máximo 200.

## `staff_options() → jsonb`
Personal para el filtro "registrado por": encargado = su sucursal; gerente y admin = todos (incluye dados de baja). `[{ id, full_name, role, branch_id, active }]`.

## `change_stage(prospect_id uuid, to_stage prospect_stage, lost_reason_id smallint default null, note text default null) → jsonb`
Valida la transición (data-model §Máquina de estados), el permiso (responsable asignado o gestor del alcance), el motivo obligatorio para `lost` y que exista `product_id` para `sale` (parámetro opcional `product_id` para completarlo en el mismo paso).
Actualiza `prospects.stage`, `stage_changed_at` y `sold_at`, e inserta en `stage_events` en una sola transacción. Devuelve `{ stage, stage_changed_at }`.

## `add_followup(p jsonb) → jsonb`
Entrada: `{ id, prospect_id, contacted_at, channel_id, result, effective, note, next_action, next_contact_at }`. Idempotente por `id`.
Permiso: el responsable asignado o un gestor del alcance. Si el prospecto está en `capture`, pasa automáticamente a `followup` (con su evento).

## `assign_prospect(prospect_id uuid, to_user uuid | null) → void`
Encargado (su sucursal), gerente o admin. `to_user` debe ser un usuario activo con `can_follow_up()` de la sucursal del prospecto. Inserta en `assignment_events`.

## `assign_prospects_bulk(prospect_ids uuid[], to_user uuid) → int`
Igual que `assign_prospect`, para varios prospectos a la vez. Devuelve cuántos asignó.

## `update_prospect(prospect_id uuid, patch jsonb) → void`
Gestores del alcance. Campos editables: `full_name`, `phone`, `product_id`, `channel_id`, `interest`, `occupation`, `address`.
Si cambia el teléfono, vuelve a validar que sea único (`invalid_input` con `details.field='phone'`, `reason='duplicate'`). La auditoría la hace el trigger.

## `void_prospect(prospect_id uuid, reason text) → void`
Solo admin. `reason` obligatorio (mínimo 5 caracteres).

## `copy_agenda(branch_id smallint, from_date date, to_date date, shift shift default null) → int`
Encargado (su sucursal) o admin. Copia las actividades con `status='pending'` y sin resultado. Devuelve cuántas creó.

## Edge Function `admin-users` (HTTP, solo admin)
`POST /functions/v1/admin-users` con `{ action: "create" | "update" | "deactivate" | "reactivate" | "reset_password", … }`.
- `create`: `{ username, full_name, role, branch_id, contract_type, password }`. Crea el usuario en Auth con el email sintético y su perfil.
- `deactivate`: `active=false`, `deactivated_at=now()` (sin ban de Auth, ver research R9).
- Verifica que quien llama sea admin con su JWT y `profiles`, y usa la service role solo dentro de la función.
