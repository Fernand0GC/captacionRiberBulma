# Data Model: Organización comercial por sucursal

Nombres en inglés (código y base); la interfaz, en español. Migraciones nuevas en `supabase/migrations/`.

## Tablas nuevas

### `org_strategies` (Estrategia)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | smallint identity | PK |
| `name` | text | único, 2–60 caracteres |
| `sort` | smallint | orden en listas, por defecto 0 |
| `active` | boolean | por defecto true |

### `org_channels` (Canal)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | smallint identity | PK |
| `strategy_id` | smallint | FK → `org_strategies` |
| `name` | text | 2–60 caracteres; único dentro de la estrategia |
| `sort` | smallint | por defecto 0 |
| `active` | boolean | por defecto true |

Único adicional `(id, strategy_id)` para la llave compuesta de las asignaciones.

### `org_subchannels` (Subcanal)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | smallint identity | PK |
| `channel_id` | smallint | FK → `org_channels` |
| `name` | text | 2–80 caracteres; único dentro del canal |
| `sort` | smallint | por defecto 0 |
| `active` | boolean | por defecto true |
| `morning_start`, `morning_end` | time, opcionales | los dos o ninguno; fin > inicio |
| `afternoon_start`, `afternoon_end` | time, opcionales | los dos o ninguno; fin > inicio |

Único adicional `(id, channel_id)`.

### `org_assignments` (Asignación)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | PK, generado en la base |
| `branch_id` | smallint | FK → `branches`, obligatorio |
| `work_date` | date | obligatorio |
| `shift` | `shift` (morning, afternoon) | obligatorio |
| `start_time`, `end_time` | time, opcionales | si están los dos, fin > inicio |
| `profile_id` | uuid | FK → `profiles`, obligatorio (FR-012) |
| `strategy_id` | smallint | FK → `org_strategies`, obligatorio |
| `channel_id` | smallint | obligatorio; FK compuesta `(channel_id, strategy_id)` → `org_channels (id, strategy_id)` |
| `subchannel_id` | smallint, opcional | FK compuesta `(subchannel_id, channel_id)` → `org_subchannels (id, channel_id)` |
| `place` | text, opcional | hasta 200 caracteres |
| `goal` | smallint, opcional | 0–9999 |
| `result` | smallint, opcional | 0–9999; vacío = sin resultado (distinto de 0) |
| `notes` | text, opcional | hasta 300 caracteres |
| `lead_id` | uuid, opcional | FK → `profiles`; gerente a cargo copiado al crear (FR-013) |
| `created_by`, `updated_by` | uuid | FK → `profiles` |
| `created_at`, `updated_at` | timestamptz | por defecto `now()` |

Índices: `(branch_id, work_date, shift, start_time)` y `(profile_id, work_date)`.

RLS activado, sin permisos directos para `authenticated` ni `anon`; solo por RPC. Disparador `audit_row` en cada edición.

## Tablas existentes que se usan sin cambios

- `branches`: las 10 sucursales.
- `profiles`: personal (`full_name`, `role`, `branch_id`, `active`).
- `profile_branches`: sucursales de cada jefe de ventas; define el gerente a cargo.
- `audit_log`: historial de ediciones y eliminaciones.

## Tablas existentes que pasan a historial

- `agenda_activities` y `agenda_strategies`: se conservan con sus datos. Se retira el permiso de ejecutar `save_activity`, `set_activity_result`, `delete_activity` y `copy_agenda`. `agenda_day` sigue disponible y devuelve `can_edit = false`.

## Funciones de apoyo

| Función | Devuelve | Regla |
|---|---|---|
| `branch_lead(branch)` | uuid o null | Jefe de ventas activo con esa sucursal en `profile_branches`; si hay varios, el primero por nombre |
| `manages_org(branch)` | boolean | `manages_branch(branch)` o (supervisor de campo activo de esa sucursal) |
| `org_can_replan(branch, day)` | boolean | Gerencia general, Sistemas y jefe de ventas de la sucursal: siempre. Encargado y supervisor: solo si `day` > hoy (La Paz) |

## Reglas de validación (de los requisitos)

- Estrategia, canal y subcanal deben pertenecer uno al otro (FR-010): lo garantizan las llaves compuestas.
- Solo se puede asignar a un usuario activo cuya sucursal sea la de la asignación (FR-012). Una asignación guardada conserva a la persona aunque después quede inactiva.
- Un elemento de catálogo inactivo no se puede usar en una asignación nueva ni al cambiar el catálogo de una existente (FR-005).
- `goal` y `result` son enteros de 0 a 9999 (FR-014).
- Cambiar `profile_id`, `shift`, horario, catálogo, `place` o `goal` exige `org_can_replan` (FR-029). Cambiar `result` y `notes` exige solo `manages_org` (FR-018).
- Copiar un día copia todo menos `result` y `notes`, y vuelve a calcular `lead_id` (FR-016).

## Ciclo de una asignación

```text
creada (sin resultado) ──registrar resultado──▶ con resultado ──corregir──▶ con resultado
        │                                            │
        └──────────────── eliminar (queda en audit_log) ┘
```

No hay columna de estado: «pendiente» es simplemente `result` vacío (FR-019).

## Catálogo inicial

Se inserta en la migración: 2 estrategias, 10 canales y 34 subcanales con sus horarios, tal como están en
[insumos-excel.md](./insumos-excel.md). Los dos subcanales sin horario de tarde quedan con esas columnas vacías.

## Volumen esperado

Unas 30 asignaciones por sucursal y día: alrededor de 300 por día y 9 000 por mes en toda la empresa.
