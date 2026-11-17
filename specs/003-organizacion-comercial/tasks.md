---
description: "Tareas de la feature 003: organización comercial por sucursal"
---

# Tasks: Organización comercial por sucursal

**Input**: Documentos de diseño en `specs/003-organizacion-comercial/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: La constitución pide pgTAP para permisos y RPC, Vitest para la lógica y Playwright para los flujos; se incluyen.

**Organization**: Por historia de usuario, en orden de prioridad.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Se puede hacer en paralelo (otro archivo, sin depender de una tarea pendiente).
- **[Story]**: Historia a la que pertenece (US1…US5).

---

## Phase 1: Setup

- [x] T001 Crear la carpeta `src/features/organization/` y agregar a `src/features/auth/types.ts` las constantes `ORG_MANAGE_ROLES` (supervisor, encargado, jefe de ventas, gerente, Sistemas) y `ORG_VIEW_ROLES` (las anteriores más auxiliar)

---

## Phase 2: Foundational (bloquea todas las historias)

- [x] T002 Migración `supabase/migrations/20261117000100_org_catalog.sql`: tablas `org_strategies`, `org_channels`, `org_subchannels` según data-model.md (únicos por padre, únicos compuestos `(id, padre)`, restricciones de horario), RLS con lectura para usuarios activos y escritura solo Sistemas, e insert del catálogo inicial de insumos-excel.md (2 estrategias, 10 canales, 34 subcanales con horarios)
- [x] T003 Migración `supabase/migrations/20261117000200_org_assignments.sql`: tabla `org_assignments` con llaves compuestas, índices, RLS sin permisos directos, disparador `audit_row`; funciones `branch_lead`, `manages_org`, `org_can_replan`; RPC `org_list`, `org_save`, `org_set_result`, `org_delete`, `org_copy_day`, `org_staff` según contracts/rpc.md
- [x] T004 Aplicar las migraciones en la base local con `supabase migration up` (nunca `db reset`)
- [x] T005 [P] Prueba pgTAP `supabase/tests/org_catalog_test.sql`: conteos del catálogo inicial, horario de un subcanal, subcanal sin horario de tarde, nombre repetido dentro del canal rechazado, escritura rechazada para un no-Sistemas
- [x] T006 [P] Prueba pgTAP `supabase/tests/org_assignments_test.sql`: matriz de permisos por rol (encargado, supervisor, jefe, gerente, auxiliar, volantera), combinación de catálogo inválida, persona de otra sucursal, límite por fecha de FR-029, resultado sin límite de fecha, copia de día sin resultado, eliminación en `audit_log`, gerente a cargo copiado
- [x] T007 Tipos y hooks en `src/features/organization/api.ts`: tipos `Assignment`, `OrgList`, `Strategy`, `Channel`, `Subchannel`, `StaffMember`; hooks `useOrgList`, `useOrgCatalog`, `useOrgStaff`, `useOrgMutation`
- [x] T008 Lógica pura en `src/features/organization/logic.ts`: `suggestedTimes`, `overlaps`, `applyFilters`, `filterOptions`, `totals`, `compliance`

**Checkpoint**: base lista y probada; las historias pueden empezar.

---

## Phase 3: User Story 1 - Cargar la organización del día (Priority: P1) 🎯 MVP

**Goal**: Encargado, supervisor o gerente cargan asignaciones de un día con el catálogo de tres niveles y horario sugerido.

**Independent Test**: Cargar 5 asignaciones para mañana con dos estrategias y tres canales; todas quedan con su persona, turno, horario, catálogo, lugar y meta, y las listas nunca ofrecen una combinación inválida.

- [x] T009 [P] [US1] Pruebas Vitest de `suggestedTimes` y `overlaps` en `tests/unit/organization.test.ts`
- [x] T010 [US1] Diálogo `src/features/organization/AssignmentDialog.tsx`: campos en el orden de contracts/ui-routes.md, listas en cascada que se vacían al cambiar el padre, horario sugerido que no pisa lo escrito a mano, aviso de cruce, errores de la RPC con mensaje claro
- [x] T011 [US1] Pantalla `src/features/organization/OrganizationPage.tsx` en modo un día y una sucursal: selector de día y de sucursal, lista por turno con las columnas de la planilla, botón Agregar y editar según `can_replan`, copiar día, columna Gerente
- [x] T012 [US1] Rutas y menú en `src/app/router.tsx` y `src/app/AppShell.tsx`: `/planificacion` muestra `OrganizationPage` para `ORG_VIEW_ROLES`, supervisor agregado al menú de gestión, volantera sin acceso

**Checkpoint**: la organización de un día se puede cargar.

---

## Phase 4: User Story 2 - Resultado y observaciones (Priority: P1)

**Goal**: Registrar y corregir resultado y observaciones; ver cumplimiento.

**Independent Test**: Sobre 3 asignaciones, resultado en 2 y observación en 1; las filas muestran meta, resultado y cumplimiento, y la tercera sigue pendiente.

- [x] T013 [P] [US2] Pruebas Vitest de `compliance` (con meta 0, sin resultado, resultado 0) en `tests/unit/organization.test.ts`
- [x] T014 [US2] Diálogo `src/features/organization/ResultDialog.tsx`: resultado opcional, observaciones con contador de 300 caracteres que no pierde lo escrito
- [x] T015 [US2] En `OrganizationPage.tsx`: mostrar «15 de 30 · 50 %» o «Pendiente», y botón de resultado según `can_set_result`

**Checkpoint**: P1 completo; reemplaza la planilla para el trabajo diario.

---

## Phase 5: User Story 3 - Ver, filtrar y totalizar (Priority: P2)

**Goal**: Rango de fechas, varias sucursales, filtros por columna y totales que siguen al filtro.

**Independent Test**: Con 20 asignaciones en 2 sucursales y 3 días, filtrar por sucursal y canal; los totales coinciden con la suma manual.

- [x] T016 [P] [US3] Pruebas Vitest de `applyFilters`, `filterOptions` y `totals` en `tests/unit/organization.test.ts`
- [x] T017 [US3] En `OrganizationPage.tsx`: rango desde–hasta (máximo 31 días), selector de varias sucursales según el rol, barra de filtros (gerente, sucursal, turno, persona, estrategia, canal, subcanal), totales de meta, resultado y número de asignaciones, estado «Sin resultados», tabla en pantalla ancha y tarjetas en celular
- [x] T018 [US3] Vista «Mi plan» del auxiliar en `OrganizationPage.tsx`: solo sus filas, sin acciones ni filtros de gestión

---

## Phase 6: User Story 4 - Catálogo y horarios (Priority: P2)

**Goal**: Sistemas mantiene estrategias, canales, subcanales y horarios sin pedir cambios de código.

**Independent Test**: Agregar un subcanal con horario, verlo al cargar, desactivarlo y comprobar que las asignaciones viejas lo siguen mostrando.

- [x] T019 [US4] Funciones de escritura del catálogo en `src/features/organization/api.ts` (`saveCatalogItem` por nivel, con mensaje claro para nombre repetido)
- [x] T020 [US4] Pantalla `src/features/organization/CatalogPage.tsx`: tres niveles anidados, nombre, orden, activo y horarios de mañana y tarde por subcanal; sin borrar
- [x] T021 [US4] Ruta `/admin/catalogo` y entrada «Catálogo» del menú para Sistemas en `src/app/router.tsx` y `src/app/AppShell.tsx`

---

## Phase 7: User Story 5 - Exportar a Excel (Priority: P3)

**Goal**: Exportar las filas visibles con las 14 columnas de la planilla.

**Independent Test**: Filtrar una sucursal y una semana, exportar y comparar filas y columnas.

- [x] T022 [US5] `src/features/organization/exportOrganization.ts` según contracts/excel-export.md, con `exceljs` cargado bajo demanda
- [x] T023 [US5] Botón Exportar en `OrganizationPage.tsx` con aviso si no hay filas

---

## Phase 8: Polish & cierre

- [x] T024 Migración `supabase/migrations/20261117000300_agenda_readonly.sql`: retirar el permiso de ejecutar `save_activity`, `set_activity_result`, `delete_activity` y `copy_agenda`; `agenda_day` devuelve `can_edit = false` y deja fuera a la volantera
- [x] T025 Actualizar `supabase/tests/agenda_test.sql` al historial de solo lectura
- [x] T026 `src/features/agenda/PlanningPage.tsx` como historial de solo lectura en `/planificacion/historial`, con enlace desde la organización
- [x] T027 Quitar de `src/features/capture/RegisterHome.tsx` la consulta de la actividad en curso y borrar `src/features/agenda/currentActivity.ts` y lo que solo él usaba
- [x] T028 [P] Prueba Playwright `tests/e2e/organization.spec.ts`: el encargado carga una asignación con horario sugerido, registra resultado, filtra y exporta; el auxiliar ve solo lo suyo
- [x] T029 [P] Reescribir `tests/e2e/planning.spec.ts` para el historial de solo lectura y la volantera sin acceso
- [x] T030 Actualizar documentación del cambio: `CLAUDE.md` (feature activa), `specs/001-captacion-mvp/spec.md` (US4 reemplazada por 003) y `specs/001-captacion-mvp/contracts/ui-routes.md`
- [x] T031 Verificación final: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `supabase test db`, `pnpm build && pnpm size`, `pnpm e2e` y los pasos de quickstart.md

---

## Phase 9: Ajustes tras la prueba con ventas (2026-11-17)

- [x] T032 Migración `supabase/migrations/20261117000400_org_place_goal_flags.sql`: `uses_place` en estrategias, `uses_goal` en canales, canal «Tareas administrativas» en Tienda; `org_save` y `org_copy_day` vacían lugar y meta según las marcas (FR-030, FR-031)
- [x] T033 [P] pgTAP: marcas y canal nuevo en `supabase/tests/org_catalog_test.sql`; guardado sin lugar ni meta en `supabase/tests/org_assignments_test.sql`
- [x] T034 `formFields` en `src/features/organization/logic.ts` (+ Vitest); `AssignmentDialog.tsx` esconde ubicación y meta; `CatalogPage.tsx` agrega «Pide ubicación» y «Lleva meta»
- [x] T035 e2e: Tienda sin ubicación, Comentarios y Tareas administrativas sin meta en `tests/e2e/organization.spec.ts`

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T008)** → historias.
- **US1** necesita la base. **US2** usa la pantalla de US1. **US3** amplía esa pantalla. **US4** solo necesita la base. **US5** necesita los filtros de US3.
- **Cierre (T024–T031)** después de US1 y US2; T029 después de T026.

### Parallel Opportunities

- T005 y T006 (pruebas pgTAP) en paralelo con T007 y T008.
- T009, T013 y T016 son el mismo archivo de pruebas: en paralelo con las pantallas, no entre sí.
- US4 (T019–T021) en paralelo con US3.
- T028 y T029 en paralelo.

## Implementation Strategy

1. **MVP**: Setup + Foundational + US1 + US2. Con eso se puede dejar la planilla para el trabajo diario.
2. **Incremento 2**: US3 (consulta gerencial) y US4 (catálogo).
3. **Incremento 3**: US5 y el cierre.
4. Validar con quickstart.md después de cada incremento.
