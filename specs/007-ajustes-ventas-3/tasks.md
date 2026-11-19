---
description: "Tareas de la feature 007: observaciones del grupo de ventas del 2026-11-19"
---

# Tasks: Observaciones del grupo de ventas del 2026-11-19 (007)

**Input**: `specs/007-ajustes-ventas-3/` (spec, plan, research, contracts/rpc.md, quickstart)

## Phase 1: Foundational (base de datos)

- [x] T001 Migración `supabase/migrations/20261119000100_ajustes_ventas_3.sql`: `org_upsert` con meta de compartidas opcional (R3); `org_copy_day_v2` (R1, R2) y `org_copy_day` delegando; grants. Partir de las definiciones vigentes en `20261118002100_ajustes_ventas_2.sql`
- [x] T002 Aplicar en local (`supabase migration up` o psql)
- [x] T003 [P] pgTAP `supabase/tests/ajustes_ventas_3_test.sql`: copiar dos veces → segunda `copied = 0`; destino con cargas a mano → solo agrega las que faltan; origen con duplicados → copia una; `org_copy_day` vieja devuelve entero; meta de compartidas vacía se guarda `null`; captación sigue obligatoria. Ajustar tests de la 004/006 que esperen `invalid_input`/`share_goal`

## Phase 2: US1 · Copiar sin duplicar (P1)

- [x] T004 [US1] `api.ts`: `copyDayV2` → `{ copied, skipped }`
- [x] T005 [US1] `OrganizationPage.tsx`: `window.confirm` con días de origen y destino; toast «N copiadas · M ya estaban» / «Ya estaban todas»
- [x] T006 [US1] `AssignmentDialog.tsx`: guardado único con `useRef` (R5)

## Phase 3: US2 · Ver por qué no se guarda (P1)

- [x] T007 [US2] `logic.ts`: `parseGoal` con `optional`; validaciones devuelven `{ message, field }`
- [x] T008 [US2] `AssignmentDialog.tsx`: error en el pie fijo con `role="alert"`; `scrollIntoView` + `focus` al campo; meta de compartidas «(opcional)» (FR-011)

## Phase 4: US3 · Aviso de cruce (P2)

- [x] T009 [US3] `logic.ts`: `overlaps` con nombres y `sameSlot` (R2, R6)
- [x] T010 [US3] `AssignmentDialog.tsx`: texto del aviso con subcanal/canal y horario; «Ya existe una asignación igual»

## Phase 5: US5 · Planificación compacta (P2)

- [x] T011 [US5] `logic.ts`: `groupRows` (sucursal → persona → filas, juntando la misma carga) (R8)
- [x] T012 [US5] `OrganizationPage.tsx`: encabezado sucursal/gerente/fecha en la barra o franja por sucursal; tabla de 6 columnas; filas con varios subcanales y acciones por subcanal. Excel y tarjetas sin cambio

## Phase 6: US4 · Ver solo la tarde (P3)

- [x] T013 [US4] `logic.ts` `defaultShiftFilter` + `OrganizationPage.tsx`: filtro Turno inicial; respetar si la persona lo cambia (R7)

## Phase 7: Pruebas y cierre

- [x] T014 [P] Vitest `tests/unit/organization.test.ts`: `parseGoal` opcional, `overlaps`/`sameSlot`, `groupRows` (una sucursal, varias, varios días, carga múltiple, carga con un subcanal editado), `defaultShiftFilter` (12:59 / 13:00 / otro día)
- [x] T015 Playwright `tests/e2e/organization.spec.ts`: copiar dos veces; error visible con meta vacía de captación; meta de compartidas vacía guarda; tabla compacta (sin columna Gerente, carga múltiple en una fila)
- [x] T016 `pnpm lint`, `pnpm typecheck`, `pnpm build` (≤ 170 KB gzip), `pnpm test`
- [x] T017 Armar `migraciones-007-produccion.sql` en `RB-union/` para pegar en el SQL Editor; actualizar `CLAUDE.md` (lista de specs)

## Dependencias

T001 → T002 → (T003, T004…). US1 y US2 primero (P1); US3, US5 y US4 son independientes entre sí.
