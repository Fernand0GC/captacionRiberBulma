# Research: Ajustes de la organización comercial (004)

Decisiones técnicas tomadas sobre el código de la 003 (`src/features/organization/`, migraciones `20261117000*`).

## R1. Dónde viven las dos metas

- **Decision**: `org_assignments.goal` y `result` pasan a significar **captación** (sin renombrar columnas). Se agregan
  `share_goal` y `share_result` (smallint 0–9999, nulos).
- **Rationale**: Las asignaciones existentes quedan como captación sin migrar datos (FR-006). El Excel, el historial
  (`audit_log`) y el frontend publicado siguen funcionando mientras conviven versiones.
- **Alternatives**: renombrar a `capture_goal` (rompe la app publicada hasta el push); tabla aparte de metas por tipo
  (más compleja sin ganar nada con dos tipos fijos).

## R2. Marcas de meta por subcanal

- **Decision**: `org_subchannels` agrega `uses_goal` (captación) y `uses_share_goal` (compartidas), ambas `not null`.
  `org_channels` conserva `uses_goal` y agrega `uses_share_goal`: valen para asignaciones **sin** subcanal y como valor
  inicial de los subcanales nuevos. La marca efectiva de una asignación = la del subcanal si tiene, si no la del canal.
- **Rationale**: FR-002 pide el control por subcanal (WhatsApp ≠ TikTok dentro de Mensajería). Mantener la marca del
  canal evita casos sin regla (asignación sin subcanal).
- **Alternatives**: marcas nulas en subcanal que heredan del canal (tres estados, más difícil de explicar en Catálogo).

## R3. Metas obligatorias

- **Decision**: `org_save` y `org_save_many` rechazan con `invalid_input` / `goal` o `share_goal` si la marca efectiva
  pide la meta y viene vacía. La regla se aplica al guardar (crear o editar); los datos viejos no se tocan hasta que
  alguien los edita. `org_copy_day` copia lo que hay, sin validar.
- **Rationale**: FR-004. Validar solo al guardar no rompe asignaciones históricas.

## R4. Selección múltiple

- **Decision**: RPC nueva `org_save_many(p jsonb)`: datos comunes + `items[]` (`subchannel_id`, `goal`, `share_goal`).
  Inserta una fila por ítem en una sola transacción (la función entera es atómica, FR-012) y les pone el mismo
  `batch_id uuid`. Editar sigue siendo por fila con `org_save` (un solo subcanal). `org_copy_day` genera un `batch_id`
  nuevo por cada grupo copiado.
- **Rationale**: FR-010: una asignación por subcanal mantiene reporte, Excel, resultados y copia sin cambios. El
  `batch_id` alcanza para agrupar en pantalla (FR-011).
- **Alternatives**: tabla hija asignación→subcanales (cambia todo el modelo, el Excel y los totales).

## R5. Subcanales agregados por ventas

- **Decision**: RPC `org_add_subchannel(p_branch smallint, p_channel smallint, p_name text) returns jsonb`. Permiso:
  `manages_org(p_branch)`. Compara contra los subcanales del canal con nombre normalizado (minúsculas, sin tildes, espacios
  colapsados) usando una función `org_norm(text)` con `translate`, sin extensión `unaccent`. Si existe activo devuelve
  `{id, existed: true}`; si existe desactivado lanza `invalid_input` / `inactive_subchannel`. Si no, inserta con
  `uses_goal = true`, `uses_share_goal = false`, sin horario, `added_by = auth.uid()`, `added_at = now()` (FR-015).
- **Rationale**: El catálogo sigue siendo escritura solo de Sistemas por RLS; la única puerta para ventas es esta RPC
  `security definer` con permiso por sucursal. Normalizar evita duplicados (FR-014, SC-005).
- **Alternatives**: abrir RLS de `org_subchannels` a encargados (no hay forma limpia de limitar por sucursal un
  catálogo global).

## R6. Resultado de compartidas

