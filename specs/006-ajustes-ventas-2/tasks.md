---
description: "Tareas de la feature 006: observaciones del grupo de ventas"
---

# Tasks: Observaciones del grupo de ventas (006)

**Input**: `specs/006-ajustes-ventas-2/` (spec, plan, research, data-model, contracts/rpc.md)

## Phase 1: Foundational

- [x] T001 Migración `supabase/migrations/20261118002000_collections_role.sql`: solo `alter type public.app_role add value if not exists 'collections'` (research R7/R8)
- [x] T002 Migración `supabase/migrations/20261118002100_ajustes_ventas_2.sql`: columnas (data-model), catálogo (FR-005 a FR-007, `uses_flyers`), `can_verify_shares`, cambios en `org_list`, `org_upsert` (notes, flyer_ids), `org_save_many`, `org_copy_day`, `org_add_subchannel`; RPC nuevas `org_share_list`, `org_verify_shares`, `admin_set_collections`; grants. Partir de las definiciones vigentes (20261118000100_org_goals_multi.sql)
- [x] T003 Aplicar ambas en local con psql (dos transacciones) y registrarlas en `supabase_migrations.schema_migrations` (la CLI falla por el historial local)
- [x] T004 [P] pgTAP `supabase/tests/ajustes_ventas_2_test.sql`: catálogo nuevo, notes al crear y conservarlas al editar, orden por persona, volanteras (válidas, de otra sucursal, no volantera, canal sin volanteras), copia de volanteras, marcas al agregar subcanal, verificación (Cobros de su sucursal sí, de otra no, encargado no, gerente sí), `org_share_list` filtra, `admin_set_collections` solo admin. Ajustar tests de la 003/004 que dependan del orden o del catálogo

## Phase 2: US1 · Arreglos de la Planificación (P1)

- [x] T005 [US1] `exportOrganization.ts`: `numFmt '#,##0'` en celdas del resumen; columna «Volanteras», «Compartidas verificadas»; orden por persona
- [x] T006 [US1] `AssignmentDialog.tsx` + `api.ts`: campo «Observaciones» (300, contador) en nueva y edición
- [x] T007 [US1] `OrganizationPage.tsx`: separador por persona en la tabla y agrupación en tarjetas; verificación junto a compartidas
- [x] T008 [P] [US1] `logic.ts` y Vitest: helpers de agrupación por persona

## Phase 3: US2 · Catálogo (P1)

- [x] T009 [US2] Verificar en e2e/manual que las 6 opciones aparecen y el genérico no se ofrece

## Phase 4: US3 · Volanteras (P2)

- [x] T010 [US3] `AssignmentDialog.tsx`: «Volanteras que van» (casillas con volanteras activas de `org_staff`) cuando el canal lo pide; `flyer_ids` en guardar
- [x] T011 [US3] `OrganizationPage.tsx` y Excel: mostrar volanteras
- [x] T012 [P] [US3] `CatalogPage.tsx`: casilla «Pide volanteras» por canal

## Phase 5: US4 · Cobros (P2)

- [x] T013 [US4] `auth/types.ts`: rol `collections` («Cobros»), `homePath` → `/verificar-compartidas`; revisar todos los `Record<AppRole, …>` y listas de roles (incluida la cuenta única / SSO) para que el rol nuevo no rompa nada
- [x] T014 [US4] `src/features/verification/` (api.ts, VerifySharesPage.tsx): rango de fechas, sucursales del usuario, tabla con meta, reportado, verificado (input) y comentario; guardar por fila
- [x] T015 [US4] `router.tsx` (ruta diferida con rol collections + global) y `AppShell.tsx` (menú «Verificar compartidas»)
- [x] T016 [US4] `admin/UsersPage.tsx`: etiqueta «Cobros» y acción «Hacer Cobros» (elige sucursales, llama `admin_set_collections`)
- [x] T017 [US4] Constitución v1.3.0: rol Cobros en el principio IV, con fecha y motivo

## Phase 6: Cierre

- [x] T018 Playwright: `organization.spec.ts` (observaciones, volanteras, orden) y `verify-shares.spec.ts` (Cobros verifica; encargado no puede)
- [x] T019 typecheck, lint, test, build, size, `supabase test db` (salvo los 4 ajenos conocidos) y e2e con `--workers=1` en verde
