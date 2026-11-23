# Tasks: La encargada edita la planificación de hoy

**Input**: Design documents from `specs/018-encargada-edita-hoy/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rpc.md, quickstart.md

**Tests**: pedidos explícitamente (pgTAP + Playwright). Se escriben primero y deben fallar antes del cambio (TDD).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1 editar hoy · US2 quitar hoy · US3 días pasados protegidos

---

## Phase 1: Setup

- [x] T001 Verificar base local arriba y al día: `pnpm db:start` y `supabase migration up` (sin `db reset`); correr `pnpm db:test` y anotar el estado actual de `supabase/tests/org_assignments_test.sql` (debe pasar antes de tocar nada)

---

## Phase 2: Foundational (tests primero, deben fallar)

**Propósito**: dejar escrita la regla nueva como tests antes del cambio.

- [x] T002 [US1] [US2] En `supabase/tests/org_assignments_test.sql`, invertir los asserts del encargado sobre hoy: «cambia la meta de hoy» (`lives_ok`), «elimina una asignación de hoy» (`lives_ok`, sobre una asignación de hoy creada aparte para no romper los asserts de resultado que siguen) y `can_replan` de la fila de hoy = `true`
- [x] T003 [US1] En el mismo archivo, invertir el assert del supervisor: «el supervisor cambia la meta de hoy» (`lives_ok`)
- [x] T004 [US3] En el mismo archivo, agregar fila de **ayer** creada como gerente (`login_as` …0002) en la sucursal 5 y asserts: encargado y supervisor reciben `forbidden` al editarla (`org_save`) y al quitarla (`org_delete`), `can_replan = false`, y `org_set_result` sí funciona. Ajustar `select plan(N)`
- [x] T005 [P] [US1] [US2] [US3] Crear `tests/e2e/planning-same-day.spec.ts`: `enc.trinidad` crea una asignación de hoy, la fila muestra «Editar» y «Quitar asignación de…», edita la meta y se ve la nueva, la quita y desaparece; con «Día anterior», ninguna fila muestra «Editar» ni «Quitar asignación de…»
- [x] T006 Correr `pnpm db:test` y confirmar que T002–T004 **fallan** por la regla vieja (y solo esos)

**Checkpoint**: la regla nueva está escrita como tests en rojo.

---

## Phase 3: User Story 1 + 2 — Editar y quitar hoy (Priority: P1) 🎯 MVP

**Goal**: la encargada y el supervisor editan y quitan asignaciones de hoy de su sucursal.

**Independent Test**: T002, T003 y T005 en verde.

- [x] T007 [US1] [US2] Crear `supabase/migrations/20261123000100_org_replan_same_day.sql`: `create or replace function public.org_can_replan(p_branch smallint, p_day date)` con `p_day >= (now() at time zone 'America/La_Paz')::date`, misma firma, `security definer set search_path = ''`, y repetir `revoke … from public, anon` / `grant execute … to authenticated` (research R2–R3). Comentario de cabecera en español citando spec 018 y FR-029
- [x] T008 [US1] [US2] Aplicar en local con `supabase migration up` y correr `pnpm db:test`: T002–T003 en verde

**Checkpoint**: MVP listo: la encargada corrige el día.

---

## Phase 4: User Story 3 — Días pasados protegidos (Priority: P2)

**Goal**: nada cambia para días anteriores.

**Independent Test**: T004 en verde y la parte «Día anterior» de T005.

- [x] T009 [US3] Confirmar T004 en verde con la migración de T007 (no debería requerir código extra; si falla, revisar el `>=` y la zona horaria)

---

## Phase 5: Polish & cross-cutting

- [x] T010 [P] Actualizar `specs/003-organizacion-comercial/spec.md`: FR-029 («hasta el día anterior» → «hasta el mismo día de la asignación»; los días pasados quedan para gerencia/Sistemas) y el caso borde de la línea «Asignación de hoy o de una fecha pasada», con nota «(cambiado por spec 018)»
- [x] T011 [P] Actualizar `specs/003-organizacion-comercial/contracts/rpc.md` donde describe `org_can_replan`, con referencia a la spec 018
- [x] T012 [P] Agregar la spec 018 a la lista de features de `CLAUDE.md`
- [x] T013 Correr `pnpm dev` + `pnpm e2e tests/e2e/planning-same-day.spec.ts tests/e2e/organization.spec.ts tests/e2e/planning.spec.ts` (el nuevo y los existentes de la Planificación) en verde
- [x] T014 Correr la suite completa: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm db:test`
- [x] T015 Copiar la migración a `../migraciones-018-produccion.sql` (costumbre del repo) **sin aplicarla**; queda esperando autorización
- [ ] T016 Hacer la prueba manual de `quickstart.md`, marcar la 018 como ✅ en `docs/plan-018-021.md` y proponer al usuario los comandos de commit (`feat(planning): let branch managers edit today's assignments (spec 018)`)

---

## Dependencies & Execution Order

- T001 → T002–T005 → T006 → T007 → T008 → T009 → T010–T016
- T005 (e2e) es independiente de los pgTAP y puede escribirse en paralelo con T002–T004.
- T010, T011 y T012 son documentos distintos: en paralelo.
- US1 y US2 comparten la misma migración (una sola línea), por eso van en la misma fase.

## Parallel Example

```text
En paralelo después de T001:
  T002–T004  supabase/tests/org_assignments_test.sql
  T005       tests/e2e/planning-same-day.spec.ts
En paralelo al final:
  T010  specs/003-organizacion-comercial/spec.md
  T011  specs/003-organizacion-comercial/contracts/rpc.md
  T012  CLAUDE.md
```

## Implementation Strategy

1. Tests en rojo (Phase 2) → prueban que la regla vieja es la que falla.
2. Una migración (Phase 3) → MVP: US1 y US2 en verde.
3. Confirmar US3 (Phase 4) → los días pasados siguen protegidos.
4. Documentación y suite completa (Phase 5) → listo para que el usuario haga commit y autorice producción.
