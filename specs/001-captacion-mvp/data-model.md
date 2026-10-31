# Data Model: MVP de captación (001)

Postgres (Supabase). Nombres en inglés, UI en español. Todas las tablas con RLS activada.
Zona horaria de negocio: `America/La_Paz`. Timestamps en `timestamptz`.

## Enums

| Enum | Valores | UI |
|---|---|---|
| `app_role` | `field_volunteer`, `field_assistant`, `field_supervisor`, `branch_manager`, `general_manager`, `admin` | Volantero, Auxiliar, Supervisor, Encargado, Gerente, Administrador |
| `contract_type` | `temporary`, `permanent` | Temporal, Con contrato |
| `shift` | `morning`, `afternoon` | Mañana, Tarde |
| `interest_level` | `high`, `medium`, `low` | Alto, Medio, Bajo |
| `product_line` | `phones`, `appliances` | CELULARES, ELECTROS |
| `prospect_stage` | `capture`, `recapture`, `followup`, `interested`, `sale`, `lost` | 1 Captación, 2 Recaptación, 3 Seguimiento, 4 Cliente potencial, 5 Venta, 6 Sin interés |
| `contact_method` | `call`, `whatsapp_call`, `message`, `store` | Llamada, Llamada WhatsApp, Mensaje, En tienda (ATC) |
| `prospect_status` | `active`, `voided`, `duplicate_rejected` | Vigente, Anulada, Duplicado rechazado |
| `contact_result` | `no_answer`, `looking_product`, `visit_store`, `call_later`, `very_interested`, `sold`, `not_interested`, `wrong_number` | No contestó, Busca un producto, Visitará la tienda, Volver a contactar el…, Muy interesado, Compró, No le interesa, Número equivocado (FR-037) |
| `activity_status` | `pending`, `in_progress`, `done`, `blocked`, `cancelled` | Pendiente, En curso, Completada, Bloqueada, Cancelada |

`recapture` = 2 Recaptación (definida por el negocio el 2026-10-28): contacto por llamada, mensaje o en tienda.

## Catálogos

| Tabla | Campos | Notas |
|---|---|---|
| `branches` | `id smallint pk`, `code text unique`, `name text`, `active bool` | Seed: las 10 sucursales |
| `channels` | `id smallint pk`, `name text unique`, `active bool`, `sort smallint` | Canales de **captación** (migración `…001000_channels_catalog.sql`): Volantes, Activación, Visitas de negociación, TikTok, Facebook, Messenger, Marketplace, E-commerce, Otro. Llamadas no es canal de captación: es un medio de recaptación (`contact_method`) |
| `products` | `id int pk`, `name text unique`, `product_group product_group` (phones, major_appliances, small_appliances), `line product_line` (generada: phones → CELULARES, el resto → ELECTROS), `sort`, `active` | Producto de interés = categoría, sin marcas ni modelos. 57 filas (Celulares + 26 electro mayor + 30 electro menor) cargadas por la migración `…000250_product_catalog.sql` desde riber-bulma `v_products` (copia 2026-10-28) |
| `lost_reasons` | `id smallint pk`, `name text unique`, `active bool` | Seed provisional: Precio, Ya compró en otro lado, No necesita, Sin capacidad de pago, Otro |
| `agenda_strategies` | `id smallint pk`, `name text unique`, `active bool` | Seed: Marketing, Mensajería, Negociación, Activación, Llamadas, Atención en tienda, Contenido, En vivo, Kardex, Otra |
| `settings` | `key text pk`, `value jsonb` | `shift_cutoff` = `"13:00"` |

Los catálogos solo se desactivan, no se borran (las filas históricas los referencian).

## `profiles`
| Campo | Tipo | Reglas |
|---|---|---|
| `id` | uuid pk → `auth.users.id` | |
| `username` | text unique | minúsculas, `[a-z0-9._]{3,30}` |
| `full_name` | text not null | |
| `role` | app_role not null | |
| `branch_id` | smallint → branches | **obligatorio** salvo `general_manager` y `admin` (check) |
| `contract_type` | contract_type not null | `field_volunteer` ⇒ `temporary` por defecto |
| `active` | bool default true | |
| `deactivated_at` | timestamptz null | se setea al desactivar; se limpia al reactivar |
| `created_at` | timestamptz default now() | |

