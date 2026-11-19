# Implementation Plan: Observaciones del grupo de ventas del 2026-11-19 (007)

**Branch**: `007-ajustes-ventas-3` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

## Summary

Copia de días sin duplicados (con confirmación y conteo), «Guardar» a prueba de doble toque, error visible junto a
los botones, aviso de cruce con el nombre de la otra asignación, filtro Turno en «Tarde» por la tarde, meta de
compartidas opcional y tabla compacta de la Planificación (15 → 6 columnas). Una migración que solo reemplaza
funciones (sin cambios de tablas) y cambios en `src/features/organization/`. Decisiones en [research.md](./research.md);
RPC en [contracts/rpc.md](./contracts/rpc.md). No hay data-model nuevo: no cambia ninguna tabla.

## Technical Context

**Language/Version**: TypeScript ~5.9 strict; SQL/PL-pgSQL (Postgres 15, Supabase)
**Primary Dependencies**: React 18, TanStack Router/Query, Tailwind 4, Radix, exceljs (diferido). Ninguna nueva.
**Storage**: Postgres con RLS; migración `20261119000100_ajustes_ventas_3.sql` (solo funciones)
**Testing**: pgTAP, Vitest, Playwright (`--workers=1` en este Docker)
**Constraints**: JS inicial ≤ 170 KB gzip; deploy en cualquier orden con la app publicada (research R1); sin edge functions
**Scale/Scope**: 1 migración, 1 RPC nueva, 2 cambiadas, ~4 archivos de frontend

## Constitution Check

| Principio | Estado | Nota |
|---|---|---|
| I. Campo primero | Cumple | No toca el registro de campo. |
| II. Gama baja | Cumple | Sin dependencias; la tabla compacta pinta menos celdas. |
| III. Embudo | Cumple | No toca el embudo. |
| IV. Seguridad en la base | Cumple | Las reglas (sin duplicados, meta opcional) se aplican en las RPC `security definer`; permisos sin cambio (`manages_org`). |
| V. Simple | Cumple | Sin tablas nuevas ni índice único (research R2); agrupación visual en `logic.ts` con pruebas. |

Re-evaluado después del diseño: sin cambios.

## Project Structure

```text
supabase/migrations/20261119000100_ajustes_ventas_3.sql   org_upsert (meta comp. opcional) · org_copy_day (sin duplicados) · org_copy_day_v2 (NUEVA)
supabase/tests/ajustes_ventas_3_test.sql
src/features/organization/api.ts                copyDayV2 → { copied, skipped }
src/features/organization/logic.ts              overlaps con nombres e «igual» · sameSlot · groupRows (sucursal → persona → carga) · defaultShiftFilter · parseGoal opcional
src/features/organization/AssignmentDialog.tsx  error en el pie fijo · foco al campo · guardado único · aviso de cruce · meta comp. opcional
src/features/organization/OrganizationPage.tsx  confirmación y conteo al copiar · encabezado sucursal/gerente/fecha · tabla compacta · filtro Turno inicial
tests/unit/organization.test.ts · tests/e2e/organization.spec.ts
```

## Deploy

1. Pegar la migración en el SQL Editor de producción (la app publicada sigue funcionando: `org_copy_day` mantiene su firma).
2. Publicar la app (usa `org_copy_day_v2`).
3. Limpiar a mano los duplicados existentes con la consulta de [quickstart.md](./quickstart.md).
