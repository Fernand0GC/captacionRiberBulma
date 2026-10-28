# Implementation Plan: MVP de captación de clientes

**Branch**: `001-captacion-mvp` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-captacion-mvp/spec.md`

## Summary

PWA de captación para unos 90 usuarios en 10 sucursales. El modo de campo es **solo de escritura** y funciona sin señal:
las captaciones se guardan en un outbox local (IndexedDB) y se suben con una RPC idempotente. El módulo de gestión (encargado, gerente y admin)
permite listar, editar, asignar el seguimiento, mover las etapas, armar la agenda y las metas, y exportar el Excel con la estructura de `Unificado.xlsx`.
El backend es Supabase (proyecto nuevo): los permisos se aplican con RLS y RPC `security definer`, el teléfono es único global por índice parcial,
y los cambios de etapa, las gestiones y las asignaciones se guardan como eventos que no se pueden modificar.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), SQL (PostgreSQL 15+, Supabase), Deno para la Edge Function

**Primary Dependencies**: React 18.3, Vite, TanStack Router, Dexie, vite-plugin-pwa (Workbox), Tailwind CSS 4, @supabase/auth-js + @supabase/postgrest-js (R6b); carga lazy: TanStack Query, TanStack Table, ExcelJS (y Radix solo si gestión lo necesita)

**Storage**: Supabase Postgres (proyecto nuevo, `sa-east-1`); IndexedDB en el dispositivo solo para el outbox

**Testing**: Vitest, pgTAP (`supabase test db`), Playwright (offline con `setOffline`), Lighthouse CI y size-limit

**Target Platform**: Chrome Android (gama baja) como PWA instalable; navegadores de escritorio para el módulo de gestión

**Project Type**: web app (SPA estática + BaaS)

**Performance Goals**: registrar en ≤45 s (SC-001); `/registrar` interactivo en ≤3 s con 3G (SC-004); sync en ≤2 min al volver la red (SC-003); 90 usuarios en simultáneo (SC-006)

**Constraints**: offline-first para el campo; ≤170 KB gzip de JS inicial; los datos de clientes no quedan en el dispositivo después de confirmados; teléfono único global; RLS en todas las tablas; sin conexión a las bases de riber-bulma

**Scale/Scope**: unos 90 usuarios, 10 sucursales, 2 turnos; decenas de miles de prospectos al año; unas 15 pantallas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumple | Cómo |
|---|---|---|
| I. Campo primero (offline) | ✔ | Outbox en IndexedDB, id UUID v7 del cliente, `submit_capture` idempotente, sync sin bloquear la UI (R4, contracts/sync.md). Los conflictos no aplican: el campo es solo de escritura; la gestión es online con el último que escribe gana y auditoría. |
| II. Rápido en gama baja | ✔ | `/registrar` es el único bundle inicial; todo lo demás es lazy; ExcelJS y TanStack Table solo se cargan al usarse; size-limit y Lighthouse en CI (R3, R15). |
| III. El embudo es la fuente de verdad | ✔ | `stage` se cambia solo con `change_stage`; `stage_events`, `followups` y `assignment_events` son solo inserción; el avance de metas se calcula de eventos y etapas (R11, R14). |
| IV. Seguridad en la base | ✔ | Identidad del JWT verificado; rol, sucursal y estado activo leídos de `profiles` en cada política (R8), como pide la constitución v1.1.0. El campo solo crea; el responsable ve sus asignados; el encargado, su sucursal. Búsqueda fuera de la URL; teléfonos fuera de logs; `phone_available`, `submit_capture` y `my_rejections` con límite de llamadas y sin exponer datos (R10). |
| V. Simple y spec-driven | ✔ | Sin servidor propio; un solo proyecto; sin motor de sync bidireccional; Background Sync, GPS y recaptación quedan para la v2. |
| Stack y restricciones | ✔ | Vite + React 18 + TS, PWA, Dexie, TanStack Query, Supabase nuevo, migraciones en `supabase/migrations/`, hosting estático (Vercel). |

**Re-check post-diseño (después de la fase 1)**: ✔ sin violaciones (constitución v1.1.0, después de `/speckit-analyze` del 2026-10-27).

## Project Structure

### Documentation (this feature)

```text
specs/001-captacion-mvp/
├── spec.md
├── plan.md              # este archivo
├── research.md          # fase 0
├── data-model.md        # fase 1
├── quickstart.md        # fase 1
├── contracts/
│   ├── rpc.md           # funciones Postgres + Edge Function admin-users
│   ├── sync.md          # outbox y protocolo de sincronización
│   ├── excel-export.md  # hojas y columnas del Excel
│   └── ui-routes.md     # rutas, roles y pantallas
├── checklists/requirements.md
└── tasks.md             # fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── main.tsx
├── app/                  # router, providers, layout, guards por rol
├── lib/                  # supabase client, phone (normalizar y validar), uuidv7, dates (La Paz, turno), errors
├── ui/                   # componentes compartidos (Button, Field, Select, Dialog, Badge, Toast)
└── features/
    ├── auth/             # login, sesión, perfil, usuario desactivado
    ├── sync/             # Dexie db, outbox, sender, indicadores
    ├── capture/          # /registrar y /registrar/nuevo (bundle inicial)
    ├── followup/         # /seguimiento: bandeja, ficha, gestión, cambio de etapa
    ├── prospects/        # /gestion: listado, ficha, edición, asignación, duplicados
    ├── agenda/           # /agenda
    ├── goals/            # /metas
    ├── export/           # /exportar (ExcelJS lazy)
    └── admin/            # /admin/usuarios, /admin/catalogos

