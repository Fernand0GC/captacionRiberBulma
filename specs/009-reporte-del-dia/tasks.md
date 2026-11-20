---
description: "Tareas de la feature 009: reporte del día"
---

# Tasks: Reporte del día (009)

## Phase 1: Base de datos

- [x] T001 Migración `20261119000300_daily_report.sql`: `daily_report` (contrato) e índice `followups (contacted_at)`
- [x] T002 Aplicar en local
- [x] T003 pgTAP `daily_report_test.sql`: conteos y listas coinciden; cliente con 3 contactos = 1; contacto de un cliente viejo cuenta en seguimiento y no en nuevos; borde de las 23:30 de La Paz; duplicado y anulado no cuentan; referidos y referidor; alcance por sucursal (encargado de otra no ve); auxiliar no puede; `lists: false`; promedio semanal

## Phase 2: Vista «Del día» (US1–US3)

- [x] T004 `daily.ts`: promedios por persona y por día, texto de efectivos (puro, Vitest)
- [x] T005 `api.ts` `useDailyReport`; `search.ts` (`ver=dia`, `dia`, `origen`, `referidor`, `lista`) y `ViewSwitch` con «Del día»
- [x] T006 `DailyView.tsx`: día ‹ › sin futuro, sucursal, origen, referidor, 5 tarjetas, aviso de sin conexión, dos pestañas con listas que abren la ficha, «Cómo se calcula», Excel (`exportDaily.ts`)

## Phase 3: Panel (US4)

- [x] T007 `DashboardPage.tsx`: tarjeta «Clientes con seguimiento» con `daily_report` (`lists: false`) del período

## Phase 4: Pruebas y cierre

- [x] T008 Vitest `tests/unit/daily.test.ts`
- [x] T009 Playwright `tests/e2e/daily.spec.ts`: abrir «Del día», números = filas, cambiar de día, «Solo referidos», Excel
- [x] T010 lint, typecheck, build, size, unit, pgTAP, e2e
- [x] T011 `RB-union/migraciones-009-produccion.sql` (probado en local dos veces); `CLAUDE.md`; commit y push de la rama
