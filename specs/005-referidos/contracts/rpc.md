# Contratos RPC (005)

`security definer`, `search_path = ''`, `grant execute` solo a `authenticated`. Errores: `forbidden`, `not_found`,
`invalid_input` con `detail`.

## submit_capture(p jsonb) — cambia

Acepta `referrer_id` (opcional). Si existe y es de la sucursal del registro, se guarda; si no, se guarda nulo sin
error (research R3). Se guarda también cuando el registro queda como duplicado.

## update_prospect(p_id, patch jsonb) — cambia

Acepta `referrer_id` (nulo para quitarlo). Debe ser un referidor de la sucursal del contacto, activo o el que ya
tenía (`invalid_input` / `referrer_id`). Permiso sin cambios (`manages_branch`).

## get_prospect(p_id) — cambia

Devuelve además `referrer_id` y `referrer` (nombre).

## referrer_save(p jsonb) → smallint — nueva

`{ id?, branch_id, name, kind, sort, active }`. Permiso `can_see_referrals(branch_id)`. Crear o editar (no se
cambia de sucursal). Nombre repetido en la sucursal → `invalid_input` / `name_taken`.

## referral_goals_save(p jsonb) → void — nueva

`{ branch_id, month: "2026-11-01", referrers: [{ id, goal }] }`. Permiso
`can_see_referrals(branch_id)`. Hace upsert de la meta del mes; `goal` nulo borra la fila de ese mes (vuelve a
arrastrar la anterior).

## referral_report(p_branch smallint, p_month date) → jsonb — nueva

Permiso `can_see_referrals(p_branch)`; si no, `forbidden`. `p_month` cualquier día del mes.

```json
{
  "branch": "GUAYARAMERÍN", "month": "2026-11-01", "days": 30,
  "referrers": [
    { "id": 3, "name": "Contacto Fernanda", "kind": "staff", "active": true, "sort": 0,
      "goal": 20, "goal_from": "2026-10-01",
      "arrived": 10, "uncontacted": 4, "in_followup": 4, "sold": 1, "lost": 1,
      "by_day": { "4": { "arrived": 1, "sold": 0 }, "12": { "arrived": 0, "sold": 1 } } }
  ],
  "contacts": [
    { "id": "…", "referrer_id": 3, "full_name": "…", "phone": "…", "product": "Refrigerador",
      "assigned_to": "…", "stage": "sale",
      "arrived_at": "2026-11-04T10:12:00-04:00", "sold_at": "2026-11-12T…" }
  ]
}
```

`goal_from` = mes de la fila de meta usada (si es anterior al mes del reporte, la meta es arrastrada; null = sin meta).
`sold_at` = primer evento de venta del contacto. Reglas de cálculo en [research.md](../research.md) R4–R6. Solo cuentan fichas activas (sin duplicados ni anuladas). Los referidores sin llegados en el mes aparecen igual si
están activos (con ceros), para ver la meta sin avance.
