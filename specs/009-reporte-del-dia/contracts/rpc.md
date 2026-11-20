# Contratos RPC (009)

## Nueva: `daily_report(f jsonb default '{}') → jsonb`

`security definer`, `search_path = ''`, solo `authenticated`. Errores: `forbidden` (no gestiona), `invalid_input`/`to`
(rango inválido o > 366 días), `invalid_input`/`origin`.

Entrada `f`: `from` (date, por defecto hoy en La Paz), `to` (date, por defecto `from`), `branch_id` (smallint; se
pasa por `scoped_branch`), `origin` ('all' | 'referred'), `referrer_id` (smallint), `lists` (boolean, por defecto true).

Salida:
```json
{
  "from": "2026-11-19", "to": "2026-11-19",
  "totals": { "new": 24, "new_people": 5, "week_new": 133, "followed": 31, "effective": 18, "contacts": 45 },
  "new_rows": [ { "id", "registered_at", "full_name", "phone", "channel", "channel_detail", "referrer",
                  "created_by", "assigned_to", "stage", "branch" } ],
  "followed_rows": [ { "id", "full_name", "phone", "contacts", "effective", "last_at", "last_method", "last_result",
                       "last_actor", "registered_at", "channel", "referrer", "stage", "branch" } ],
  "truncated": false
}
```
- `week_new`: registros de los 7 días que terminan en `to`.
- Con `lists: false`, `new_rows` y `followed_rows` vienen vacíos.
- Listas ordenadas: registros por hora ascendente; seguimiento por último contacto descendente. Tope 2000 cada una.
