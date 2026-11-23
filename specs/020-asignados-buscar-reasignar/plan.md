# Implementation Plan: Buscar y reasignar en «Clientes asignados»

**Branch**: `020-asignados-buscar-reasignar` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/020-asignados-buscar-reasignar/spec.md`

## Summary

Lupa por nombre o celular en el modal «Clientes asignados» de Actividad y en «Mis contactos», y reasignación de los
clientes sin contactar desde el modal. Se reutiliza `useAssignSelection` (`AssignSelection.tsx`) y `assign_prospects`
sin crear lógica paralela; `list_agent_assigned` agrega `phone_raw`, `phone_norm` y `branch_id`. La búsqueda es un
filtro en memoria con un helper puro compartido. `AssignedPanel.tsx` se ordena en piezas para que la 021 lo extienda.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18; SQL PL/pgSQL (Postgres 15, Supabase)

**Primary Dependencies**: TanStack Query/Router, Tailwind; ninguna dependencia nueva

**Storage**: Supabase Postgres; sin cambios de esquema (solo `create or replace` de una función de lectura)

**Testing**: Vitest (unit), pgTAP (`supabase test db`), Playwright (Pixel 7, contra `pnpm preview` en :4173)

**Target Platform**: PWA en Android gama baja y escritorio

**Project Type**: web app (SPA + Supabase)

**Performance Goals**: filtrar ≤ 500 filas en memoria por tecla (< 16 ms); sin consultas nuevas al buscar

**Constraints**: JS inicial ≤ 170 KB gzip (el modal ya es parte de /gestion; se suman pocas líneas); datos personales
fuera de la URL

**Scale/Scope**: ≤ 500 asignados por modal; decenas a cientos de contactos por auxiliar

## Constitution Check

| Principio | Cumple | Nota |
|---|---|---|
| I. Campo primero | ✅ | Pantallas de gestión; Mis contactos solo agrega un filtro local que no bloquea ni escribe. Reasignar es de gestión y requiere red (como en Captaciones). |
| II. Rápido en gama baja | ✅ | Sin dependencias; filtro en memoria. |
| III. Embudo fuente de verdad | ✅ | Reasignar deja `assignment_events`; los números de Actividad se siguen calculando de eventos (no cambian). |
| IV. Seguridad en la BD | ✅ | Permisos en `assign_prospects`/`list_agent_assigned` (servidor). El celular solo sale a quien ya ve la lista (gerencia de esa sucursal). Búsqueda solo en estado, no en URL. |
| V. Simple y spec-driven | ✅ | Reutiliza la selección y RPC existentes; contratos y CLAUDE.md se actualizan en el mismo cambio. |

Re-evaluado tras el diseño: sin violaciones. Complexity Tracking vacío.

## Project Structure

### Documentation (this feature)

```text
specs/020-asignados-buscar-reasignar/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/rpc.md · contracts/ui.md
├── checklists/requirements.md
└── tasks.md   (/speckit-tasks)
```

### Source Code

```text
supabase/migrations/20261123002000_agent_assigned_phone_branch.sql   # nuevo: list_agent_assigned + 3 campos
supabase/tests/agent_assigned_test.sql                               # + aserciones 020
src/lib/search.ts                                                    # + matchesNameOrPhone
src/features/prospects/AssignSelection.tsx                           # + opciones layout / noBranchText (compatibles)
src/features/monitoring/api.ts                                       # AgentAssignedRow + phone_raw, phone_norm, branch_id
src/features/monitoring/assigned.ts                                  # filtro q, reassignable, singleBranch
src/features/monitoring/AssignedPanel.tsx                            # piezas + lupa + selección
src/features/monitoring/AgentContactsDialog.tsx                      # pasa la persona al panel
src/features/followup/InboxPage.tsx                                  # lupa
tests/unit/assigned.test.ts · tests/unit/search.test.ts
tests/e2e/monitoring.spec.ts · tests/e2e/followup.spec.ts            # un test nuevo en cada uno
```

**Structure Decision**: se sigue la estructura existente por feature (`src/features/*`) y la carpeta de tests de
cada tipo. No se toca `src/features/organization/` ni archivos de la 018/019.

## Notas de convivencia (otras pestañas)

- Migración con prefijo `20261123002000`; se aplica con `psql` sobre el contenedor, no con `supabase migration up`.
- `.specify/feature.json` no se modifica: los comandos usan `specs/020-asignados-buscar-reasignar` explícito.
- Playwright: `reuseExistingServer: true` reutiliza un preview en :4173 si otra pestaña lo dejó corriendo (con su
  build). Antes de correr e2e se pregunta al usuario.

## Complexity Tracking

Sin violaciones.
