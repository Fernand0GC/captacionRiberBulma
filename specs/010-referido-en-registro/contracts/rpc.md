# Contratos RPC (010)

## Cambia: `submit_capture(p jsonb) → jsonb`

Campo nuevo, opcional, en la entrada:

```json
"referrer_new": { "name": "Doña Susi", "kind": "client" }
```

- Solo se usa si no llega un `referrer_id` válido de la sucursal.
- `name`: se recorta y se colapsan espacios; válido entre 2 y 60 caracteres.
- `kind`: `staff` | `freelance` | `client` | `other`; cualquier otro valor se guarda como `other`.
- Si ya hay un referidor en la sucursal con la misma clave (`referrer_key`), se usa ese (activo o no) y no se cambia.
- Si no hay, se crea con `source = 'capture'` y `created_by` = quien registra.
- Nunca rechaza la captación: con nombre inválido o tope diario superado (10 por persona y día de La Paz), la
  captación entra sin referidor.

Salida: igual que antes, con un campo opcional:

```json
{ "id": "…", "result": "accepted", "referrer": "skipped" }
```

`referrer: "skipped"` solo aparece cuando llegó `referrer_new` y no se pudo aplicar.

## Nueva: `referrer_key(text) → text` (immutable)

Recorta, colapsa espacios, quita tildes (á é í ó ú ü ñ → a e i o u u n) y pasa a minúsculas. La usa el índice único
`referrers_branch_key (branch_id, referrer_key(name))`, que reemplaza a `referrers_branch_name_key`.

## Cambia: tabla `referrers`

Columna `source text not null default 'manager'` (`manager` | `capture`). `referrer_save` no cambia: sigue devolviendo
`invalid_input`/`name_taken` cuando el nombre choca, ahora también por tildes y espacios.
