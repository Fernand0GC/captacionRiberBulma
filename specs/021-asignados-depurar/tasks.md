# Tasks: 021 Depurar «Clientes asignados»

**Input**: `specs/021-asignados-depurar/` (spec, plan, research, data-model, contracts)
**Tests**: pedidos explícitamente y escritos primero (TDD: fallan → implementación → pasan).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Tests primero (deben fallar)

- [x] T001 [P] [US1][US2][US3] pgTAP `supabase/tests/assigned_hidden_test.sql`: tabla con RLS y sin acceso directo; `set_assigned_hidden` (encargada de su sucursal, jefe de ventas, gerente → sí; encargada de otra sucursal, auxiliar, supervisor, Cobros → `forbidden`; repetir no da error; mostrar quita la marca); `hide_assigned_contacted` oculta exactamente los `contacts > 0` de `list_agent_assigned`; `list_agent_assigned` trae `hidden`, `hidden_total`, `contacted_visible` y conserva `phone_raw`/`phone_norm`/`branch_id`; `agent_activity` igual antes y después; la marca de una persona no afecta a otra; `my_contacts` de la auxiliar sigue incluyendo al oculto.
- [x] T002 [P] [US1][US2] Vitest `tests/unit/assigned.test.ts`: `filterAssigned` excluye ocultos salvo `showHidden`; `reassignable` excluye ocultos; `shouldAskHide` (cantidad, «Mantener» hoy/ayer); `keepKey`.
- [x] T003 [P] [US1][US2][US3] Playwright `tests/e2e/assigned-hide.spec.ts`: aviso → «Ocultar» → filas del tag fuera y «N ocultos»; números de Actividad iguales; «Ver ocultos» → «Mostrar»; «Ocultar» en una fila sin contactar; reabrir → «Mantener» → reabrir sin aviso; la auxiliar ve los ocultos en Mis contactos; limpieza de lo que ocultó el test; sin scroll horizontal en celular.
- [x] T004 Correr T001–T003 y registrar que fallan.

## Phase 2: Base de datos (US1, US2, US3)

- [x] T005 Migración `supabase/migrations/20261123002100_assigned_hidden.sql`: tabla `assigned_hidden` + RLS + grants; `set_assigned_hidden`; `hide_assigned_contacted`; `list_agent_assigned` partiendo de `20261123002000` con `hidden`, `hidden_total`, `contacted_visible`.
- [x] T006 Aplicar en local con `docker exec … psql` y correr T001 hasta verde.

## Phase 3: Lógica pura y datos

- [x] T007 [P] `src/features/monitoring/assigned.ts`: `showHidden` en `AssignedFilter`, `filterAssigned`, `reassignable`, `keepKey`, `shouldAskHide`, `laPazDay`. T002 en verde.
- [x] T008 [P] `src/features/monitoring/api.ts`: `hidden` en `AgentAssignedRow`, `hidden_total`/`contacted_visible` en la respuesta; `useSetAssignedHidden` y `useHideAssignedContacted` (invalidan `['monitoring','agent-assigned']`).

## Phase 4: UI — US1 aviso (P1)

- [x] T009 [US1] `HideNotice` en `src/features/monitoring/AssignedPanel.tsx` (banda con «Ocultar»/«Mantener», `localStorage` con try/catch).
- [x] T010 [US1] `src/features/monitoring/AgentContactsDialog.tsx`: pasar `hidden_total`, `contacted_visible` y quien mira al panel.

## Phase 5: UI — US2 «Ver ocultos» (P1) y US3 ocultar por fila (P2)

- [x] T011 [US2] `AssignedToolbar`: interruptor «Ver ocultos» + «N ocultos»; estado `showHidden` en `AssignedPanel`.
- [x] T012 [US2][US3] `AssignedRowItem`: «Ocultar» / marca «Oculto» + «Mostrar»; ocultos sin casilla de selección.
- [x] T013 T003 en verde (previa pregunta al usuario por Playwright de otras pestañas); `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Phase 6: Cierre

- [x] T014 [P] `specs/021-asignados-depurar/seed-demo-021.sql` y `seed-demo-021-limpiar.sql` (solo datos «Demo 021»).
- [x] T015 [P] `../migraciones-021-produccion.sql` en la raíz de RB-union (copia de la migración, sin aplicar).
- [x] T016 [P] `CLAUDE.md`: agregar la 021 a la lista de features; `spec.md` → Status: Implemented.
- [x] T017 Actualizar Estado en `docs/plan-018-021.md` y proponer los comandos git con solo los archivos de la 021.

## Dependencies

T001–T003 → T004 → T005 → T006 → (T007, T008) → T009–T012 → T013 → T014–T017.
