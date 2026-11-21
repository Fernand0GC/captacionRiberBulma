# Contrato — `list_followup_status` (cambios de la spec 015)

Migración: `supabase/migrations/20261121000700_followup_status_context.sql` (parche aditivo con `pg_temp.patch_function`).

## Entrada nueva (opcional)

| Campo `f` | Tipo | Efecto |
|---|---|---|
| `product_id` | integer | Solo clientes con ese producto. Afecta total, `by_tab` y filas. Sin el campo: igual que antes. |

## Salida nueva por fila

| Campo | Tipo | Origen |
|---|---|---|
| `product_name` | text \| null | `products.name` de `prospects.product_id` |
| `channel_detail` | text \| null | `prospects.channel_detail` |
| `created_by_role` | text | `profiles.role` de quien registró |

Sin cambios de permisos, orden ni paginación. `referrer_name` y el filtro `referrer` ya existen (spec 014).

## Asignación

Sin cambios: la vista usa `assign_prospects(p_ids uuid[], p_to uuid)` como Captaciones.
