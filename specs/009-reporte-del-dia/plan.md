# Implementation Plan: Reporte del día (009)

**Branch**: `009-reporte-del-dia` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

## Summary

Una función nueva en la base, `daily_report(f jsonb)`, calcula números y listas con una sola regla (FR-001, FR-002);
la vista «Del día» de /gestion la muestra y exporta; el Panel la usa sin listas para la tarjeta «Clientes con
seguimiento». Un índice nuevo sobre la fecha de los contactos. Sin tablas nuevas.

## Technical Context

**Language/Version**: TypeScript ~5.9 strict; PL/pgSQL (Postgres 15, Supabase)
**Primary Dependencies**: React 18, TanStack Router/Query, exceljs (diferido). Ninguna nueva.
**Storage**: migración `20261119000300_daily_report.sql` (función + índice)
**Testing**: pgTAP, Vitest, Playwright (`--workers=1`)
**Constraints**: JS inicial ≤ 170 KB gzip (la vista va lazy, como Seguimientos y Actividad); deploy SQL antes que app

## Constitution Check

| Principio | Estado | Nota |
|---|---|---|
| I. Campo primero | Cumple | Solo lectura; no toca el registro de campo. |
| II. Gama baja | Cumple | Vista diferida (lazy); una sola llamada trae todo. |
| III. Embudo | Cumple | Todo se calcula de registros y contactos; nada se anota a mano. |
| IV. Seguridad en la base | Cumple | `security definer`, `is_manager()` y `scoped_branch()` como `agent_activity`. |
| V. Simple | Cumple | Una función para vista y Panel; sin tablas nuevas. |

## Research

- **R1 · Una función para números y listas**: así el número siempre coincide con las filas (SC-002). `lists: false` la deja liviana para el Panel.
- **R2 · No tocar `dashboard_metrics`**: su definición vigente se armó con parches y la base local está desfasada; reescribirla es riesgoso. El Panel llama a `daily_report` para la tarjeta nueva.
- **R3 · Ventana del día**: `[día 00:00, día+1 00:00)` en `America/La_Paz` convertido a `timestamptz`, igual que `agent_activity`.
- **R4 · Promedios en el cliente**: la base devuelve conteos (registros, personas, registros de 7 días); `logic.ts` calcula los promedios y el «—» cuando no hay datos (probado con Vitest).
- **R5 · Índice**: `followups (contacted_at)` para buscar contactos del día en todas las sucursales; los de registros ya existen (`prospects_branch_created_idx`).
- **R6 · Tope de listas**: 2000 filas por lista con `truncated` en la respuesta.

## Project Structure

```text
supabase/migrations/20261119000300_daily_report.sql
supabase/tests/daily_report_test.sql
src/features/monitoring/daily.ts            promedios y textos (puros)
src/features/monitoring/api.ts              useDailyReport
src/features/monitoring/DailyView.tsx       vista «Del día» (lazy)
src/features/monitoring/exportDaily.ts      Excel
src/features/prospects/search.ts · ManageFilterBar.tsx · ProspectsPage.tsx   ver=dia, dia, origen, referidor, lista
src/features/dashboard/DashboardPage.tsx    tarjeta «Clientes con seguimiento»
tests/unit/daily.test.ts · tests/e2e/daily.spec.ts
```

## Deploy

1. `RB-union/migraciones-009-produccion.sql` en el SQL Editor.
2. Unir a `main` y push.
