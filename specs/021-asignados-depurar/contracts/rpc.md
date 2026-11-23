# Contratos RPC — spec 021

Todas: `security definer`, `search_path = ''`, `revoke … from public, anon`, `grant … to authenticated`.
Errores: `forbidden` (sin rol, inactivo o cliente fuera de sus sucursales), `invalid_input` (detalle = campo).

## `list_agent_assigned(f jsonb) → jsonb` (versión nueva, parte de 20261123002000)

Entrada igual que en la 020: `{ from?, to?, branch_id?, actor_id }`.

Salida:

```json
{
  "total": 12,
  "hidden_total": 3,
  "contacted_visible": 4,
  "rows": [{ "...campos de la 020 (incluye phone_raw, phone_norm, branch_id)": "", "hidden": false }]
}
```

- `rows` y `total` incluyen ocultos (orden y límite 500 sin cambios).
- `hidden_total`: filas del período (completo) con marca para `actor_id`.
- `contacted_visible`: filas del período con `contacts > 0` y sin marca.

## `set_assigned_hidden(p_agent uuid, p_prospects uuid[], p_hidden boolean) → int`

- Oculta (`true`) o muestra (`false`) esos clientes en la lista de `p_agent`.
- Verifica cada cliente: existe y `manages_branch(branch_id)`; si alguno falla → `forbidden` y no cambia nada.
- `p_agent` nulo o arreglo vacío/nulo → `invalid_input`.
- Devuelve cuántas marcas cambiaron (0 si ya estaban así).

## `hide_assigned_contacted(f jsonb) → int`

- Misma entrada que `list_agent_assigned`. Marca como ocultos todos los contactados no ocultos del período de
  `actor_id` (sin límite de 500), dentro del alcance de sucursal (`scoped_branch`).
- Verifica rol y `manages_branch` de cada cliente; devuelve cuántos ocultó.

## Sin cambios

`agent_activity`, `list_agent_contacts`, `my_contacts`, `my_closed_contacts`, `assign_prospects`: los ocultos no los afectan.
