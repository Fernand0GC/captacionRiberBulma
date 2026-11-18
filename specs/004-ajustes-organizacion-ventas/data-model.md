# Data Model: Ajustes de la organización comercial (004)

Cambios sobre las tablas de la 003. Migración: `supabase/migrations/20261118000100_org_goals_multi.sql`.

## org_channels (cambia)

| Campo | Tipo | Regla |
|---|---|---|
| uses_goal | boolean not null | Ya existe. Meta de captación para asignaciones sin subcanal y valor inicial de subcanales nuevos |
| **uses_share_goal** | boolean not null default false | Meta de compartidas, mismo uso |

## org_subchannels (cambia)

| Campo | Tipo | Regla |
|---|---|---|
| **uses_goal** | boolean not null | Inicial: el `uses_goal` de su canal |
| **uses_share_goal** | boolean not null default false | |
| **added_by** | uuid → profiles, nulo | Quién lo agregó desde el formulario. Nulo = catálogo de Sistemas |
| **added_at** | timestamptz, nulo | |

Catálogo inicial (FR-005), aplicado por la migración:

| Subcanal | Captación | Compartidas |
|---|---|---|
| Barrios chinos – grupos, Mensajería WhatsApp | sí | sí |
| Compartidas y estados (y su canal) | no | sí |
| Mensajería Facebook página, Marketplace, TikTok; Comentarios Facebook, TikTok | no | no |
| Tareas administrativas (canal) | no | no |
| El resto | igual que su canal (sí) | no |

## org_assignments (cambia)

| Campo | Tipo | Regla |
|---|---|---|
| goal / result | smallint 0–9999 | Pasan a ser **captación**. Sin cambio de datos |
| **share_goal** | smallint 0–9999, nulo | Meta de compartidas |
| **share_result** | smallint 0–9999, nulo | Resultado de compartidas. Nulo = sin resultado |
| **batch_id** | uuid, nulo | Igual en las asignaciones creadas en una misma carga múltiple |

Reglas al guardar (crear o editar):

- Marca efectiva = la del subcanal si la asignación tiene subcanal; si no, la del canal.
- Si la marca efectiva no usa una meta, esa meta se guarda vacía aunque llegue.
- Si la marca efectiva usa una meta y llega vacía → `invalid_input` (`goal` o `share_goal`).

## Funciones de apoyo

- `org_norm(text) → text`: minúsculas, sin tildes (`translate`), espacios colapsados y recortados. Para comparar nombres.
- `org_goal_flags(p_channel, p_sub) → (uses_goal, uses_share_goal)`: marca efectiva.
