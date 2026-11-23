# Data Model: 022

No hay tablas nuevas ni columnas nuevas. Todo se deriva de datos existentes.

## Fila de `my_contacts` (campo nuevo)

| Campo | Tipo | Origen | Nota |
|---|---|---|---|
| `assigned_at` | timestamptz (ISO en JSON) | último `assignment_events.created_at` con `to_user = auth.uid()` para el cliente; si no hay, `prospects.client_created_at` | nunca null |
| `reassigned_from_name` | text \| null | `profiles.full_name` de `from_user` de ese mismo evento, si no es null ni quien consulta | null si fue la primera asignación |
| `waiting_since` | timestamptz \| null | primer `assignment_events.created_at` del cliente (cualquier destinatario); sin eventos, `client_created_at` | null si el cliente tiene algún contacto |

Se conservan todos los campos de la versión de la 016: `id, full_name, phone_raw, phone_norm, stage, contact_attempts,
next_contact_at, visit_at, client_created_at, interest, product_id, product_name, channel_name, created_by_name,
referrer_name, assigned_by_name, contacts_count, last_result, last_method, last_note, last_contacted_at`.

En TypeScript: `assigned_at?: string`, `reassigned_from_name?: string | null`, `waiting_since?: string | null` (opcionales: faltan si el servidor no tiene la 022).

## Estado derivado (solo en la app, no se guarda)

`dueStatus(row, now)` — se agrega una regla en la rama «nunca contactado, sin nada agendado»:

| Condición | kind | Etiqueta |
|---|---|---|
| sin `assigned_at` o asignado hoy (La Paz) | `now` | Nuevo · contactar hoy |
| asignado hace N ≥ 1 días (La Paz) | `late` | Atrasado · asignado hace N días («hace 1 día») |

## Vista (solo en la app)

- **Tarjeta del resumen** `SummaryCard = 'today' | 'late' | 'done'`: `today` ← kind `now|soon`; `late` ← `late`; `done` ← `done`; `normal` no entra en ninguna.
- **Grupo de día** `{ day: 'YYYY-MM-DD', label: 'Hoy' | 'Ayer' | '<Lun..Dom> <d>', late: boolean, rows }`, orden `day` desc.
- **Contador de pestaña** `{ total: number, due: number | 'all' | null }`.
