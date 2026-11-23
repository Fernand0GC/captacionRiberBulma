# Contratos RPC (023)

Todas: `security definer`, `search_path = ''`, `app_is_active() and is_manager()` o `forbidden`, alcance con
`scoped_branch(f.branch_id)`, fechas en America/La_Paz.

## Nueva: `recontact_agenda(f jsonb default '{}') returns jsonb`

Entrada: `{ "branch_id"?: number }`. No recibe fecha: siempre es hoy.

Salida:

```json
{
  "today": "2026-11-23",
  "people": [{ "id": "uuid", "full_name": "Maico", "role": "field_assistant", "branch_id": 3 }],
  "rows": [{
    "id": "uuid", "full_name": "…", "phone_raw": "…", "stage": "recapture", "contact_attempts": 1,
    "next_contact_at": "…", "visit_at": null, "client_created_at": "…",
    "assigned_to": "uuid", "branch_id": 3, "assigned_at": "…", "reassigned_from_name": null,
    "last_contacted_at": "…", "last_result": "no_answer", "last_method": "call", "last_note": null
  }],
  "truncated": false
}
```

- `rows`: clientes activos del alcance con responsable, que cumplen **alguna**:
  - abiertos (etapa no venta/sin interés) con `next_contact_at < inicio de pasado mañana`;
  - abiertos sin `next_contact_at` y sin ningún contacto;
  - cualquier etapa con último contacto hoy.
- `people`: auxiliares, supervisores y encargados activos del alcance, más cualquier `assigned_to` de `rows`.
- Tope 5000 filas (orden por responsable y `next_contact_at`); `truncated = true` si había más.

## Cambio: `agent_activity(f)`

Cada objeto de `rows` y `by_branch` suma `first_contacts` y `recontacts` (enteros). El resto queda igual.
`first_contacts + recontacts = total`.

## Cambio: `list_agent_contacts(f, p_limit, p_offset)`

`f.metric` acepta además `first` y `recontact`; el total coincide con la celda de `agent_activity`.

## Cambio: `list_followup_status(f, p_limit, p_offset)`

`f.date_basis` opcional: `registered` (defecto) | `assigned` | `last_contact` | `next_contact`; cualquier otro valor →
`invalid_input` (detail `date_basis`). El período `from`–`to` se aplica a la fecha elegida (ver data-model). Sin el campo,
la respuesta es idéntica a la anterior.
