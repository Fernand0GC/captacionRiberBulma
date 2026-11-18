---
description: "Tareas de la feature 004: ajustes de la organización comercial pedidos por ventas"
---

# Tasks: Ajustes de la organización comercial pedidos por ventas

**Input**: Documentos de diseño en `specs/004-ajustes-organizacion-ventas/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/rpc.md](./contracts/rpc.md)

**Tests**: pgTAP para reglas y permisos, Vitest para la lógica, Playwright para el flujo (constitución).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational (bloquea las historias)

- [x] T001 Migración `supabase/migrations/20261118000100_org_goals_multi.sql`: columnas de data-model.md (`org_channels.uses_share_goal`, `org_subchannels.uses_goal/uses_share_goal/added_by/added_at`, `org_assignments.share_goal/share_result/batch_id`), catálogo inicial de marcas (FR-005), funciones `org_norm` y `org_goal_flags`, `org_list` con campos nuevos, `org_save` con `share_goal` y metas obligatorias, `org_save_many`, sobrecarga `org_set_result` de 4 argumentos, `org_copy_day` con `share_goal` y `batch_id`, `org_add_subchannel`; grants solo a `authenticated` (contracts/rpc.md)
- [x] T002 Aplicar con `corepack pnpm exec supabase migration up` (nunca `db reset`)
- [x] T003 [P] Prueba pgTAP `supabase/tests/org_goals_multi_test.sql`: marcas iniciales, meta obligatoria (captación y compartidas), meta que no aplica se guarda vacía, `org_save_many` crea N filas con el mismo `batch_id` y es todo o nada, subcanal repetido rechazado, `org_add_subchannel` (permiso por sucursal, duplicado normalizado devuelve el existente, desactivado rechazado, volantera/auxiliar rechazados), resultado de compartidas, copia de día con `share_goal` y `batch_id` nuevo
- [x] T004 Ajustar `supabase/tests/org_assignments_test.sql` si alguna prueba de la 003 guarda sin meta en un canal que ahora la exige
- [x] T005 `src/features/organization/api.ts`: tipos (`Assignment` con `share_goal`, `share_result`, `batch_id`, `uses_goal`, `uses_share_goal`; `Channel.uses_share_goal`; `Subchannel` con marcas y `added_by/added_at`), `saveAssignments` (org_save_many), `addSubchannel`, `setAssignmentResult` con `share_result`, mensajes nuevos de `invalid_input` (`share_goal`, `name`, `inactive_subchannel`)
- [x] T006 `src/features/organization/logic.ts`: `goalFlags(cat, channelId, subchannelId)`, `totals` con `shareGoal`/`shareResult`, y que `formFields` use la marca efectiva

**Checkpoint**: base lista y probada.

---

## Phase 2: US1 · Dos metas (P1)

- [x] T007 [US1] `AssignmentDialog.tsx`: campos «Meta de captación (contactos)» y «Meta de compartidas» según la marca efectiva, obligatorios; nota «Este subcanal no lleva meta» cuando no lleva ninguna
- [x] T008 [US1] `ResultDialog.tsx`: «Captados» y «Compartidas» según las marcas de la fila (o si ya hay meta cargada), con «Meta: N» de cada uno
- [x] T009 [US1] `OrganizationPage.tsx`: columnas y tarjetas con meta/resultado de captación y de compartidas, cumplimiento de cada uno; totales separados (FR-008)
- [x] T010 [P] [US1] `exportOrganization.ts`: columnas «Meta compartidas» y «Resul. compartidas» y totales de compartidas
- [x] T011 [P] [US1] `CatalogPage.tsx`: casillas «Captación» y «Compartidas» por subcanal; «Compartidas» también por canal

---

## Phase 3: US2 · Selección múltiple (P1)

- [x] T012 [US2] `AssignmentDialog.tsx` en modo nuevo: lista de casillas de subcanales del canal; por cada marcado, sus metas; horario sugerido del primero marcado; guardar con `saveAssignments`. En modo edición sigue un solo subcanal (selector)
- [x] T013 [US2] `OrganizationPage.tsx`: marca visual de las filas de una misma carga (`batch_id`), sin cambiar el orden

---

## Phase 4: US3 · «+ Agregar otro…» (P2)

- [x] T014 [US3] `AssignmentDialog.tsx`: botón «+ Agregar otro…» bajo la lista de subcanales; campo de nombre; al confirmar llama `addSubchannel`, refresca el catálogo y deja el subcanal marcado; muestra el aviso si ya existía
- [x] T015 [P] [US3] `CatalogPage.tsx`: etiqueta «Agregado por {persona} el {fecha}» en subcanales con `added_by` (nombre resuelto desde `profiles` si el admin lo puede leer, o desde la RPC)

---

## Phase 5: Pruebas y cierre

- [x] T016 [P] Vitest `tests/unit/organization.test.ts`: `goalFlags`, `totals` con compartidas, `compliance`
- [x] T017 Playwright `tests/e2e/organization.spec.ts`: carga múltiple WhatsApp + Barrios chinos con metas, meta obligatoria, «+ Agregar otro…», resultado de compartidas; ajustar pruebas existentes que guardaban sin meta
- [x] T018 `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test && corepack pnpm build && corepack pnpm size` y `supabase test db` en verde
- [x] T019 Recorrido de [quickstart.md](./quickstart.md)

## Dependencies

T001 → T002 → (T003, T004, T005) → T006 → US1 → US2 → US3 → cierre. T010, T011, T015, T016 en paralelo dentro de su fase.
