# Tasks: Buscar y reasignar en «Clientes asignados»

**Input**: `specs/020-asignados-buscar-reasignar/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Tests**: pedidos explícitamente y en TDD: cada test se escribe primero, se ve fallar y después se implementa.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1 reasignar desde el modal · US2 lupa en el modal · US3 lupa en Mis contactos

---

## Phase 1: Setup

- [x] T001 Verificar que `list_agent_assigned` solo se define en `supabase/migrations/20261121000200_agent_assigned.sql` y que `assign_prospects` no cambió desde `20261028000900_followup.sql` (base para el `create or replace`)

---

## Phase 2: Foundational (bloquea US1 y US2)

**Purpose**: la RPC devuelve celular y sucursal, y el tipo del frontend los conoce.

- [x] T002 [P] Test pgTAP (rojo): `phone_raw`, `phone_norm` y `branch_id` en la fila de `list_agent_assigned` en `supabase/tests/agent_assigned_test.sql`
- [x] T003 Migración `supabase/migrations/20261123002000_agent_assigned_phone_branch.sql`: `create or replace function public.list_agent_assigned` igual a la 012 más `phone_raw`, `phone_norm`, `branch_id`; mismos grants. Aplicar con `psql` en el contenedor local y ver T002 en verde
- [x] T004 [P] Agregar `phone_raw`, `phone_norm`, `branch_id` a `AgentAssignedRow` en `src/features/monitoring/api.ts` y al `row()` de `tests/unit/assigned.test.ts`

**Checkpoint**: la RPC nueva está aplicada en local y los tests existentes siguen en verde.

---

## Phase 3: User Story 2 — Lupa en «Clientes asignados» (P2, base de la selección)

> Se hace antes que US1 porque la selección trabaja sobre la lista ya filtrada.

**Independent Test**: un fragmento de celular de un cliente deja solo esa fila en el modal.

### Tests (primero, en rojo)

- [x] T005 [P] [US2] Vitest `matchesNameOrPhone` (palabras en cualquier orden, tildes, dígitos con espacios/guiones, prefijo +591, vacío) en `tests/unit/search.test.ts`
- [x] T006 [P] [US2] Vitest `filterAssigned` con `q` combinado con contacto/origen/proceso en `tests/unit/assigned.test.ts`

### Implementation

- [x] T007 [US2] `matchesNameOrPhone` en `src/lib/search.ts`
- [x] T008 [US2] `AssignedFilter.q` y su uso en `filterAssigned` en `src/features/monitoring/assigned.ts`
- [x] T009 [US2] Ordenar `src/features/monitoring/AssignedPanel.tsx` en piezas (`AssignedKpis`, `OriginSection`, `OutcomeSection`, `AssignedToolbar`, `AssignedRowItem`) sin cambiar lo que se ve; lupa en `AssignedToolbar` y celular bajo el nombre (`data-testid="assigned-phone"`)

**Checkpoint**: Vitest en verde; el modal filtra por nombre/celular.

---

## Phase 4: User Story 1 — Reasignar los sin contactar desde el modal (P1) 🎯

**Independent Test**: dos clientes sin contactar de la auxiliar pasan al supervisor desde el modal y salen «Reasignado a …».

### Tests (primero, en rojo)

- [x] T010 [P] [US1] pgTAP: el encargado reasigna con `assign_prospects` un cliente sin contactar; `agent_activity` mantiene `assigned` de la persona original y la fila sale `reassigned` con `reassigned_to`, en `supabase/tests/agent_assigned_test.sql`
- [x] T011 [P] [US1] Vitest `reassignable` y `singleBranch` en `tests/unit/assigned.test.ts`
- [x] T012 [P] [US1] Playwright: buscar por tag y por celular, «Seleccionar», el contactado no tiene casilla, reasignar 2 al supervisor, «✓ 2 reasignados», filas «Reasignado a Supervisor Verdolago», en `tests/e2e/monitoring.spec.ts` (test nuevo)

### Implementation

- [x] T013 [US1] `reassignable` y `singleBranch` en `src/features/monitoring/assigned.ts`
- [x] T014 [US1] Opciones compatibles `layout: 'page' | 'dialog'` y `noBranchText` en `useAssignSelection` de `src/features/prospects/AssignSelection.tsx` (por defecto, idéntico a hoy)
- [x] T015 [US1] Selección en `AssignedPanel.tsx`: `useAssignSelection` con filas reasignables visibles, casillas por fila, `SelectToggle` en la barra de herramientas, barra `layout: 'dialog'`
- [x] T016 [US1] Pasar `actorId`/`actorName` y `filters` desde `src/features/monitoring/AgentContactsDialog.tsx` al panel

**Checkpoint**: pgTAP + Vitest en verde; e2e de monitoreo en verde (con permiso del usuario).

---

## Phase 5: User Story 3 — Lupa en «Mis contactos» (P2)

**Independent Test**: buscar el celular de uno de dos contactos deja solo ese.

- [x] T017 [P] [US3] Playwright: lupa por tag (contadores), por celular (uno), sin resultados (mensaje), en `tests/e2e/followup.spec.ts` (test nuevo)
- [x] T018 [US3] Lupa en `src/features/followup/InboxPage.tsx`: filtra pestañas, contadores y «Ver cerrados anteriores» con `matchesNameOrPhone`; mensaje sin coincidencias (el filtro de «Ver cerrados anteriores» se valida a mano: quickstart paso 5)

---

## Phase 6: Polish & cross-cutting

- [x] T019 [P] `pnpm typecheck`/`lint` y `pnpm test` completos; `pnpm build` y control de tamaño (`size-limit`)
- [x] T020 [P] Actualizar `CLAUDE.md` (línea de features con la 020); ningún contrato anterior documenta `list_agent_assigned` (el de la 020 queda en `contracts/rpc.md`)
- [x] T021 `migraciones-020-produccion.sql` en la raíz de `RB-union/` (copia de la migración, para que el usuario la aplique cuando autorice) y comandos git propuestos solo con archivos de la 020

---

## Dependencies & Execution Order

- Setup → Foundational (T002–T004) → US2 (T005–T009) → US1 (T010–T016) → US3 (T017–T018, solo depende de T007) → Polish.
- US3 puede ir en paralelo con US1 una vez hecho T007.

## Parallel Example

```text
T005 (search.test.ts) ‖ T006 (assigned.test.ts) → luego T007, T008
T010 (pgTAP) ‖ T011 (Vitest) ‖ T012 (Playwright)
```

## Implementation Strategy

MVP = Foundational + US2 + US1 (buscar y reasignar en el modal). US3 suma la lupa en Mis contactos sin depender del modal.
