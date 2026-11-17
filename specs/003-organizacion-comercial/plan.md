# Implementation Plan: Organización comercial por sucursal

**Branch**: `003-organizacion-comercial` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-organizacion-comercial/spec.md`

## Summary

Reemplazar la planilla Excel de organización diaria por la pantalla Planificación de la app. Se agregan un catálogo
de tres niveles (Estrategia → Canal → Subcanal) con horario sugerido por subcanal y una tabla de asignaciones
(una persona, un turno, un canal, una meta y un resultado manual). La pantalla muestra las asignaciones en una
tabla con filtros por columna, totales y exportación a Excel. Las actividades de la Planificación anterior quedan
como historial de solo lectura.

Enfoque técnico: cuatro tablas nuevas en Postgres con acceso solo por funciones `security definer`, una carpeta
nueva `src/features/organization/` con carga diferida, y filtros y totales calculados en el navegador. No entra
ninguna dependencia nueva. Las decisiones están en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript ~5.9 (strict) en el frontend; SQL y PL/pgSQL (Postgres 15 de Supabase) en la base

**Primary Dependencies**: React 18, TanStack Router, TanStack Query, `@supabase/postgrest-js`, Tailwind 4, Radix (Dialog, Select), `exceljs` (ya instalado, carga bajo demanda)

**Storage**: Postgres (Supabase) con Row Level Security; migraciones en `supabase/migrations/`

**Testing**: Vitest (lógica pura), pgTAP con `supabase test db` (permisos y RPC), Playwright (flujo completo)

**Target Platform**: PWA en navegador; celulares Android de gama baja y computadoras de oficina

**Project Type**: Aplicación web (frontend estático + Supabase)

**Performance Goals**: Abrir la organización de una sucursal y una semana en menos de 2 s con 3G; filtrar sin esperar al servidor

**Constraints**: JS inicial ≤170 KB gzip (la feature completa va en rutas diferidas); permisos aplicados en la base; requiere conexión

**Scale/Scope**: 10 sucursales, unas 300 asignaciones por día y 9 000 por mes; 3 pantallas (organización, historial, catálogo), 4 tablas, 6 RPC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. Campo primero (offline) | Cumple | La organización es gestión de oficina y requiere conexión, igual que Metas y Repartir. El registro de captaciones sin señal no se toca; solo deja de consultar la actividad en curso (research R13, R14). |
| II. Rápido en gama baja | Cumple | Todo va en rutas con carga diferida; `exceljs` se carga al exportar. Ninguna dependencia nueva. Se verifica con `pnpm size`. |
| III. El embudo es la fuente de verdad | Cumple | No se toca el embudo ni sus eventos. Meta y resultado de una asignación son datos de planificación escritos a mano por decisión del usuario (FR-014), con historial de cambios en `audit_log`. |
| IV. Seguridad en la base | Cumple | RLS en las cuatro tablas; las asignaciones solo se leen y escriben por RPC que validan rol, sucursal, estado activo y fecha. |
| V. Simple y spec-driven | Cumple | Spec, aclaraciones y plan antes del código. Sin tabla de horarios aparte, sin estados, sin filtros en servidor (research R3, R9). |

**Punto a registrar**: la constitución IV dice que el supervisor «solo crea captaciones». Eso se refiere a los
prospectos y no cambia. Que el supervisor gestione la organización de su sucursal es un permiso nuevo y separado
(`manages_org`), decidido por el usuario el 2026-11-17. No requiere cambiar la constitución, pero conviene
mencionarlo en la revisión.

**Revisión después del diseño**: sin cambios; los cinco principios siguen cumpliéndose. No hay violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/003-organizacion-comercial/
├── spec.md
├── insumos-excel.md         # contenido de la planilla de ventas
├── plan.md                  # este archivo
├── research.md              # decisiones técnicas
├── data-model.md            # tablas, reglas y funciones de apoyo
├── quickstart.md            # validación de punta a punta
├── contracts/
│   ├── rpc.md
│   ├── ui-routes.md
│   └── excel-export.md
├── checklists/requirements.md
└── tasks.md                 # lo crea /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   ├── 20261117000100_org_catalog.sql        # 3 tablas de catálogo, RLS y catálogo inicial
│   ├── 20261117000200_org_assignments.sql    # tabla, funciones de permisos y RPC
│   └── 20261117000300_agenda_readonly.sql    # la Planificación anterior pasa a solo lectura
└── tests/
    ├── org_catalog_test.sql
    ├── org_assignments_test.sql
    └── agenda_test.sql                       # se actualiza: ya no se puede escribir

src/
├── app/
│   ├── router.tsx                            # rutas nuevas y roles
│   └── AppShell.tsx                          # entradas de menú
├── features/
│   ├── organization/                         # NUEVA
│   │   ├── api.ts                            # tipos y hooks de las RPC y del catálogo
│   │   ├── logic.ts                          # filtros, totales, cruce de horarios, horario sugerido
│   │   ├── OrganizationPage.tsx              # rango, sucursales, filtros, totales, tabla o tarjetas
│   │   ├── AssignmentDialog.tsx              # alta y edición
│   │   ├── ResultDialog.tsx                  # resultado y observaciones
│   │   ├── CatalogPage.tsx                   # administración del catálogo
│   │   └── exportOrganization.ts             # Excel
│   ├── agenda/
│   │   ├── PlanningPage.tsx                  # queda como historial de solo lectura
│   │   └── currentActivity.ts                # se elimina
│   ├── capture/RegisterHome.tsx              # deja de consultar la actividad en curso
│   └── auth/types.ts                         # constantes de roles para la organización

tests/
├── unit/organization.test.ts
└── e2e/
    ├── organization.spec.ts
    └── planning.spec.ts                      # se reescribe: historial de solo lectura
```

