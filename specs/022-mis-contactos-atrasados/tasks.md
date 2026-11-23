# Tasks: 022 Mis contactos — atrasados, resumen del día y lista liviana

**Input**: `specs/022-mis-contactos-atrasados/` (spec, plan, research, data-model, contracts/rpc.md)

**Tests**: pedidos explícitamente, TDD: cada test se escribe primero y se ve fallar antes de implementar.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 Confirmar que la versión vigente de `my_contacts` en local es la de `supabase/migrations/20261121000800_referral_batch.sql` (`pg_get_functiondef`) y que ninguna migración posterior la redefine

## Phase 2: Foundational (servidor: fecha de asignación, FR-001/FR-002)

- [x] T002 [US1] pgTAP primero: `supabase/tests/my_contacts_assigned_test.sql` — `assigned_at` = último evento hacia quien consulta (reasignado: el suyo, no el primero), sin evento → `client_created_at`, conserva `assigned_by_name`, `referrer_name`, `contacts_count`, `last_*`, no ve clientes de otra persona. Correrlo y verlo fallar
- [x] T003 [US1] Migración `supabase/migrations/20261123002200_my_contacts_assigned_at.sql` (parche con `pg_temp.patch_function`), aplicarla en local con psql y ver T002 en verde
- [x] T004 [US1] `FollowupRow.assigned_at?: string` en `src/features/followup/api.ts`

## Phase 3: User Story 1 — Ver qué se me atrasó (P1) 🎯 MVP

- [x] T005 [US1] Vitest primero en `tests/unit/dueStatus.test.ts`: asignado hace 3 días / ayer (incl. 23:50 → 00:10) → `late` «Atrasado · asignado hace N días»; asignado hoy 00:05 → «Nuevo · contactar hoy»; sin `assigned_at` → como antes; contactado o agendado → reglas actuales. Ver fallar
- [x] T006 [US1] Regla en `src/features/followup/dueStatus.ts` (T005 en verde)
- [x] T007 [US1] Columna «Asignado» (fecha, hora, «por X» / «tomado por ti») en la tabla y dato de asignación en las tarjetas, `src/features/followup/InboxPage.tsx`; en la tabla de Captados no repetir «te lo asignó X» (las tarjetas lo conservan: lo verifica `referrals-load.spec.ts`)

## Phase 3b: Reasignados de otra persona (decidido después del clarify, FR-019/FR-020)

- [x] T019 [US1] pgTAP primero en `supabase/tests/my_contacts_assigned_test.sql`: `reassigned_from_name` (de A → B; null en la primera asignación y si la tomó ella misma) y `waiting_since` (primer evento; null si tiene contactos). Ver fallar
- [x] T020 [US1] Ampliar la migración `20261123002200` (aún no está en producción) y reaplicar en local partiendo de la versión de la 016; T019 en verde
- [x] T021 [US1] Vitest primero en `tests/unit/inboxView.test.ts`: reasignados nunca contactados primero dentro del día, del que más espera. Ver fallar; implementar en `inboxView.ts`
- [x] T022 [US1] Marca «Reasignado de X · sin contactar desde el dd/mm» en tabla y tarjetas (`InboxPage.tsx`) y caso en el e2e

## Phase 4: User Story 4 — Contador sin repetir (P3, chico y sin dependencias)

- [x] T008 [P] [US4] Vitest primero `tests/unit/inboxView.test.ts`: `tabCount` (todos / algunos / ninguno). Ver fallar
- [x] T009 [US4] `tabCount` en `src/features/followup/inboxView.ts` y uso en el contador de `InboxPage.tsx`

## Phase 5: User Story 2 — Resumen con tarjetas-filtro (P2)

- [x] T010 [US2] Vitest primero en `tests/unit/inboxView.test.ts`: `summarize` (grupos disjuntos, `normal` fuera) y `cardOf`. Ver fallar
- [x] T011 [US2] `summarize`/`cardOf` en `inboxView.ts`; `src/features/followup/SummaryCards.tsx` (3 botones `aria-pressed`, deshabilitados en 0) y filtro en `InboxPage.tsx` combinado con la lupa

## Phase 6: User Story 3 — Captados por día y lista liviana (P2)

- [x] T012 [US3] Vitest primero en `tests/unit/inboxView.test.ts`: `groupByAssignedDay` (orden desc, «Hoy», «Ayer», «Sáb 21», `late`, fallback a `client_created_at`, orden dentro del día) y `dayLabel`. Ver fallar
- [x] T013 [US3] `groupByAssignedDay`, `dayLabel`, `PAGE = 50` en `inboxView.ts`
- [x] T014 [US3] En `InboxPage.tsx`: grupos plegables en Captados (primero abierto; con lupa, abiertos los que coinciden), tope por lista (luego reemplazado por la paginación de T023–T025), vuelta a la primera página al cambiar pestaña/tarjeta/lupa

## Phase 6b: Paginación profesional (pedido del usuario)

- [x] T023 [US3] Vitest primero en `tests/unit/inboxView.test.ts`: `pageOf` con tamaño, `pageWindow`, `keepPlace`, `parsePageSize`. Ver fallar
- [x] T024 [US3] Implementar en `inboxView.ts`; paginador completo + selector «Filas por página» en `InboxPage.tsx` (tamaño recordado en `localStorage`)
- [x] T025 [US3] e2e: 25 de entrada, cambiar a 50, siguiente/anterior

## Phase 7: e2e y cierre

- [x] T015 Playwright primero `tests/e2e/my-contacts-late.spec.ts` (datos propios vía psql con fecha de asignación pasada + limpieza): atrasado «hace 1/3 días», nuevo de hoy, grupos y orden, tarjetas y filtro, contador, paginación. Escribirlo antes de T007/T011/T014 y verlo fallar; correrlo al final (preguntar antes por Playwright en otra pestaña; `pnpm build` antes)
- [x] T016 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm size`
- [x] T017 [P] `../migraciones-022-produccion.sql` (raíz de RB-union) con la migración y una consulta de verificación
- [x] T018 [P] CLAUDE.md (línea de la 022), spec Status → Implemented, estado en `docs/plan-018-021.md`

## Dependencies

- T002 → T003 → T004 → T006 (y todo lo de UI usa `assigned_at`).
- T005 → T006; T008 → T009; T010 → T011; T012 → T013 → T014.
- T015 se escribe tras T004 y se ve fallar antes de T007; se ejecuta en verde al final.
- US4 y US2 son independientes entre sí; US3 depende de `assigned_at` (T004).
