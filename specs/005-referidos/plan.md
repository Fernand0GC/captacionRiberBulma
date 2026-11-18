# Implementation Plan: Seguimiento de referidos por origen

**Branch**: `005-referidos` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-referidos/spec.md`

## Summary

Al registrar una captación se puede marcar de quién vino (referidor de la sucursal). Los jefes ven un reporte mensual
por referidor con llegados, seguimiento, compras, conversión, meta,
cumplimiento, detalle de contactos y avance por día, todo calculado de las captaciones y sus eventos de etapa. Los
jefes mantienen la lista de referidores y sus metas.

Enfoque técnico: una migración (tabla de referidores, una de metas, columna en `prospects`, cambios en
`submit_capture`/`update_prospect`/`get_prospect`, tres RPC nuevas) y una carpeta nueva `src/features/referrals/`
con ruta diferida. El registro sin señal incluye la lista de referidores en los catálogos guardados. Decisiones en
[research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript ~5.9 (strict); SQL y PL/pgSQL (Postgres 15 de Supabase)

**Primary Dependencies**: React 18, TanStack Router y Query, `@supabase/postgrest-js`, Dexie (cola de sincronización), Tailwind 4, `exceljs` (diferido). Ninguna nueva.

**Storage**: Postgres con RLS; migración `supabase/migrations/20261118001000_referrals.sql`

**Testing**: pgTAP, Vitest, Playwright

**Target Platform**: PWA; registro en celulares de gama baja (con y sin señal), reporte en oficina

**Project Type**: Aplicación web (frontend estático + Supabase)

**Performance Goals**: Reporte de una sucursal y un mes en < 2 s; elegir el origen agrega < 5 s al registro (SC-002)

**Constraints**: JS inicial ≤ 170 KB gzip (el reporte va diferido; en el formulario de registro solo se suma un selector); registro sin señal

**Scale/Scope**: 10 sucursales, decenas de referidores por sucursal, cientos de referidos por mes

## Constitution Check

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. Campo primero | Cumple | Los referidores viajan en los catálogos guardados en el dispositivo; `referrer_id` va en la cola de sincronización; un origen inválido no bloquea la captación (R3). |
| II. Rápido en gama baja | Cumple | Reporte y administración en ruta diferida; `exceljs` al exportar. Sin dependencias nuevas. |
| III. El embudo es la fuente de verdad | Cumple | Todo número del reporte se calcula de `prospects` y `stage_events`; nadie escribe resultados. Las metas son datos de planificación. |
| IV. Seguridad en la base | Cumple | Reporte y administración solo por RPC con `can_see_referrals`; el encargado queda fuera en el servidor. Celulares solo dentro de la RPC protegida. |
| V. Simple y spec-driven | Cumple | Recompra/Nuevos y duplicados quedan para la 006 (R4); una sola RPC de reporte. |

**Revisión después del diseño**: sin violaciones.

## Project Structure

### Documentation

```text
specs/005-referidos/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/rpc.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
supabase/
├── migrations/20261118001000_referrals.sql
└── tests/referrals_test.sql

src/
├── app/router.tsx · app/AppShell.tsx          # ruta /referidos y menú «Referidos»
├── features/auth/types.ts                     # REFERRAL_ROLES
├── features/capture/
│   ├── useCatalogs.ts                         # referidores en caché (v5)
│   └── CaptureForm.tsx                        # «Es referido» + selector
├── features/sync/db.ts                        # CapturePayload.referrer_id
├── features/client/                           # ficha: mostrar y corregir «Referido por»
└── features/referrals/                        # NUEVA
    ├── api.ts · logic.ts
    ├── ReferralsPage.tsx                      # pestañas Reporte / Referidores y metas
    └── exportReferrals.ts

tests/
├── unit/referrals.test.ts
└── e2e/referrals.spec.ts
```

**Structure Decision**: Carpeta nueva por feature, como el resto del proyecto.