**Structure Decision**: Se mantiene la estructura del proyecto (una carpeta por feature en `src/features/`,
migraciones y pruebas pgTAP en `supabase/`). La feature vive en `src/features/organization/`; de `agenda/` solo
queda la vista de historial.

## Orden de construcción

1. **Base**: catálogo, asignaciones, permisos y RPC, con sus pruebas pgTAP.
2. **Historia 1 y 2 (P1)**: pantalla con carga de asignaciones y registro de resultados. Es el mínimo que reemplaza la planilla.
3. **Historia 3 (P2)**: rango, varias sucursales, filtros y totales.
4. **Historia 4 (P2)**: pantalla de catálogo.
5. **Historia 5 (P3)**: exportación.
6. **Cierre**: Planificación anterior a solo lectura, menú por rol, limpieza de Registrar, pruebas de punta a punta y peso del bundle.

## Riesgos

| Riesgo | Efecto | Qué se hace |
|---|---|---|
| Se pierde el conteo automático de captaciones contra la meta y el aviso de actividad en curso en Registrar | Los encargados dejan de ver cuántas captaciones lleva cada actividad | Es consecuencia directa de dos decisiones del usuario (resultado manual y catálogos separados). Se informa antes de implementar. El conteo del día por sucursal sigue en Panel y Metas. |
| Las personas de la planilla no tienen usuario | No se las puede asignar | Paso de puesta en marcha en quickstart; la pantalla Usuarios ya lo permite. |
| Dos jefes de ventas en una misma sucursal | La columna Gerente muestra solo uno | `branch_lead` elige el primero por nombre; se documenta. |
| Las migraciones de monitoreo que faltan en `main` | Vistas de `/gestion` y calendario de `/repartir` fallan en local | Fuera de alcance; no afecta a esta feature. Hay que pedirlas a Fer antes de salir a producción. |
| Numeración de migraciones con otras ramas (`20261107000400` de mapa, `20261116000100` de cuenta única) | Orden de aplicación | Las nuevas usan `20261117…`, posteriores a todas. |

## Complexity Tracking

Sin violaciones de la constitución que justificar.
