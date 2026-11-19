---
description: "Tareas de la feature 008: subcanal y horario obligatorios"
---

# Tasks: Subcanal y horario obligatorios (008)

## Phase 1: Base de datos

- [x] T001 Migración `supabase/migrations/20261119000200_subcanal_horario_obligatorio.sql`: `org_upsert` (desde la 007) con las reglas de R1
- [x] T002 Aplicar en local
- [x] T003 pgTAP `supabase/tests/subcanal_horario_test.sql`: sin horas rechazado (crear y editar); sin subcanal en canal con subcanales rechazado (crear, carga sin ítems y editar); canal sin subcanales activos se guarda; `org_set_result` sobre una vieja sin horas sigue; ajustar tests 003/004/006/007 que guarden sin horas o sin subcanal

## Phase 2: US1 + US2 · Formulario (P1)

- [x] T004 `logic.ts`: `hasSubchannels`, `onlySubchannel`
- [x] T005 `AssignmentDialog.tsx`: marcar el subcanal único al elegir canal (FR-002); validar subcanal y horas con `fail(...)` y `data-field` (FR-001, FR-003, FR-004); títulos con * (FR-006)

## Phase 3: Pruebas y cierre

- [x] T006 Vitest: `hasSubchannels`, `onlySubchannel` (activos, inactivos, sin catálogo)
- [x] T007 Playwright: Kardex-like (canal de un subcanal) se marca solo con horario; canal de varios sin marcar → aviso; hora vacía → aviso; ajustar e2e existentes
- [x] T008 lint, typecheck, build, size, unit, pgTAP, e2e de organización
- [x] T009 `RB-union/migraciones-008-produccion.sql` (probado en local dos veces); `CLAUDE.md`; commit en la rama y push de la rama
