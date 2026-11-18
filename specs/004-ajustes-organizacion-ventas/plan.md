# Implementation Plan: Ajustes de la organización comercial pedidos por ventas

**Branch**: `004-ajustes-organizacion-ventas` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-ajustes-organizacion-ventas/spec.md`

## Summary

El formulario «Nueva asignación» pasa a tener dos metas con nombre (captación y compartidas), selección múltiple de
subcanales y la opción «+ Agregar otro…» para que quien planifica cree el subcanal que falta. Cada subcanal define qué
metas usa; las metas que aplican son obligatorias.

Enfoque técnico: una migración aditiva (columnas nuevas, marcas por subcanal, tres RPC nuevas o sobrecargadas) y
cambios en `src/features/organization/`. Una carga con varios subcanales crea una asignación por subcanal, unidas por
`batch_id`, así la tabla, el Excel, los resultados y «copiar día» siguen funcionando. Decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript ~5.9 (strict); SQL y PL/pgSQL (Postgres 15 de Supabase)

**Primary Dependencies**: React 18, TanStack Query, `@supabase/postgrest-js`, Tailwind 4, Radix Dialog, `exceljs` (diferido). Ninguna nueva.

**Storage**: Postgres (Supabase) con RLS; migración `supabase/migrations/20261118000100_org_goals_multi.sql`

**Testing**: pgTAP (`supabase test db`), Vitest, Playwright

**Target Platform**: PWA; computadoras de oficina y celulares de gama baja

**Project Type**: Aplicación web (frontend estático + Supabase)

**Performance Goals**: Guardar una carga de hasta 6 subcanales en una sola llamada (< 1 s)

**Constraints**: JS inicial ≤ 170 KB gzip (todo va en la ruta diferida de Planificación); la migración debe funcionar con la app publicada (cada push a `main` publica)

**Scale/Scope**: 1 migración, 3 RPC nuevas o sobrecargadas, 2 RPC cambiadas, 6 archivos de frontend

## Constitution Check

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. Campo primero | Cumple | La Planificación es gestión con conexión; el registro de campo no se toca. |
| II. Rápido en gama baja | Cumple | Sin dependencias nuevas; todo en la ruta diferida `/planificacion`. |
| III. El embudo es la fuente de verdad | Cumple | No se toca el embudo. Metas y resultados de planificación siguen siendo datos manuales (FR-014 de la 003), con `audit_log`. |
| IV. Seguridad en la base | Cumple | El catálogo sigue con escritura solo de Sistemas por RLS; ventas crea subcanales solo por `org_add_subchannel`, con permiso por sucursal. Reglas de metas aplicadas en la base. |
| V. Simple y spec-driven | Cumple | Sin tabla hija: una fila por subcanal + `batch_id` (research R4). |

**Revisión después del diseño**: sin cambios; no hay violaciones que justificar.

## Project Structure

### Documentation

```text
specs/004-ajustes-organizacion-ventas/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/rpc.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
supabase/
├── migrations/20261118000100_org_goals_multi.sql   # columnas, marcas, catálogo inicial, RPC
└── tests/org_goals_multi_test.sql                  # pgTAP de reglas y permisos

src/features/organization/
├── api.ts                    # tipos y llamadas nuevas (saveMany, addSubchannel, resultado de compartidas)
├── logic.ts                  # goalFlags, totals con compartidas, compliance por tipo
├── AssignmentDialog.tsx      # casillas de subcanales, metas por subcanal, «+ Agregar otro…»
├── ResultDialog.tsx          # captados y compartidas
├── OrganizationPage.tsx      # columnas, totales y agrupación por carga
├── exportOrganization.ts     # columnas de compartidas
└── CatalogPage.tsx           # casillas por subcanal y marca «agregado por ventas»

tests/
├── unit/organization.test.ts
└── e2e/organization.spec.ts
```

**Structure Decision**: Se mantiene la estructura de la 003; todo el cambio vive en `src/features/organization/` y una migración.
