# Contrato: `my_contacts()` (cambio de la 022)

Firma, permisos y filtros sin cambios: `public.my_contacts() returns jsonb`, `security definer`, solo
`app_is_active() and can_follow_up()`, solo `assigned_to = auth.uid()`, abiertos (`status = 'active'`, etapa no venta/perdido).

## Cambio

Cada elemento suma:

```json
{ "assigned_at": "2026-11-21T10:00:00-04:00" }
```

- Último evento de asignación **hacia quien consulta** (`assignment_events.to_user = auth.uid()`), aunque lo haya hecho él mismo.
- Si no hay evento: `client_created_at`.
- Todos los campos anteriores se conservan (verificado por pgTAP).

```json
{ "reassigned_from_name": "Aux A", "waiting_since": "2026-11-23T10:00:00-04:00" }
```

- `reassigned_from_name`: nombre de `from_user` de esa última asignación hacia quien consulta, si existe y no es él mismo; si no, `null`.
- `waiting_since`: solo si el cliente nunca fue contactado (sin `followups`): su primer evento de asignación (de cualquier persona);
  sin eventos, `client_created_at`. Si ya fue contactado, `null`.

## Errores

Iguales que antes: `forbidden` si la persona está inactiva o no hace seguimiento.

## Compatibilidad

La app trata `assigned_at` como opcional: contra un servidor sin la 022, «Mis contactos» se ve como antes.
