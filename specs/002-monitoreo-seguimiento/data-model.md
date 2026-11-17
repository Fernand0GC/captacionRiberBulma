# Data Model: Monitoreo de seguimiento y actividad del personal

**Sin cambios de esquema.** Esta feature solo lee entidades existentes (feature 001) y define proyecciones calculadas.

## Entidades leídas

| Entidad (tabla) | Campos usados |
|-----------------|---------------|
| Cliente (`prospects`) | `id, full_name, branch_id, stage, interest, contact_attempts, next_contact_at, visit_at, assigned_to, created_by, channel_id, lost_reason_id, client_created_at, status` |
| Contacto (`followups`, inmutable) | `id, prospect_id, contacted_at, method, result, effective, note, actor_id` |
| Persona (`profiles`) | `id, full_name, role, branch_id, active` |
| Sucursales del jefe (`profile_branches`) | `profile_id, branch_id` (vía `scoped_branch`) |
| Catálogos | `lost_reasons (id, name)`, `channels (id, name)` |

Enums: `prospect_stage` (`capture, recapture, followup, interested, sale, lost`), `contact_method` (`call, whatsapp_call, message, store`), `contact_result` (`no_answer, looking_product, visit_store, call_later, very_interested, sold, not_interested, wrong_number`), `interest_level` (`high, medium, low`).

Filtro común a todo: `prospects.status = 'active'` (FR-045).

## Proyecciones

### FollowupStatusRow (vista Seguimientos)

| Campo | Origen |
|-------|--------|
| `id`, `full_name` | prospect |
| `branch_name` | branches |
| `assigned_to`, `assigned_to_name` | prospect + profiles (null = "Sin asignar") |
| `stage`, `interest` | prospect |
| `no_answer_streak` | `contact_attempts` |
| `contacts_total` | `count(followups)` |
| `last_contacted_at`, `last_method`, `last_result`, `last_note`, `last_actor_name` | último followup |
| `next_contact_at` | prospect |
| `overdue` | `stage ∉ {sale,lost} ∧ next_contact_at < now()` |
| `days_without_contact` | días La Paz desde `coalesce(last_contacted_at, client_created_at)` |
| `lost_reason` | lost_reasons.name (solo etapa `lost`) |
| `client_created_at`, `channel_name`, `created_by_name` | prospect + joins |

Pestaña → etapas: `sin_contactar`→`{capture}`, `seguimiento`→`{followup, recapture}`, `potencial`→`{interested}`, `venta`→`{sale}`, `sin_interes`→`{lost}`, `todos`→todas.

Validaciones de filtros: `interest ∈ {high, medium, low, none}`; `attempts ∈ {'0','1-2','3+'}`; `stale_days ∈ {3,7,15,30}`; `lost_reason_id` entero; rango de fechas ≤ 366 días (igual que `list_prospects`).

### AgentActivityRow (vista Actividad)

| Campo | Definición (sobre followups del período y del alcance) |
|-------|------|
| `actor_id`, `full_name`, `role`, `active` | profiles |
| `calls` | `method ∈ {call, whatsapp_call}` |
| `messages` | `method = message` |
| `store` | `method = store` |
| `effective` | `effective = true` |
| `no_answer` | `result = no_answer` |
| `visits` | `result = visit_store` |
| `sales` | `result = sold` |
| `clients` | `count(distinct prospect_id)` |
| `total` | `count(*)` |

Invariantes: `calls + messages + store = total`; `effective + no_answer = total`; totales = suma de filas (calculado en el cliente). Inclusión de filas según research R8.

### AgentContactRow (detalle de Actividad)

`followup_id, prospect_id, full_name, contacted_at, method, result, effective, note`. Filtrado por `actor_id` + métrica (`all, calls, messages, store, effective, no_answer, visits, sales`; `clients` usa `all`).

### ContactSummary (ficha del cliente, calculado en el frontend)

Por cada `actor` en `timeline` con `type = 'contact'`: `{ actor, total, calls, messages, store }`, ordenado por `total desc`. Sin contactos = lista vacía (mensaje "Sin contactos todavía").