Funciones helper (`security definer stable`, `search_path=''`): `app_role()`, `app_branch()`, `app_is_active()`,
`is_field()` (los 3 roles de campo), `is_manager()` (encargado, gerente o admin), `can_follow_up()` (auxiliar, supervisor o encargado).

## `prospects` (captación / prospecto)
| Campo | Tipo | Reglas |
|---|---|---|
| `id` | uuid pk | **lo genera el cliente** (UUID v7); clave de idempotencia |
| `full_name` | text not null | 3–120 caracteres, trim |
| `phone_raw` | text not null | como se escribió |
| `phone_norm` | text not null | ver research R10; validado por check + función `normalize_phone()` |
| `product_id` | int null → products | opcional al captar; obligatorio al pasar a `sale` (FR-034) |
| `channel_id` | smallint null → channels | canal de la jornada elegido en el dispositivo (FR-011b) |
| `interest` | interest_level null | opcional |
| `occupation` | text null | actividad/oficio |
| `address` | text null | dirección/referencia |
| `branch_id` | smallint → branches not null | campo: la del autor; gestión: la elegida (encargado: solo la suya) |
| `created_by` | uuid → profiles not null | autor (FR-012) |
| `client_created_at` | timestamptz not null | ajustado: `least(client_created_at, received_at + 10 min)` |
| `received_at` | timestamptz default now() | |
| `shift` | shift not null | lo calcula el servidor (R12) |
| `stage` | prospect_stage default `capture` | se cambia solo con `change_stage` |
| `stage_changed_at` | timestamptz | |
| `sold_at` | timestamptz null | se setea al pasar a `sale` |
| `lost_reason_id` | smallint null → lost_reasons | obligatorio si `stage='lost'` (check) |
| `assigned_to` | uuid null → profiles | responsable de seguimiento; se cambia solo con `assign_prospect` |
| `next_contact_at` | timestamptz null | lo actualiza la última gestión |
| `contact_attempts` | smallint default 0 | intentos "No contestó" seguidos; al 3 → `lost` (FR-039) |
| `visit_at` | timestamptz null | visita pactada ("Pasará a la tienda", FR-038) |
| `status` | prospect_status default `active` | |
| `duplicate_of` | uuid null → prospects | si `duplicate_rejected` |
| `late_after_deactivation` | bool default false | se subió después de la baja del autor (R9); el encargado la revisa |
| `void_reason`, `voided_by`, `voided_at` | | obligatorios si `status='voided'` |
| `updated_at`, `updated_by` | | trigger |

Índices: `unique (phone_norm) where status='active'`; `(branch_id, client_created_at desc)`; `(assigned_to, next_contact_at) where status='active' and stage in ('capture','followup','interested')`;
`(created_by, client_created_at)`; trigram sobre `full_name` para la búsqueda.

### Máquina de estados (`stage`) — embudo del negocio (2026-10-28)

```
1 capture ──▶ 2 recapture ──▶ 3 followup ──▶ 4 interested ──▶ 5 sale (final)
     └────────────┴──────────────┴───────────────┴──────────▶ 6 lost (final, con motivo)
```

La etapa la mueve `add_followup` según el resultado del contacto (FR-039): No contestó → recapture (3 intentos → lost);
Busca un producto / Visitará la tienda / Volver a contactar → followup; Muy interesado → interested; Compró → sale
(exige producto); No le interesa / Número equivocado → lost. Las etapas positivas nunca retroceden.
`sale` y `lost` no tienen salida en la v1. Solo prospectos con `status='active'` cambian de etapa.

## `stage_events` (solo inserción)
`id bigint identity pk`, `prospect_id uuid → prospects`, `from_stage`, `to_stage`, `lost_reason_id null`, `note text null`, `actor_id uuid`, `created_at timestamptz default now()`.
Al crear un prospecto se inserta el evento inicial `null → capture`.

## `followups` (llamadas/gestiones, solo inserción)
`id uuid pk` (cliente), `prospect_id`, `contacted_at timestamptz`, `result contact_result not null`, `effective bool` (todo menos `no_answer`),
`method contact_method`, `note text null`, `visit_at timestamptz null` (obligatorio si `visit_store`), `callback_at timestamptz null` (obligatorio si `call_later`), `actor_id`, `created_at`.
`add_followup` aplica las reglas de FR-039 sobre el prospecto (etapa, intentos, `next_contact_at`, `visit_at`) e inserta el evento de etapa.

