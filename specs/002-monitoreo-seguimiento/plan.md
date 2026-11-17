# Implementation Plan: Monitoreo de seguimiento y actividad del personal

**Branch**: `002-monitoreo-seguimiento` | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-monitoreo-seguimiento/spec.md`

## Summary

Dos vistas nuevas dentro de `/gestion` (encargado, jefe de ventas, gerente, Sistemas): **Seguimientos** (un cliente por fila con su último contacto, observación, intentos y vencimiento, con pestañas por estado) y **Actividad** (una fila por persona con conteos de contactos por forma y resultado, y detalle al tocar). Además, un resumen de contactos por persona en la ficha del cliente.

Enfoque: **sin tablas ni columnas nuevas**. Tres RPC de solo lectura (`security definer`, alcance por `scoped_branch`) que calculan todo desde `prospects` y `followups`. El frontend agrega las vistas como componentes lazy dentro de `ProspectsPage` (parámetro `ver` de la URL), y el resumen por persona se calcula en el cliente a partir del `timeline` que ya devuelve `get_prospect`.

## Technical Context

**Language/Version**: TypeScript 5 (strict) + React 18.3; SQL (PostgreSQL 15, Supabase)

**Primary Dependencies**: existentes — @tanstack/react-router, @tanstack/react-query, @radix-ui/react-dialog, exceljs (lazy), react-icons. **Sin dependencias nuevas.**

**Storage**: Supabase Postgres. Lectura de `prospects`, `followups`, `profiles`, `profile_branches`, `lost_reasons`, `channels`. Sin cambios de esquema.

**Testing**: pgTAP (`supabase/tests/*.sql`, `pnpm db:test`), Vitest (`tests/unit`), Playwright (`tests/e2e`).

**Target Platform**: PWA; celular Android gama baja (3G) y escritorio.

**Project Type**: web app (SPA + Supabase).

**Performance Goals**: cada vista responde en < 2 s en 3G con sucursales de varios miles de clientes (SC-006). Seguimientos pagina de a 50; Actividad devuelve una fila por persona (decenas).

**Constraints**: JS inicial ≤ 170 KB gzip, sin crecer (vistas en chunks lazy, SC-007); nombre y celular de clientes nunca en la URL; permisos en el servidor; fechas en `America/La_Paz`.

**Scale/Scope**: 10 sucursales; hasta ~10–20 mil clientes vigentes en "Todas"; ~10–40 personas por sucursal; 3 RPC, ~6 componentes nuevos, 1 migración.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumple | Cómo |
|-----------|--------|------|
| I. Campo primero (offline) | ✅ | Pantallas de gestión, solo lectura y con señal, igual que `/gestion` hoy. No toca la cola offline. Los contactos que llegan tarde cuentan por `contacted_at` (cuándo se hicieron). |
| II. Rápido en gama baja | ✅ | Vistas y exportadores en chunks lazy; exceljs ya se carga lazy; cero dependencias nuevas. Paginación de 50; agregados calculados en SQL. |
| III. Embudo fuente de verdad | ✅ | Todo sale de `followups` (inmutable) y de la etapa actual; ningún contador nuevo. `contact_attempts` ya existe y lo mantiene `add_followup`. |
| IV. Seguridad en la BD | ✅ | RPC `security definer` con `app_is_active() and is_manager()` + `scoped_branch()`; `revoke` a `public, anon`. URL solo con ids de personal/sucursal/catálogo y filtros; la búsqueda viaja por POST. |
| V. Simple y spec-driven | ✅ | Sin tablas, sin vistas materializadas, sin caché nueva. El resumen por persona de la ficha reutiliza el `timeline` existente. |

Resultado: **PASA** (pre y post diseño). Sin entradas en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-monitoreo-seguimiento/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rpc.md
│   ├── ui-routes.md
│   └── excel-export.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   ├── 20261114000100_followup_status.sql # list_followup_status (US1)
│   └── 20261114000200_agent_activity.sql  # agent_activity, list_agent_contacts (US2, US3)
└── tests/
    ├── followup_status_test.sql           # pgTAP US1: alcance por rol, pestañas, orden, exclusiones
    └── agent_activity_test.sql            # pgTAP US2/US3: conteos por actor, filas en cero, detalle

src/
├── features/
│   ├── prospects/
│   │   ├── ProspectsPage.tsx              # toggle: + Seguimientos, Actividad; monta vistas lazy
│   │   ├── ManageFilterBar.tsx            # NUEVO: filtros comunes extraídos de ProspectsPage
│   │   └── search.ts                      # + ver, estado, interes, intentos, vencidos, sin_contacto, motivo, persona, metrica, orden
│   ├── monitoring/                        # NUEVO
│   │   ├── api.ts                         # hooks de las 3 RPC + fetchAll para Excel
│   │   ├── labels.ts                      # pestañas, métricas, etiquetas de forma/resultado
│   │   ├── activity.ts                    # puro: totales, orden por columna
│   │   ├── FollowupStatusView.tsx         # vista Seguimientos (tabla escritorio / tarjetas celular)
│   │   ├── ActivityView.tsx               # vista Actividad (columna nombre fija)
│   │   ├── AgentContactsDialog.tsx        # detalle de contactos de una persona/métrica
│   │   ├── exportFollowups.ts             # Excel Seguimientos (lazy)
│   │   └── exportActivity.ts              # Excel Actividad (lazy)
│   └── client/
│       ├── ClientPage.tsx                 # + bloque "Contactos por persona" arriba del Historial
│       └── contactSummary.ts              # NUEVO, puro: agrupa timeline por actor y forma
tests/
├── unit/
│   ├── search.test.ts                     # + parámetros nuevos
│   ├── activity.test.ts                   # totales y orden
│   └── contactSummary.test.ts
└── e2e/
    └── monitoring.spec.ts
```

**Structure Decision**: misma organización por feature del MVP. La lógica nueva va en `src/features/monitoring/`; `ProspectsPage` solo enruta por `ver` y comparte la barra de filtros. Funciones puras separadas para probarlas con Vitest.

## Complexity Tracking

Sin violaciones.
