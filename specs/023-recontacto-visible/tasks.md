# Tasks: Recontacto visible para jefas (023)

**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md),
[contracts/](./contracts/)

**Tests**: Sí (práctica del proyecto: Vitest para la lógica, pgTAP para las RPC, Playwright para el flujo). Se escriben
antes y se ven fallar.

## Phase 1: Setup

- [X] T001 Verificar que Supabase local esté arriba y al día (`supabase migration up`, nunca `db reset`) y que `pnpm test` pase antes de empezar

## Phase 2: Foundational

- [X] T002 Crear la migración vacía con el helper `pg_temp.patch_function` (copiado de la 022) en supabase/migrations/20261124000100_recontacto_visible.sql
- [X] T003 [P] Extraer el tipo mínimo `DueInput` (campos que lee `dueStatus`, `stage: string`) y usarlo en `dueStatus`, `scheduled`, `visitPassed` y `cardOf`, sin cambiar lógica, en src/features/followup/dueStatus.ts y src/features/followup/inboxView.ts

## Phase 3: User Story 1 — Agenda de recontacto en «Del día» (P1) 🎯 MVP

**Goal**: la jefa ve por persona Le tocaba hoy · Contactó · Pendientes · Atrasados y la lista de clientes.

**Independent Test**: con clientes agendados hoy, ayer y mañana para una auxiliar, la fila muestra los mismos números que sus tarjetas de «Mis contactos».

- [X] T004 [P] [US1] pgTAP de `recontact_agenda` (permiso, alcance por sucursal, filas que entran y no entran, personal en cero, cerrado hoy incluido) en supabase/tests/recontacto_test.sql
- [X] T005 [P] [US1] Vitest de la lógica pura (clasificar con `dueStatus`, totales por persona, orden, cerrado hoy en «Contactó», paridad con `summarize`) en tests/unit/agenda.test.ts
- [X] T006 [US1] Crear `public.recontact_agenda(f jsonb)` según contracts/rpc.md en supabase/migrations/20261124000100_recontacto_visible.sql y aplicarla con `supabase migration up`
- [X] T007 [US1] Tipos `AgendaRow`, `AgendaPerson`, `AgendaReport` y hook `useRecontactAgenda(branchId, enabled)` en src/features/monitoring/api.ts
- [X] T008 [US1] Lógica pura `agendaByPerson(report, now)` y `agendaTotals` en src/features/monitoring/agenda.ts
- [X] T009 [US1] Componente `AgendaSection` (tabla por persona, total, aviso «solo hoy», nota de orígenes, diálogo con pestañas Pendientes / Contactados hoy / Atrasados y paginador de la 022) en src/features/monitoring/AgendaSection.tsx
- [X] T010 [US1] Montar `AgendaSection` en src/features/monitoring/DailyView.tsx (después de las tarjetas, con `day === today`)
- [X] T011 [US1] Hoja «Agenda» en el Excel de «Del día» cuando el día es hoy en src/features/monitoring/exportDaily.ts

## Phase 4: User Story 2 — Primer contacto y recontacto en Actividad (P2)

**Goal**: Actividad separa los contactos en primeros y recontactos, por persona y por sucursal.

**Independent Test**: un cliente con 3 contactos en el período suma 1 primer contacto y 2 recontactos; la suma da el total.

- [X] T012 [P] [US2] pgTAP de `first_contacts`/`recontacts` en `agent_activity` (por persona y por sucursal, contacto anterior de otra persona, invariante suma = total) y de `list_agent_contacts` con `metric` = `first`/`recontact` en supabase/tests/recontacto_test.sql
- [X] T013 [P] [US2] Vitest: totales y orden con las métricas nuevas en tests/unit/activity.test.ts
- [X] T014 [US2] Parchear `agent_activity` y `list_agent_contacts` en supabase/migrations/20261124000100_recontacto_visible.sql y aplicar
- [X] T015 [US2] Métricas `first_contacts` y `recontacts` en tipos y etiquetas (src/features/monitoring/api.ts, src/features/monitoring/labels.ts, src/features/monitoring/activity.ts, src/features/prospects/search.ts) con `ContactMetric` `first`/`recontact`
- [X] T016 [US2] Mostrar y abrir las columnas en src/features/monitoring/ActivityView.tsx, src/features/monitoring/BranchActivityTable.tsx y src/features/monitoring/AgentContactsDialog.tsx
- [X] T017 [US2] Columnas nuevas en el Excel de Actividad en src/features/monitoring/exportActivity.ts

## Phase 5: User Story 3 — «Contar por» en Seguimientos (P3)

**Goal**: el período de Seguimientos se aplica a registro, asignación, último contacto o próximo contacto.

**Independent Test**: un cliente registrado el mes pasado, asignado y contactado este mes, no sale con «Registro + Este mes» y sí con las otras tres opciones.

- [X] T018 [P] [US3] pgTAP de `date_basis` (4 opciones, defecto idéntico, valor inválido) en supabase/tests/recontacto_test.sql
- [X] T019 [P] [US3] Vitest del parámetro `contar` en la URL en tests/unit/search.test.ts
- [X] T020 [US3] Parchear `list_followup_status` con `date_basis` en supabase/migrations/20261124000100_recontacto_visible.sql y aplicar
- [X] T021 [US3] Parámetro `contar` (validar, limpiar con MONITORING_KEYS) en src/features/prospects/search.ts y `date_basis` en `FollowupStatusFilters` de src/features/monitoring/api.ts
- [X] T022 [US3] Selector «Contar por» y textos del total en src/features/monitoring/FollowupStatusView.tsx
- [X] T023 [US3] Título del Excel según la fecha contada en src/features/monitoring/exportFollowups.ts

## Phase 6: Polish

- [X] T024 [P] e2e de las tres historias en tests/e2e/recontacto.spec.ts
- [X] T025 Correr `pnpm db:test`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` y el e2e; corregir lo que falle
- [X] T026 [P] Copia para producción (sin aplicar) en ../migraciones-023-produccion.sql
- [X] T027 [P] Agregar la 023 a la lista de features de CLAUDE.md y marcar Status en specs/023-recontacto-visible/spec.md
- [X] T028 [P] Tutorial en video para encargada/jefa (Agenda de recontacto, Recontactos en Actividad, Contar por) en ../tutoriales/specs/captacion/recontacto/ → ../tutoriales/videos/captacion/recontacto-encargada/ (v1, 1:36)

## Dependencies

- T001 → T002 → T006/T014/T020 (misma migración, en orden).
- T003 antes de T008.
- US1, US2 y US3 son independientes entre sí (solo comparten el archivo de migración y el de pgTAP).
- Polish al final.

## Parallel Examples

- US1: T004 y T005 juntos; luego T006 → T007 → T008 → T009 → T010 → T011.
- US2: T012 y T013 juntos; luego T014 → T015 → T016/T017.
- US3: T018 y T019 juntos; luego T020 → T021 → T022/T023.

## Implementation Strategy

MVP = US1 (lo que pidió la jefa: ver la agenda de hoy). Después US2 y US3. Cada historia se prueba sola con su test independiente.
