# Data Model: Recontacto visible (023)

Sin tablas ni columnas nuevas. Todo sale de lo que ya existe.

## Fuentes (existentes)

| Tabla | Campos que se usan |
|---|---|
| `prospects` | `id, full_name, phone_raw, phone_norm, stage, status, branch_id, assigned_to, contact_attempts, next_contact_at, visit_at, client_created_at, stage_changed_at` |
| `followups` | `id, prospect_id, actor_id, contacted_at, method, result, note` |
| `assignment_events` | `prospect_id, to_user, from_user, created_at` |
| `profiles` | `id, full_name, role, branch_id, active` |

## Fila de agenda (calculada, `recontact_agenda`)

Mismos campos que lee `dueStatus` (ver `FollowupRow` de `src/features/followup/api.ts`) más el responsable:

| Campo | Origen |
|---|---|
| `id, full_name, phone_raw, stage, contact_attempts, next_contact_at, visit_at, client_created_at` | `prospects` |
| `assigned_to` | `prospects.assigned_to` |
| `branch_id` | `prospects.branch_id` |
| `assigned_at` | último `assignment_events` hacia `assigned_to`; si no hay, `client_created_at` (igual que `my_contacts`) |
| `last_contacted_at, last_result, last_method, last_note` | último `followups` del cliente (de cualquier persona) |
| `reassigned_from_name` | quien lo tenía antes (si vino de otra persona), solo para mostrar |

Clasificación en la app (R2): `cardOf(dueStatus(fila, ahora))` → `today` (Pendientes) · `done` (Contactó) · `late`
(Atrasados) · `null` (no cuenta).

## Persona de agenda

`{ id, full_name, role, branch_id }`: personal fijo activo del alcance más cualquier responsable de una fila.

Totales por persona: `pending`, `done`, `late`, `due = pending + done`.

## Contacto en Actividad (calculado)

`recontact` = existe un `followups` del mismo `prospect_id` con `(contacted_at, id)` menor. `first_contacts` = contactos
sin `recontact`; `recontacts` = con `recontact`. Invariante: `first_contacts + recontacts = total`.

## Fecha contada en Seguimientos

| `date_basis` | Fecha a la que se aplica el período |
|---|---|
| `registered` (defecto) | `prospects.client_created_at` |
| `assigned` | último `assignment_events.created_at` con `to_user = prospects.assigned_to` |
| `last_contact` | último `followups.contacted_at` del cliente |
| `next_contact` | `prospects.next_contact_at` |
