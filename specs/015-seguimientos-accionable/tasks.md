# Tasks — 015 Seguimientos accionable

## Base

- [x] T001 Migración `20261121000700_followup_status_context.sql` (`product_id`, `product_name`, `channel_detail`, `created_by_role`).
- [x] T002 pgTAP `followup_status_context_test.sql`.

## US1 — Período

- [x] T003 `defaultPeriod(ver)` en `search.ts`; `periodRange` y botones de la barra lo usan. Vitest.
- [x] T004 Texto «El período cuenta la fecha de registro del cliente» en Seguimientos.

## US2/US3 — Acción (componentes compartidos)

- [x] T005 Extraer `AssignSelection.tsx` (hook + barra + confirmación) y `ContactDialog.tsx`; Captaciones los usa sin cambiar comportamiento.
- [x] T006 Seguimientos: Seleccionar, casillas en tabla y tarjetas, barra, «Seleccionar las N del filtro» con `fetchAllFollowupStatus`.
- [x] T007 Botón «Seguimiento» en filas sin responsable (no Venta / Sin interés).
- [x] T008 Asignar y registrar contacto invalidan `['monitoring']`.

## US4/US5 — Contexto y filtros

- [x] T009 Tipos en `monitoring/api.ts` (`product_id`; `product_name`, `channel_detail`, `created_by_role`).
- [x] T010 Fila: celular + registró (cargo) + fecha bajo el nombre; «Canal · Etapa» con detalle y «Ref.»; «Producto» con interés. Tarjetas igual.
- [x] T011 Barra: «Referido por» y «Producto» de la barra común (sale el selector «Origen»).
- [x] T012 Excel: Producto, Detalle del canal, Referido por.

## Cierre

- [x] T013 e2e `followup-actionable.spec.ts`; regresión `monitoring.spec.ts` y Captaciones; typecheck, lint, Vitest.
- [x] T014 SQL de producción `RB-union/migraciones-015-produccion.sql`, probado en local.
- [ ] T015 Publicar: el usuario corre el SQL en producción y luego commit/merge/push.
- [ ] T016 Confirmar con ventas lo decidido por recomendación (Clarifications).

## Notas de cierre (2026-11-21)

- pgTAP `followup_status_context_test` 10/10 y `followup_status_test` en verde; las fallas de `capture_high_interest`,
  `org_catalog` y `referrals` ya existían.
- Vitest 213/213. e2e en verde: `followup-actionable`, `monitoring`, `bulk-reassign`, `followup`, `recapture-closed`,
  `take-followup`, `referrals-range`, `daily` (este último falla solo en paralelo con la prueba nueva, ambos registran en
  Trinidad; en serie pasa).
- SQL de producción probado en local: se detiene si ya está y aplica sobre la 014 (resultado `t t t`).
