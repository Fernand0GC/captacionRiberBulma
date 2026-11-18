# Contratos RPC: Monitoreo

Comunes a las tres:
- `language plpgsql stable security definer set search_path = ''`; `revoke execute ... from public, anon; grant ... to authenticated`.
- Guardia: `if not public.app_is_active() or not public.is_manager() then raise exception 'forbidden'`.
- Alcance: `v_branch := public.scoped_branch(nullif(f ->> 'branch_id','')::smallint)` (`null` = todas, solo gerente/Sistemas).
- Solo clientes `status = 'active'`. Fechas `from`/`to` en `America/La_Paz`, por defecto hoy, máx. 366 días (`invalid_input` detail `to`).
- Errores: `forbidden`, `invalid_input` (detail = campo), como el resto del proyecto (ver `specs/001-captacion-mvp/contracts/rpc.md`).

## `list_followup_status(f jsonb default '{}', p_limit int default 50, p_offset int default 0) → jsonb`

Vista Seguimientos (FR-010…FR-018).

Filtros `f`:
- `from`, `to`: por `client_created_at` (FR-014).
- `branch_id`, `created_by` (uuid), `channel_id` (int o `'none'`), `assigned` (uuid o `'none'`), `q` (nombre o celular; igual que `list_prospects`).
- `tab`: `sin_contactar | seguimiento | potencial | venta | sin_interes` (ausente = todos).
- `interest`: `high | medium | low | none`.
- `attempts`: `0 | 1-2 | 3+` (sobre `contact_attempts`).
- `overdue`: `true` → solo vencidos.
- `stale_days`: `3 | 7 | 15 | 30` → `days_without_contact > n`.
- `lost_reason_id`: int.

Salida:
```json
{
  "total": 123,
  "by_tab": { "sin_contactar": 10, "seguimiento": 60, "potencial": 20, "venta": 13, "sin_interes": 20, "todos": 123 },
  "rows": [ { "id": "…", "full_name": "…", "phone_raw": "…", "branch_name": "…", "assigned_to": "…|null", "assigned_to_name": "…|null",
              "stage": "followup", "interest": "high|null", "no_answer_streak": 1, "contacts_total": 4,
              "last_contacted_at": "…|null", "last_method": "whatsapp_call|null", "last_result": "call_later|null",
              "last_note": "…|null", "last_actor_name": "…|null", "next_contact_at": "…|null", "overdue": true,
              "days_without_contact": 5, "lost_reason": "…|null", "client_created_at": "…",
              "channel_name": "…|null", "created_by_name": "…" } ]
}
```
- `by_tab` aplica todos los filtros menos `tab`; `total` y `rows` aplican también `tab`. Invariante: suma de pestañas = `todos`.
- Orden: `overdue desc, (next_contact_at si vencido) asc, days_without_contact desc, client_created_at, id` (los vencidos por atraso; el resto por días sin contacto).
- `p_limit` máx. 200.

## `agent_activity(f jsonb default '{}') → jsonb`

Vista Actividad (FR-020…FR-026).

Filtros `f`: `from`, `to` (por `followups.contacted_at`), `branch_id`.

Salida:
```json
{ "rows": [ { "actor_id": "…", "full_name": "…", "role": "field_assistant", "active": true,
              "calls": 5, "messages": 2, "store": 0, "effective": 4, "no_answer": 3,
              "visits": 1, "sales": 1, "clients": 6, "total": 7 } ] }
```
- Contactos: `followups` del período cuyo cliente está en el alcance (sucursal del cliente) y vigente.
- Filas: auxiliares y supervisores activos de las sucursales del alcance (aunque en cero) ∪ actores con ≥ 1 contacto.
- Orden por defecto: `total desc, full_name`. El orden por columna y la fila de totales los hace el cliente.

## `list_agent_contacts(f jsonb, p_limit int default 50, p_offset int default 0) → jsonb`

Detalle al tocar (FR-025).

Filtros `f`: `from`, `to`, `branch_id` (como `agent_activity`), `actor_id` (**obligatorio**, uuid; si falta → `invalid_input` detail `actor_id`), `metric`: `all | calls | messages | store | effective | no_answer | visits | sales` (por defecto `all`).

Salida:
```json
{ "total": 3, "rows": [ { "followup_id": "…", "prospect_id": "…", "full_name": "…", "contacted_at": "…",
                          "method": "whatsapp_call", "result": "visit_store", "effective": true, "note": "…|null" } ] }
```
- Orden: `contacted_at desc, followup_id`. `p_limit` máx. 200.
- Invariante: `total` = el número de la celda tocada en `agent_activity` con los mismos filtros.

## Sin cambios

`get_prospect` (el resumen por persona se calcula en el cliente con su `timeline`), `list_prospects`, `dashboard_metrics`.
