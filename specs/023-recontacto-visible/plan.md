# Implementation Plan: Recontacto visible para jefas

**Branch**: `023-recontacto-visible` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/023-recontacto-visible/spec.md`

## Summary

Tres cambios de solo lectura para que las jefas vean la recaptación:

1. **Del día → Agenda de recontacto** (P1): una RPC nueva, `recontact_agenda`, devuelve los clientes que pueden estar en la
   agenda de hoy y las personas del alcance. La app los clasifica con `dueStatus`, la misma función de «Mis contactos»,
   y arma la tabla Le tocaba hoy · Contactó · Pendientes · Atrasados con un detalle por persona.
2. **Actividad → Primer contacto / Recontacto** (P2): `agent_activity` cuenta `first_contacts` y `recontacts`
   (recontacto = el cliente ya tenía un contacto anterior de cualquier persona), y `list_agent_contacts` abre el detalle
   de cada uno.
3. **Seguimientos → Contar por** (P3): `list_followup_status` acepta `date_basis` (registro, asignación, último contacto,
   próximo contacto). En la URL va como `contar`.

Las decisiones están en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict) · React 18 · SQL (PostgreSQL 15, Supabase)

**Primary Dependencies**: TanStack Query/Router, Tailwind, exceljs (ya cargado lazy en los Excel); sin dependencias nuevas

**Storage**: Postgres (Supabase). Una RPC nueva y 3 RPC parcheadas; sin tablas, columnas ni índices nuevos

**Testing**: Vitest (`tests/unit/agenda.test.ts` y `tests/unit/activity.test.ts` nuevos o ampliados, `tests/unit/search.test.ts` si existe) · pgTAP
(`supabase/tests/recontacto_test.sql` nuevo) · Playwright (`tests/e2e/recontacto.spec.ts` nuevo)

**Target Platform**: PWA; las vistas de /gestion se usan sobre todo en computadora, pero tienen que funcionar en celular

**Project Type**: web app (SPA + Supabase)

**Performance Goals**: «Del día» con agenda < 3 s para una sucursal con 500 clientes abiertos (SC-006)

**Constraints**: JS inicial ≤ 170 KB gzip (las vistas de /gestion ya son rutas lazy); hora de Bolivia en todo

**Scale/Scope**: hasta ~5000 filas de agenda en «Todas las sucursales» (tope con aviso `truncated`)

## Constitution Check

| Principio | Cumple | Cómo |
|---|---|---|
| I. Campo primero | ✅ | Solo lecturas de gestión; no cambia la escritura de campo ni la cola offline |
| II. Rápido en gama baja | ✅ | Sin dependencias nuevas; código en rutas lazy de /gestion; filtro previo en el servidor (R3) |
| III. Embudo / eventos | ✅ | Todo se calcula de `followups`, `assignment_events` y el estado del cliente; nada se guarda aparte |
| IV. Seguridad en BD | ✅ | RPC `security definer` con `app_is_active() and is_manager()` y `scoped_branch()`, igual que «Del día»; los celulares van por RPC, nunca en la URL (`contar` no es dato personal) |
| V. Simple y spec-driven | ✅ | Parches mínimos con `patch_function`; la regla de agenda se reusa (R1); spec, contratos y CLAUDE.md se actualizan |

Re-check post-diseño: sin violaciones; no hace falta Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/023-recontacto-visible/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/rpc.md · contracts/ui.md
├── checklists/requirements.md
└── tasks.md   (/speckit-tasks)
```

### Source Code

```text
supabase/migrations/20261124000100_recontacto_visible.sql   # nuevo: recontact_agenda + parches
supabase/tests/recontacto_test.sql                          # nuevo: pgTAP
src/features/followup/dueStatus.ts                          # DueInput (tipo mínimo), sin cambio de lógica
src/features/monitoring/agenda.ts                           # nuevo: lógica pura (clasificar, agrupar, totales)
src/features/monitoring/AgendaSection.tsx                   # nuevo: tabla por persona + detalle
src/features/monitoring/api.ts                              # useRecontactAgenda, tipos; date_basis; first/recontacts
src/features/monitoring/DailyView.tsx                       # monta AgendaSection
src/features/monitoring/exportDaily.ts                      # hoja «Agenda» (solo hoy)
src/features/monitoring/labels.ts                           # métricas first_contacts / recontacts
src/features/monitoring/activity.ts                         # KEYS con las métricas nuevas
src/features/monitoring/ActivityView.tsx, BranchActivityTable.tsx, AgentContactsDialog.tsx, exportActivity.ts
src/features/monitoring/FollowupStatusView.tsx              # selector «Contar por» y texto del total
src/features/monitoring/exportFollowups.ts                  # título según la fecha contada
src/features/prospects/search.ts                            # parámetro `contar` en la URL
tests/unit/agenda.test.ts · tests/unit/activity.test.ts      # Vitest
tests/e2e/recontacto.spec.ts                                # Playwright
../migraciones-023-produccion.sql                           # raíz de RB-union, para cuando se autorice
```

**Structure Decision**: misma estructura por feature. La lógica nueva va en `agenda.ts` (pura, testeable sin React) y la
sección en un componente aparte para no hacer crecer `DailyView.tsx` (438 líneas).