## `assignment_events` (solo inserción)
`id bigint identity pk`, `prospect_id`, `from_user null`, `to_user null`, `actor_id`, `created_at`.

## `agenda_activities`
| Campo | Tipo | Reglas |
|---|---|---|
| `id` | uuid pk | |
| `branch_id` | smallint not null | |
| `activity_date` | date not null | |
| `shift` | shift not null | |
| `start_time`, `end_time` | time not null | `end_time > start_time` |
| `strategy_id` | smallint → agenda_strategies | |
| `description` | text not null | |
| `responsible_ids` | uuid[] default '{}' | usuarios de la sucursal |
| `responsible_note` | text null | p. ej. "volantera" sin usuario |
| `goal_qty` | numeric null, `goal_unit` text null | p. ej. 5 "ventas", 20 "visitas pactadas" |
| `goal_text` | text null | meta cualitativa ("dejar bandeja vacía") |
| `places` | text[] default '{}' | |
| `status` | activity_status default `pending` | |
| `result_qty` | numeric null, `result_note` text null | cumplimiento = `result_qty / goal_qty` |
| `created_by`, `created_at`, `updated_at` | | |

Check: hay `goal_qty` y `goal_unit`, o hay `goal_text`.

## `monthly_goals`
`branch_id`, `line product_line`, `month date` (día 1), `units int >= 0`, `updated_by`, `updated_at`. PK `(branch_id, line, month)`.

## `audit_log` (solo inserción)
`id bigint identity`, `table_name`, `row_id uuid`, `actor_id`, `at`, `old jsonb`, `new jsonb` (solo los campos que cambiaron). Lo cargan triggers en `prospects`, `profiles`, `monthly_goals` y `agenda_activities`.

## `rate_limits`
`user_id`, `bucket text`, `window_start timestamptz`, `count int`. PK `(user_id, bucket)`. Lo usa `phone_available`.

## Vistas (con `security_invoker = on`, respetan la RLS)
- `v_prospects`: prospecto + nombres de sucursal, autor, canal, producto, línea y responsable (para el listado y el Excel).
- `v_followups`: gestión + datos del prospecto (hoja INFORMES).
- `v_goal_progress`: por sucursal × línea × mes: meta, ventas = cantidad de `stage_events` con `to_stage='sale'` (mes de `created_at` en La Paz, línea del producto del prospecto, se excluyen los prospectos anulados), saldo, avance, días restantes y objetivo diario.

## Matriz de permisos (RLS + RPC)

| Acción | Campo (vol/aux/sup) | Responsable de seguimiento (aux/sup/enc) | Encargado | Gerente | Admin |
|---|---|---|---|---|---|
| Crear captación (`submit_capture`) | ✔ propia sucursal | — | ✔ su sucursal | ✔ cualquiera | ✔ cualquiera |
| Ver su conteo del día | ✔ | | ✔ | | |
| SELECT prospectos | ✘ | solo `assigned_to = uid` | su sucursal | todas | todas |
| Editar datos de la captación | ✘ | ✘ | su sucursal | todas | todas |
| Asignar / reasignar | ✘ | ✘ | su sucursal | todas | todas |
| Registrar gestión / cambiar etapa | ✘ | sus asignados | su sucursal | todas | todas |
| Anular | ✘ | ✘ | ✘ | ✘ | ✔ |
| Agenda: ver | ✘ | ✘ | su sucursal | todas | todas |
| Agenda: crear, editar, copiar | ✘ | ✘ | su sucursal | ✘ | ✔ |
| Metas: ver | ✘ | ✘ | su sucursal | todas | todas |
| Metas: editar | ✘ | ✘ | ✘ | ✔ | ✔ |
| Exportar Excel | ✘ | ✘ | su sucursal | todas | todas |
| Usuarios y catálogos | ✘ | ✘ | ✘ | ✘ | ✔ |

Todas las filas exigen además `app_is_active()`, salvo `submit_capture` para captaciones previas a la baja (R9).
