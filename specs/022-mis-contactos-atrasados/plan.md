# Implementation Plan: Mis contactos — atrasados, resumen del día y lista liviana

**Branch**: `022-mis-contactos-atrasados` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/022-mis-contactos-atrasados/spec.md`

## Summary

`my_contacts` suma `assigned_at` (último evento de asignación hacia quien consulta). `dueStatus` marca «Atrasado · asignado
hace N días» a los nunca contactados asignados antes de hoy. «Mis contactos» gana un resumen con 3 tarjetas-filtro, agrupa
«Captados» por día de asignación (hoy primero, grupos plegables), pagina cada lista (10/25/50/100, 25 de entrada, recordado en el navegador), cambia
«Captado» por «Asignado» y deja de repetir el número en el contador de pestaña. Detalle de decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict) · React 18 · SQL (PostgreSQL 15, Supabase)

**Primary Dependencies**: TanStack Query/Router, Tailwind; sin dependencias nuevas

**Storage**: Postgres (Supabase) — solo cambia la RPC `my_contacts`; sin tablas ni columnas nuevas

**Testing**: Vitest (`tests/unit/dueStatus.test.ts`, `tests/unit/inboxView.test.ts` nuevo) · pgTAP (`supabase/tests/my_contacts_assigned_test.sql` nuevo) · Playwright (`tests/e2e/my-contacts-late.spec.ts` nuevo)

**Target Platform**: PWA en Android de gama baja (Pixel 7 en e2e) y escritorio

**Project Type**: web app (SPA + Supabase)

**Performance Goals**: con 400 contactos, ≤ 50 filas dibujadas por lista; respuesta a un toque < 100 ms

**Constraints**: JS inicial ≤ 170 KB gzip (la pantalla ya es una ruta propia; se suman unas decenas de líneas)

**Scale/Scope**: hasta 1000 contactos por persona (límite actual de `my_contacts`)

## Constitution Check

| Principio | Cumple | Cómo |
|---|---|---|
| I. Campo primero | ✅ | Solo lectura en pantalla; no cambia escritura ni cola offline |
| II. Rápido en gama baja | ✅ | Tope de 50 filas por lista y grupos cerrados sin dibujar; sin dependencias nuevas |
| III. Embudo / eventos | ✅ | La fecha sale de `assignment_events` (inmutable); estados se calculan, no se guardan |
| IV. Seguridad en BD | ✅ | Misma RPC `security definer`, mismo filtro `assigned_to = auth.uid()`; sin datos nuevos expuestos |
| V. Simple y spec-driven | ✅ | Parche mínimo a la RPC; funciones puras testeables; spec, contrato y CLAUDE.md se actualizan |

Re-check post-diseño: sin violaciones; no hay Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/022-mis-contactos-atrasados/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/rpc.md
├── checklists/requirements.md
└── tasks.md   (/speckit-tasks)
```

### Source Code

```text
supabase/migrations/20261123002200_my_contacts_assigned_at.sql   # nuevo: parche de my_contacts
supabase/tests/my_contacts_assigned_test.sql                     # nuevo: pgTAP
src/features/followup/api.ts                                     # FollowupRow.assigned_at?
src/features/followup/dueStatus.ts                               # regla «Atrasado · asignado hace N días»
src/features/followup/inboxView.ts                               # nuevo: resumen, grupos por día, contador, PAGE
src/features/followup/SummaryCards.tsx                           # nuevo: 3 tarjetas-filtro
src/features/followup/InboxPage.tsx                              # columna Asignado, grupos, paginador, contador, filtro
tests/unit/dueStatus.test.ts                                     # casos nuevos
tests/unit/inboxView.test.ts                                     # nuevo
tests/e2e/my-contacts-late.spec.ts                               # nuevo
../migraciones-022-produccion.sql                                # en la raíz de RB-union, para cuando se autorice
```

No se tocan: `src/features/monitoring/`, `src/features/organization/`, los tests y migraciones de la 018–021,
`ContactsBadge.tsx` ni `portal/notices.ts` (heredan la regla nueva vía `dueStatus`).

**Structure Decision**: misma estructura de features; lo nuevo de vista va en archivos aparte para no seguir creciendo
`InboxPage.tsx` (463 líneas) y para probar la lógica sin React.
