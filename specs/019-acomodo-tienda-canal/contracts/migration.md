# Contrato: `public.org_subchannel_to_channel`

```sql
public.org_subchannel_to_channel(p_name text, p_strategy text) returns jsonb
-- language plpgsql, security definer, search_path = ''
-- execute: revocado a public, anon y authenticated (solo migraciones y tests como postgres)
```

## Entrada

| Parámetro | Ejemplo | Regla |
|---|---|---|
| p_name | `'Acomodo de tienda'` | Nombre del canal a crear; también el que se busca (normalizado con `org_norm`) entre subcanales |
| p_strategy | `'Tienda'` | Estrategia del canal; debe existir, si no → `invalid_input` / detail `strategy` |

## Salida

```json
{ "channel_id": 15, "created": true, "reactivated": false, "subchannels": [41, 57], "moved": 23, "deactivated": 2 }
```

| Campo | Significado |
|---|---|
| channel_id | Canal destino |
| created | Se creó en esta llamada |
| reactivated | Existía inactivo y se activó |
| subchannels | Ids de subcanales encontrados (activos o no) |
| moved | Asignaciones movidas en esta llamada |
| deactivated | Subcanales que pasaron de activos a inactivos en esta llamada |

Segunda llamada sobre la misma base: `created = false`, `reactivated = false`, `moved = 0`, `deactivated = 0`.

## Errores

- `invalid_input` (detail `strategy`): la estrategia no existe.
- `invalid_input` (detail `name`): nombre fuera de 2..60 caracteres (regla de `org_channels.name`).

## Uso en la migración

```sql
select public.org_subchannel_to_channel('Acomodo de tienda', 'Tienda');
```
