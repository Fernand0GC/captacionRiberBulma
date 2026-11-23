# Implementation Plan: La encargada edita la planificación de hoy

**Branch**: `018-encargada-edita-hoy` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/018-encargada-edita-hoy/spec.md`

## Summary

La encargada (y el supervisor que la reemplaza) pasa a poder editar y quitar asignaciones de **hoy**, no solo de
días futuros. Los días pasados siguen reservados a gerencia y Sistemas. Toda la regla vive en una función,
`public.org_can_replan(branch, day)`, que usan `org_save` (todas sus versiones), `org_save_many`, `org_delete` y
`org_list` (campo `can_replan`, que decide si la pantalla muestra «Editar» y «✕»). Por eso el cambio es una
migración que redefine esa función (`>` pasa a `>=`), sin tocar el frontend, más la actualización de tests y de la
spec 003.

## Technical Context

**Language/Version**: SQL (PostgreSQL 15, Supabase) · TypeScript 5 strict (sin cambios de código de app)

**Primary Dependencies**: Supabase (RLS + RPC `security definer`), React 18 + TanStack Query (sin cambios)

**Storage**: PostgreSQL, tabla `org_assignments` (sin cambios de esquema)

**Testing**: pgTAP (`pnpm db:test`) · Playwright (`pnpm e2e`)

**Target Platform**: PWA web (celulares Android gama baja y escritorio)

**Project Type**: web-app con backend Supabase

**Performance Goals**: sin impacto (misma función, misma complejidad)

**Constraints**: permisos en el servidor (constitución IV); fecha en `America/La_Paz`; migraciones versionadas
(nunca cambios a mano en producción); no `supabase db reset` sin preguntar (usar `supabase migration up`)

**Scale/Scope**: 1 función SQL, 1 test pgTAP, 1 test e2e nuevo, 2 párrafos de la spec 003

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumple | Nota |
|---|---|---|
| I. Campo primero (offline) | ✅ | La Planificación es pantalla de gestión con red; no cambia. |
| II. Rápido en gama baja | ✅ | Sin JS nuevo ni dependencias. |
| III. Embudo fuente de verdad | ✅ | No toca prospectos ni eventos de etapa. |
| IV. Seguridad en la BD | ✅ | La regla sigue en el servidor (`org_can_replan`); la pantalla solo lee `can_replan`. |
| V. Simple y spec-driven | ✅ | Cambio mínimo; la spec 003 (FR-029) se actualiza en el mismo cambio. |

Re-check post-diseño: ✅ sin cambios (ver Complexity Tracking: vacío).

## Project Structure

### Documentation (this feature)

```text
specs/018-encargada-edita-hoy/
├── spec.md
├── plan.md              # este archivo
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── rpc.md
├── checklists/
│   └── requirements.md
└── tasks.md             # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 20261123000100_org_replan_same_day.sql   # NUEVA: redefine org_can_replan (>=)
└── tests/
    └── org_assignments_test.sql                 # CAMBIA: hoy permitido, ayer bloqueado

tests/e2e/
└── planning-same-day.spec.ts                    # NUEVO: encargada edita y quita hoy; ayer sin botones

specs/003-organizacion-comercial/spec.md         # CAMBIA: FR-029 y caso borde «hoy o pasada»
```

**Structure Decision**: Solo backend + tests. `src/features/organization/OrganizationPage.tsx` ya muestra «Editar» y
«✕» según `r.can_replan`, así que no se toca.

## Complexity Tracking

Sin violaciones de la constitución.