supabase/
├── config.toml
├── migrations/           # enums, catálogos, profiles, prospects, eventos, agenda, metas, vistas, RLS, RPC
├── seed.sql              # sucursales, catálogos y usuarios de prueba (solo local)
├── functions/admin-users/
└── tests/                # pgTAP: rls_matrix, submit_capture, change_stage, phone, goals

tests/
├── unit/                 # Vitest
└── e2e/                  # Playwright (offline, permisos, export)
```

**Structure Decision**: un solo proyecto web (SPA) con el backend declarativo en `supabase/`. Se organiza por feature para poder separar
el bundle inicial (`capture`, `sync`, `auth`) del resto, que se carga lazy.

## Fases de entrega sugeridas (insumo para `/speckit-tasks`)

1. **Base**: scaffold, Supabase local, enums, catálogos, profiles, helpers RLS, login, guard por rol, Edge Function `admin-users` (crear usuario).
2. **US1 Registro de campo (P1)**: `prospects`, `submit_capture`, `phone_available`, `my_capture_stats`, outbox y sync, `/registrar`, PWA. Se puede hacer piloto con solo esto.
3. **US2 Gestión (P1)**: vistas, listado, filtros, ficha, `update_prospect`, auditoría, duplicados, `void_prospect`.
4. **US3 Seguimiento (P2)**: asignación, bandeja, `add_followup`, `change_stage`.
5. **US7 Usuarios (P2)**: pantallas de admin, baja y reactivación, catálogos.
6. **US4 Agenda (P2)** y **US6 Exportar (P2)**.
7. **US5 Metas (P3)** y la hoja GERENCIA.
8. **Piloto** en una sucursal con celulares reales antes del despliegue a las 10 sucursales.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Reloj del celular mal configurado | Fechas futuras se recortan a `received_at + 10 min`; el día del contador se calcula en el servidor |
| Se borran los datos del navegador con pendientes | Aviso de pendientes visible; se pide la PWA instalada (storage persistente con `navigator.storage.persist()`) |
| Bloqueo de duplicados por número compartido (familia) | El encargado ve el duplicado y puede contactar; la regla de negocio la pidió el usuario |
| Catálogo de productos incompleto hasta tener el Excel actual | Los catálogos los edita el admin y no dependen de un deploy |
| Supabase con plan Free se pausa por inactividad | Usar plan Pro para producción |

## Complexity Tracking

Sin violaciones de la constitución que justificar.
