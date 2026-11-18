---
description: "Tareas de la feature 005: seguimiento de referidos por origen"
---

# Tasks: Seguimiento de referidos por origen

**Input**: Documentos de diseño en `specs/005-referidos/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/rpc.md](./contracts/rpc.md)

**Tests**: pgTAP, Vitest y Playwright (constitución).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational

- [x] T001 Migración `supabase/migrations/20261118001000_referrals.sql`: tablas `referrers` y `referrer_goals` con RLS (data-model.md); `prospects.referrer_id` + índice; disparador `prospects_audit` con `referrer_id`; `can_see_referrals`; cambios en `submit_capture` (ambos inserts), `update_prospect` y `get_prospect` (usar el patrón `pg_temp.patch_function` del proyecto o `create or replace` desde la definición vigente en la base local); RPC `referrer_save`, `referral_goals_save`, `referral_report` (contracts/rpc.md, research R4–R7)
- [x] T002 Aplicar con `corepack pnpm exec supabase migration up` (nunca `db reset`)
- [x] T003 [P] pgTAP `supabase/tests/referrals_test.sql`: permisos (jefe de su sucursal sí, jefe de otra no, encargado no, gerente y admin sí, campo no), `submit_capture` con referidor válido / de otra sucursal (queda nulo) / en duplicado (se guarda pero no cuenta), `update_prospect` cambia y audita, cálculo del reporte (llegados, etapas, compraron, duplicados y anulados fuera, avance por día, meta arrastrada del mes anterior)
- [x] T004 `src/features/auth/types.ts`: `REFERRAL_ROLES = ['sales_lead', 'general_manager', 'admin']`
- [x] T005 `src/features/referrals/api.ts`: tipos del reporte y de referidores; hooks `useReferralReport`, `useReferrers`; `saveReferrer`, `saveReferralGoals`; mensajes de `invalid_input`
- [x] T006 [P] `src/features/referrals/logic.ts`: conversión, cumplimiento, agrupación por tipo de referidor, totales; etiquetas de tipo de referidor

---

## Phase 2: US1 · Registrar de quién viene (P1)

- [x] T007 [US1] `src/features/capture/useCatalogs.ts`: incluir referidores activos (id, nombre, sucursal, tipo) en el caché `captacion.catalogs.v5` con respaldo de la v4 (sin referidores)
- [x] T008 [US1] `src/features/sync/db.ts` y `CaptureForm.tsx`: casilla «Es referido» y selector obligatorio de referidor de la sucursal del registro (la del perfil o la elegida en Registrar); `referrer_id` en el payload. Si la sucursal no tiene referidores, la casilla no aparece
- [x] T009 [US1] Ficha del cliente (`src/features/client/`): mostrar «Referido por» y permitir corregirlo en «Editar datos» a quien ya puede editar; etiqueta «Referido por» en el historial de ediciones

---

## Phase 3: US3 · Referidores y metas (P2, necesaria para probar US2)

- [x] T010 [US3] Pestaña «Referidores y metas» en `ReferralsPage.tsx`: elegir sucursal (las del jefe) y mes; lista editable (nombre, tipo, orden, activo, meta del mes); guardar con `saveReferrer` / `saveReferralGoals`

---

## Phase 4: US2 · Reporte (P1)

- [x] T011 [US2] Pestaña «Reporte»: tabla por referidor (llegados, sin contactar, en seguimiento, compraron, sin interés, %, meta, cumplimiento), agrupable por tipo de referidor; totales
- [x] T012 [US2] Detalle por referidor: lista de contactos con nombre, celular, producto, responsable, etapa, fecha de venta; enlace a la ficha
- [x] T013 [US2] Vista «Por día»: grilla referidor × día con llegados y compras
- [x] T014 [P] [US2] `exportReferrals.ts`: Excel con resumen, por día y contactos (exceljs diferido)
- [x] T015 [US2] `router.tsx` (ruta diferida `/referidos` con `REFERRAL_ROLES`) y `AppShell.tsx` (menú «Referidos»)

---

## Phase 5: Pruebas y cierre

- [x] T016 [P] Vitest `tests/unit/referrals.test.ts`
- [x] T017 Playwright `tests/e2e/referrals.spec.ts`: alta de referidor y meta, registro referido, reporte con conteos, encargado sin acceso
- [x] T018 `typecheck`, `lint`, `test`, `build`, `size`, `supabase test db` y e2e de captura y referidos en verde
- [x] T019 Recorrido de [quickstart.md](./quickstart.md)

## Dependencies

T001 → T002 → (T003, T004, T005, T006) → US1 → US3 → US2 → cierre.
