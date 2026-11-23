# Contrato RPC: 020

## `list_agent_assigned(f jsonb) → jsonb` (cambia: campos nuevos)

Firma, permisos (`is_manager()` + `scoped_branch`), filtros y límite de 500 filas: iguales a la spec 012
(`20261121000200_agent_assigned.sql`). Se reemplaza en `20261123002000_agent_assigned_phone_branch.sql`.

Cada elemento de `rows` agrega:

```jsonc
{
  "phone_raw": "7913 0001",   // como se registró
  "phone_norm": "79130001",   // solo dígitos
  "branch_id": 5              // sucursal del cliente
}
```

Compatibilidad: campos agregados; la app anterior los ignora.

## `assign_prospects(p_ids uuid[], p_to uuid) → integer` (sin cambios, se reutiliza)

Errores que la pantalla muestra con el aviso de siempre: `forbidden` (rol o sucursal ajena), `invalid_input`
(`to_user` inactivo, de otra sucursal o con rol que no hace seguimiento).

## `assignee_options(p_branch)` (sin cambios, se reutiliza)
