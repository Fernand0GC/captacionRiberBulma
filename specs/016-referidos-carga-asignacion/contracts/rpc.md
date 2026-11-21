# Contrato RPC — 016

Todas `security definer`, `search_path = ''`, solo `authenticated`. Errores: `forbidden`, `invalid_input` (con
`detail` = campo), los de `submit_capture` (`invalid_phone`, `rate_limited`).

## referral_assignees(p_branch smallint) → jsonb

Requiere `can_see_referrals(p_branch)`.

```json
[{ "id": "uuid", "full_name": "Isabel Aparicio", "role": "field_assistant", "pending": 3 }]
```
Activos de la sucursal con rol `field_assistant | field_supervisor | branch_manager`, por nombre. `pending` = clientes
activos asignados, `stage = 'capture'`, sin filas en `followups`.

## referral_phone_check(p_branch smallint, p_phones text[]) → jsonb

Requiere `can_see_referrals(p_branch)`; máximo 50 (`invalid_input · phones`). Ignora inválidos.

```json
[{ "phone": "7654 3210", "norm": "76543210", "branch_name": "VERDOLAGO",
   "full_name": "Julio Vargas", "assigned_to": "Isabel Aparicio" }]
```
`full_name` y `assigned_to` son `null` si quien consulta no maneja la sucursal del cliente.

## referral_batch_save(p jsonb) → jsonb

```json
{ "branch_id": 5,
  "referrer_id": 12,                                   // o bien:
  "referrer_new": { "name": "Carla Méndez", "kind": "staff" },
  "items": [{ "id": "uuidv7", "full_name": "Lucía Mendoza", "phone": "76543210",
              "product_id": 3, "assigned_to": "uuid" }] }
```
Valida antes de escribir: `can_see_referrals(branch_id)` (si no, `forbidden`); `items` 1–50 (`items`); ids únicos;
referidor de la sucursal (`referrer_id`) o nombre 2–60 y tipo `staff|freelance|client|channel|other`
(`referrer_new`); cada `assigned_to` activo, de la sucursal y con rol asignable (`assigned_to`).

Respuesta:
```json
{ "referrer_id": 12, "referrer_name": "Carla Méndez", "accepted": 2, "duplicates": 1,
  "items": [{ "id": "…", "result": "accepted", "assigned_to": "uuid" },
            { "id": "…", "result": "duplicate", "branch_name": "TRINIDAD", "full_name": null, "assigned_to_name": null }] }
```

## Cambios aditivos

- `my_contacts()`: cada fila suma `referrer_name` (o `null`) y `assigned_by_name` (quien hizo la última asignación
  hacia mí, `null` si fui yo o no hubo).
- `referral_report_range(p)`: cada contacto suma `contacts`, `first_contact_at`, `last_method`, `last_result`, `last_note`.
