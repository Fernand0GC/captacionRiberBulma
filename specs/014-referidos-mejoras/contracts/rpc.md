# Contratos RPC — spec 014

Todas `security definer`, `search_path = ''`, solo `authenticated`. Errores: `forbidden`, `invalid_input` (detail = campo), `not_found`.

## referral_report_range(p jsonb) → jsonb

Entrada: `{ "branch_id"?: number, "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "lists"?: boolean }`

- `branch_id` nulo = todas las del alcance: gerencia/Sistemas todas; jefe de ventas las suyas (`profile_branches`).
  Con `branch_id`: `can_see_referrals(branch_id)` o `forbidden`.
- `to < from` o más de 366 días → `invalid_input/to`.
- `lists: false` → solo `totals` y `by_branch` (para la comparación con el período anterior).

Salida:

```jsonc
{
  "branch_id": 5 | null, "branch": "VERDOLAGO" | null,
  "from": "2026-11-01", "to": "2026-11-21", "days": 21,
  "goal_prorated": false,           // true si alguna meta se prorrateó
  "totals": { "arrived", "uncontacted", "in_followup", "sold", "lost", "goal": number|null, "captures": n },
  "by_branch": [ { "id", "name", "referrers": n_activos, "arrived", ..., "goal", "captures" } ],
  "referrers": [ {                 // solo con branch_id; [] con varias sucursales
    "id", "name", "kind", "active", "sort", "source",
    "goal": number|null,           // meta del rango (1 decimal si se prorrateó)
    "arrived", "uncontacted", "in_followup", "sold", "lost",
    "by_day": { "2026-11-04": { "arrived": 1, "sold": 0 } }
  } ],
  "contacts": [ {
    "id", "branch_id", "branch_name", "referrer_id", "referrer_name", "full_name", "phone", "product",
    "assigned_to", "registered_by", "stage", "arrived_at", "sold_at", "last_contact_at", "days_waiting"
  } ],
  "registrars": [ { "id", "name", "role", "branch_name", "captures", "referred" } ]
}
```

Reglas: cohorte por `client_created_at` (La Paz) en [from, to], `status = 'active'`. Grupo de cada contacto: compró
(tiene `stage_event` a `sale`) o su etapa actual (spec 005 R5). Filas de referidores: activos (no unidos) o con
contactos en el rango. `days_waiting` = días desde la llegada, solo si no compró y la etapa es `capture`.

Meta por referidor y mes tocado `m` (con `referral_month_goal`): completa si `from ≤ inicio(m)` y
`to ≥ least(fin(m), hoy)`; si no, `meta × días_en_rango(m) ÷ días(m)`. Suma redondeada a 1 decimal; nula si ningún
mes tiene meta.

## referrer_merge(p jsonb) → void

Entrada: `{ "from_id": n, "into_id": n }`. Misma sucursal, distintos, ninguno unido antes, `can_see_referrals`.
Efecto: `prospects.referrer_id` from → into (el trigger de auditoría deja el cambio en cada ficha); metas de `from` se
copian a los meses sin meta de `into` y se borran; `from.active = false`, `from.merged_into = into`.
Errores: `invalid_input/into_id` (mismo, otra sucursal, unido), `not_found`, `forbidden`.

## Cambios a funciones existentes (aditivos)

- `referrers.merged_into smallint null` (nuevo). `referrer_save` rechaza editar un unido (`invalid_input/merged`).
- `submit_capture`: tras resolver el referidor (por id o por nombre), si está unido usa `merged_into`.
- `list_prospects(f)`: `f.referrer` = `"any"` (solo referidos) o id; filas suman `referrer_id`, `referrer_name`.
- `list_followup_status(f)`: `f.referrer` igual; filas suman `referrer_name`.