- **Decision**: Nueva sobrecarga `org_set_result(p_id, p_result, p_notes, p_share_result)`. La de 3 argumentos queda
  para la versión publicada mientras se despliega.
- **Rationale**: Cada push a `main` publica al instante; la migración debe poder ir antes del frontend.

## R7. Qué devuelve `org_list`

- **Decision**: Agrega por fila `share_goal`, `share_result`, `batch_id`, `uses_goal`, `uses_share_goal` (marcas
  efectivas vigentes). El frontend decide qué campos mostrar en Resultado con esas marcas o con la meta ya cargada.
- **Rationale**: Sin consultas extra ni lógica duplicada del catálogo en la tabla.

## R8. Totales y Excel

- **Decision**: `totals()` suma meta y resultado de captación y de compartidas por separado (FR-008). El Excel agrega
  «Meta compartidas» y «Resul. compartidas» después de «Resul.»; «Meta» y «Resul.» conservan su lugar.
- **Rationale**: La planilla de ventas sigue reconociendo sus columnas; las nuevas van al final del bloque de metas.

## R9. Despliegue en cualquier orden

- **Decision**: Todo es aditivo: columnas nuevas con valores por defecto, RPC nuevas, sobrecarga nueva. La única regla
  que cambia comportamiento para la app vieja es «meta obligatoria»: con la app vieja, una asignación sin meta en un
  canal que la pide se rechaza con el mensaje de `goal` que la app vieja ya conoce. Aceptable.

## R10. Notas de implementación (2026-11-18)

Contradicciones o huecos encontrados al implementar, resueltos de la forma más simple:

- **Ventana con la app vieja (corrige R9).** No solo «meta obligatoria» cambia el comportamiento: la app publicada
  esconde la meta en RRSS-Mensajería (marca del canal) y no conoce `share_goal`, así que mientras conviven no puede
  guardar WhatsApp, Barrios chinos ni Compartidas y estados (la base responde `invalid_input` / `goal` o `share_goal`;
  la app vieja muestra un error genérico para `share_goal`). El resto de los subcanales sigue igual. Se acepta: aplicar
  la migración en producción y publicar el frontend enseguida, sin dejar pasar un día de carga entre ambos.
- **`org_upsert(p, p_batch)` interno.** `org_save` y `org_save_many` comparten las reglas a través de esta función
  (sin `grant` a `authenticated`); así cada ítem se valida igual que `org_save` y el `batch_id` se escribe al insertar
  (sin un `update` posterior que llenaría el `audit_log`).
- **Límites de `org_save_many`.** Rechaza `id` (editar es por fila con `org_save`) y más de 20 ítems
  (`invalid_input` / `catalog`); un ítem sin `subchannel_id` cuenta como repetido.
- **Detalle `share_result`.** La sobrecarga de 4 argumentos de `org_set_result` rechaza compartidas fuera de rango con
  `invalid_input` / `share_result`.
- **`org_norm` y la ñ.** Quita tildes y diéresis pero no cambia la ñ («año» ≠ «ano»).
- **Valor por defecto de `org_subchannels.uses_goal`.** La columna queda `default true` (para el Catálogo publicado,
  que inserta sin la marca); la migración copia la marca del canal a los existentes y la pantalla Catálogo propone las
  marcas del canal en el subcanal nuevo.
- **Pruebas de la 003.** `org_assignments_test.sql` no necesitó cambios. `org_catalog_test.sql` sí: «Compartidas y
  estados» (canal) deja de llevar meta de captación (FR-005), y el conteo de 34 subcanales cuenta solo los del catálogo
  de Sistemas (`added_by is null`), porque la e2e deja «Kardex de ventas e2e» en Tareas administrativas.
- **Base local.** `supabase migration up` se niega porque la base local tiene aplicada `20261116000100_profiles_ci`
  (de otra rama, sin archivo en `main`) y le faltan `20261113*`/`20261114*`. Para no tocar ese historial, la migración
  se aplicó con `psql` en una transacción y se registró en `supabase_migrations.schema_migrations`.
