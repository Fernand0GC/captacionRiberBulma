# Data Model: Seguimiento de referidos (005)

Migración: `supabase/migrations/20261118001000_referrals.sql`.

## referrers (nueva)

| Campo | Tipo | Regla |
|---|---|---|
| id | smallint identity PK | |
| branch_id | smallint → branches, not null | |
| name | text not null | 2–60 caracteres; único por sucursal sin distinguir mayúsculas (`unique (branch_id, lower(name))`) |
| kind | text not null | `staff` (Personal), `freelance`, `client` (Cliente), `channel` (Canal o app), `other` (Otro) |
| sort | smallint not null default 0 | |
| active | boolean not null default true | Nunca se borra; se desactiva |
| created_by / created_at | uuid / timestamptz | |

RLS: `select` para usuarios activos; sin escritura directa (solo RPC).

## referrer_goals (nueva)

`referrer_id` → referrers, `month` date (día 1), `goal` smallint 0–9999. PK `(referrer_id, month)`.

RLS: sin acceso directo (solo RPC).

## prospects (cambia)

| Campo | Tipo | Regla |
|---|---|---|
| **referrer_id** | smallint → referrers, nulo | Se guarda también en registros `duplicate_rejected`. Índice `(referrer_id, client_created_at)` |

Disparador `prospects_audit`: agrega `referrer_id` a las columnas auditadas.

## Funciones

- `can_see_referrals(p_branch smallint) → boolean` (research R7).
- `referral_month_goal(p_referrer, p_month)`: meta vigente (fila del mes o la anterior más cercana).
