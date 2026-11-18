# Research: Seguimiento de referidos por origen (005)

## R1. El origen es un dato aparte del canal

- **Decision**: Columna nueva `prospects.referrer_id` (nula) → tabla nueva `referrers`. No se reactivan los canales
  «Referencia del personal / de clientes».
- **Rationale**: Gerencia dejó la lista de canales definitiva el 2026-11-03. El canal dice *por dónde* se captó; el
  referidor, *quién lo pasó*. Son independientes (un referido puede llegar por WhatsApp).
- **Alternatives**: texto en `channel_detail` (no se puede sumar: es lo que hoy obliga a Isa a usar Excel).

## R2. Lista de referidores por sucursal y sin conexión

- **Decision**: Tabla `referrers` (sucursal, nombre, tipo, orden, activo). Lectura por RLS para usuarios activos; se
  agrega a los catálogos que la app guarda en el dispositivo (`useCatalogs`, clave nueva `captacion.catalogs.v5` con
  respaldo de la v4), filtrada en pantalla por la sucursal en la que se registra. Escritura solo por RPC.
- **Rationale**: Principio I: el registro funciona sin señal. Los nombres de referidores no son datos de clientes.

## R3. Validación del origen al sincronizar

- **Decision**: `submit_capture` acepta `referrer_id`. Si no existe o es de otra sucursal, se guarda **nulo** en vez
  de rechazar la captación. Un referidor desactivado después de registrar sin señal se acepta igual.
- **Rationale**: Una captación hecha sin señal no puede quedar bloqueada en la cola por un dato secundario. Perder el
  origen es mejor que perder el contacto.

## R4. Qué registros cuentan

- **Decision**: Cuentan los registros referidos con estado `active` (no anulados ni rechazados por celular repetido).
  «Compró» = la ficha tiene un evento de venta (`stage_events.to_stage = 'sale'`). Etapa = la actual de la ficha.
  `submit_capture` guarda `referrer_id` también en los registros rechazados por duplicado, para que la spec 006 los
  pueda contar sin perder datos.
- **Rationale**: Decisión del usuario (2026-11-18): Recompra / Nuevos y duplicados van a la 006. Contar solo fichas
  activas es simple y coincide con el resto de los reportes de la app.

## R5. Qué cuenta el reporte

- **Decision**: Cohorte del mes: los registros referidos con fecha de registro (La Paz) dentro del mes elegido.
  Por referidor: llegados, sin contactar (`capture`), en seguimiento (`recapture`, `followup`, `interested`),
  compraron, sin interés (`lost`), conversión = compraron ÷ llegados, meta, cumplimiento = llegados ÷ meta. Avance
  por día: llegados por día de registro y compras por día de la venta (solo las del mes). - **Rationale**: Las respuestas de Isa (2026-11-18): la meta cuenta contactos que llegan; la venta se ve como conversión.

## R6. Metas que se arrastran

- **Decision**: Tabla `referrer_goals (referrer_id, month, goal)`, con `month` = primer día del mes. Para un mes sin fila se usa la del mes anterior más
  cercano (FR-007).
- **Rationale**: Una fila por mes permite ver el histórico; arrastrar evita recargar cada mes.

## R7. Permisos

- **Decision**: Función `can_see_referrals(p_branch)` = activo y (gerente general, Sistemas, o jefe de ventas con
  `manages_branch(p_branch)`). La usan `referral_report`, `referrer_save` y `referral_goals_save`. El encargado
  queda fuera aunque `manages_branch` le dé true (decisión del 2026-11-18). Corregir el origen de un contacto va por
  `update_prospect` (`manages_branch`, igual que el resto de los datos del contacto).
- **Rationale**: FR-006, FR-014, FR-014b.

## R8. Historial de cambios del origen

- **Decision**: Se agrega `referrer_id` a la lista de columnas del disparador `prospects_audit`; el historial de la
  ficha ya muestra las ediciones de `audit_log` (spec 001, «timeline real edits»), con la etiqueta «Referido por».
- **Rationale**: FR-003 sin tabla nueva.

## R9. Pantalla

- **Decision**: Ruta nueva diferida `/referidos` (menú «Referidos») solo para jefe de ventas, gerente general y
  Sistemas, con dos pestañas: **Reporte** (resumen por referidor, detalle de contactos por
  referidor, vista por día y Excel) y **Referidores y metas**. El Excel usa `exceljs` cargado al exportar.
- **Rationale**: Principio II (todo diferido); un solo lugar para Isa.

## R10. Despliegue en cualquier orden

- **Decision**: Todo aditivo. `submit_capture` ignora `referrer_id` en la app vieja (no llega). La app nueva con la base
  vieja fallaría al leer `referrers`; por eso la migración va primero, como siempre.

## R11. Notas de implementación (2026-11-18)

- **Aplicación local**: `supabase migration up` falla en esta base (`MigrationMissingLocalError` por
  `20261116000100_profiles_ci`, aplicada sin archivo en esta rama). La migración se aplicó con `psql` en una sola
  transacción y se registró en `supabase_migrations.schema_migrations` igual que la CLI. En producción se aplica con
  `supabase migration up` como siempre.
- **Funciones existentes con `pg_temp.patch_function`** (no `create or replace` del cuerpo local): la base local no tiene
  `20261113000200_capture_high_interest`, que también cambia `submit_capture`. Los textos que se reemplazan existen en
  las dos versiones, así la migración no pisa ese cambio en producción.
- **Grupos del reporte sin solaparse**: un contacto que compró y después volvió a seguimiento (recaptación de cerrados)
  contaría dos veces si se usara solo la etapa actual. Se resuelve así: *compró* = tiene evento de venta; los demás
  grupos (sin contactar, en seguimiento, sin interés) usan la etapa actual **solo si no compró**. La suma de los grupos
  siempre da los llegados.
- **Fecha de venta** = primer evento de venta del contacto. El avance por día cuenta las compras de los contactos del mes
  cuya venta cae dentro del mes; la columna «Compraron» cuenta las de la cohorte aunque la venta sea posterior.
- **`goal_from`** (nuevo en la respuesta de `referral_report`): mes de la meta usada, para mostrar «meta arrastrada de
  octubre» en «Referidores y metas». Contrato actualizado.
- **Corrección en la ficha**: «Editar datos» manda `referrer_id` solo si cambió, para que un catálogo viejo en el
  dispositivo (sin referidores) no borre el origen. El historial muestra nombres de referidores, no ids
  (`get_prospect` los resuelve).
- No se cargan referidores iniciales en la migración: cada sucursal arma su lista (Guayaramerín, la de Isa, la carga la
  jefa de ventas en «Referidores y metas»).
- `pnpm db:clean` también borra los referidores de prueba (nombres que empiezan con «E2E »).
