# Data Model: 006

## app_role (cambia)
Valor nuevo `collections` (etiqueta «Cobros»). Sucursales por `profile_branches`, `branch_id` nulo.

## org_channels (cambia)
| Campo | Tipo | Regla |
|---|---|---|
| uses_flyers | boolean not null default false | true en Calle → Negociación y Activación |

## org_assignments (cambia)
| Campo | Tipo | Regla |
|---|---|---|
| flyer_ids | uuid[] not null default '{}' | Volanteras activas de la sucursal; vacío si el canal no las pide |
| share_verified | smallint 0–9999, nulo | Cantidad verificada por Cobros |
| share_verified_note | text ≤ 300, nulo | |
| share_verified_by | uuid → profiles, nulo | |
| share_verified_at | timestamptz, nulo | |

`notes` ya existe: ahora también se carga al crear o editar.

## Catálogo (datos)
- Tienda: canales «Creación de contenido», «Atención en tienda y venta», «Seguimiento de contactos de la app» (sin metas).
- Compartidas y estados: subcanales «Compartidas WhatsApp», «Compartidas redes sociales» (solo compartidas, horario del genérico); genérico «Compartidas y estados» desactivado.
- Calle → Activación: «Activaciones en plazas» 10:00–12:00 / 16:30–18:30.

## Funciones
- `can_verify_shares(p_branch smallint) → boolean`.
