# Implementation Plan: Depurar «Clientes asignados» (ocultar los ya contactados)

**Branch**: `021-asignados-depurar` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/021-asignados-depurar/spec.md`

## Summary

Gestión (encargada, jefe de ventas, gerente, admin) puede **ocultar** clientes de la lista «Clientes asignados» de una
persona sin borrar nada: una tabla nueva `assigned_hidden` guarda la marca por par (cliente, persona del modal) con
quién y cuándo. Dos RPC `security definer` verifican rol, estado activo y sucursal de cada cliente:
`set_assigned_hidden` (ocultar/mostrar uno o varios) y `hide_assigned_contacted` (el «Ocultar» del aviso: todos los
contactados no ocultos del período, aunque pasen de 500). `list_agent_assigned` (versión 020) suma `hidden` por fila y
`hidden_total` / `contacted_visible` del período. En la UI: aviso en línea al abrir el modal, interruptor «Ver ocultos»
en `AssignedToolbar` y «Ocultar»/«Mostrar» en `AssignedRowItem`. Los números de Actividad salen de
`assignment_events`/`followups`, que no se tocan.

## Technical Context

**Language/Version**: TypeScript 5 (strict) · React 18 · SQL PostgreSQL 15 (Supabase local)

**Primary Dependencies**: TanStack Query (mutaciones e invalidación), Supabase JS (RPC). Sin dependencias nuevas.

**Storage**: Postgres: tabla nueva `public.assigned_hidden` (solo por RPC). `localStorage` solo para recordar
«Mantener» (por quien mira, persona y día).

**Testing**: Vitest (`tests/unit/assigned.test.ts`), pgTAP (`supabase/tests/assigned_hidden_test.sql`, nuevo),
Playwright (`tests/e2e/assigned-hide.spec.ts`, nuevo). TDD: primero fallan, después pasan.

**Target Platform**: PWA en navegador (celular gama baja y escritorio); pantalla de gestión, requiere conexión.

**Project Type**: Web app (SPA + Supabase).

**Performance Goals**: aviso y filtros al instante sobre la lista ya cargada; ocultar en un solo viaje al servidor.

**Constraints**: JS inicial ≤ 170 KB gzip (el modal ya está en la ruta perezosa `/gestion`); sin cambios en los
números de Actividad; migración con prefijo `20261123002100`; no tocar archivos de la 019.

**Scale/Scope**: hasta cientos de asignados por persona y período (lista limitada a 500 filas; el «Ocultar» del aviso
actúa en el servidor sobre todos).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumple | Cómo |
|---|---|---|
| I. Campo primero | ✅ | No es pantalla de campo; ocultar requiere conexión y muestra error si falla (como reasignar en la 020). |
| II. Rápido en gama baja | ✅ | Sin dependencias; código dentro del chunk perezoso de `/gestion`. |
| III. El embudo es la fuente de verdad | ✅ | No toca etapas, contactos ni `assignment_events`; los reportes siguen calculándose de los eventos. La marca de oculto es de vista, no un contador. |
| IV. Seguridad en la BD | ✅ | RLS activo en `assigned_hidden` sin políticas para `authenticated` (solo RPC `security definer`); rol, activo y sucursal se leen del JWT en el servidor en cada llamada (`is_manager`, `manages_branch`). Datos personales no van a la URL ni al `localStorage` (solo ids de personas y fecha). |
| V. Simple y spec-driven | ✅ | Extiende piezas de la 020 sin reescribir; 1 tabla, 2 RPC, 1 versión nueva de `list_agent_assigned`. |

## Project Structure

### Documentation (this feature)

```text
specs/021-asignados-depurar/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/rpc.md · contracts/ui.md
├── checklists/requirements.md
├── seed-demo-021.sql · seed-demo-021-limpiar.sql   # datos para la prueba manual (implement)
└── tasks.md                                       # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/migrations/20261123002100_assigned_hidden.sql   # tabla + 2 RPC + list_agent_assigned (parte de 20261123002000)
supabase/tests/assigned_hidden_test.sql                   # pgTAP nuevo
src/features/monitoring/
├── api.ts            # AgentAssignedRow.hidden, totales, useSetAssignedHidden, useHideAssignedContacted
├── assigned.ts       # filterAssigned (showHidden), reassignable sin ocultos, keepKey/shouldAskHide
├── AssignedPanel.tsx # HideNotice (aviso), «Ver ocultos» en AssignedToolbar, Ocultar/Mostrar en AssignedRowItem
└── AgentContactsDialog.tsx  # pasa hidden_total / contacted_visible al panel
tests/unit/assigned.test.ts            # Vitest (se amplía)
tests/e2e/assigned-hide.spec.ts        # Playwright nuevo
../migraciones-021-produccion.sql      # en la raíz de RB-union, para aplicar con autorización
```

**Structure Decision**: misma estructura que la 020: lógica pura en `assigned.ts`, datos en `api.ts`, UI en las piezas
de `AssignedPanel.tsx`. Archivos de test nuevos para no chocar con otras pestañas (`monitoring.spec.ts` y
`agent_assigned_test.sql` no se tocan).

## Complexity Tracking

Sin violaciones de la constitución.
