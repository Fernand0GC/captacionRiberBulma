# Implementation Plan: Observaciones del grupo de ventas (006)

**Branch**: `006-ajustes-ventas-2` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

## Summary

Arreglos de la Planificación (Excel, observaciones al crear, orden por persona, marcas al agregar subcanal),
catálogo nuevo, volanteras por asignación y verificación de compartidas por un rol nuevo «Cobros». Dos migraciones
aditivas y cambios en `src/features/organization/`, un módulo nuevo `src/features/verification/`, rol y menú.
Decisiones en [research.md](./research.md); datos en [data-model.md](./data-model.md); RPC en [contracts/rpc.md](./contracts/rpc.md).

## Technical Context

**Language/Version**: TypeScript ~5.9 strict; SQL/PL-pgSQL (Postgres 15, Supabase)
**Primary Dependencies**: React 18, TanStack Router/Query, Tailwind 4, Radix, exceljs (diferido). Ninguna nueva.
**Storage**: Postgres con RLS; migraciones `20261118002000_collections_role.sql`, `20261118002100_ajustes_ventas_2.sql`
**Testing**: pgTAP, Vitest, Playwright (`--workers=1` en este Docker)
**Constraints**: JS inicial ≤ 170 KB gzip; deploy en cualquier orden con la app publicada; sin cambios en edge functions
**Scale/Scope**: 2 migraciones, 3 RPC nuevas, 5 cambiadas, ~8 archivos de frontend

## Constitution Check

| Principio | Estado | Nota |
|---|---|---|
| I. Campo primero | Cumple | No toca el registro de campo. |
| II. Gama baja | Cumple | Pantalla de verificación diferida; sin dependencias. |
| III. Embudo | Cumple | No toca el embudo; verificación es dato manual con autor y fecha. |
| IV. Seguridad en la base | **Enmienda** | Rol nuevo «Cobros». Permisos por RPC con `can_verify_shares`; sin acceso a datos de clientes. Constitución v1.3.0 (research R7). |
| V. Simple | Cumple | Arreglo de ids para volanteras; RPC para el rol en vez de tocar la edge function. |

## Project Structure

```text
supabase/migrations/20261118002000_collections_role.sql
supabase/migrations/20261118002100_ajustes_ventas_2.sql
supabase/tests/ajustes_ventas_2_test.sql
src/features/organization/   api.ts · logic.ts · AssignmentDialog.tsx · OrganizationPage.tsx · exportOrganization.ts · CatalogPage.tsx
src/features/verification/   api.ts · VerifySharesPage.tsx        (NUEVA)
src/features/auth/types.ts   rol collections, etiqueta, homePath
src/features/admin/          UsersPage.tsx (botón «Hacer Cobros» y etiqueta)
src/app/router.tsx · AppShell.tsx
tests/unit/organization.test.ts · tests/e2e/organization.spec.ts · tests/e2e/verify-shares.spec.ts
.specify/memory/constitution.md  (v1.3.0)
```
