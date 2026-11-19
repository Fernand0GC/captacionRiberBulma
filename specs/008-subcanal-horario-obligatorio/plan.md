# Implementation Plan: Subcanal y horario obligatorios (008)

**Branch**: `008-subcanal-horario-obligatorio` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

## Summary

Regla en la base (`org_upsert`) y en el formulario: horas obligatorias; subcanal obligatorio si el canal tiene
subcanales activos; marcado automático del subcanal único. Una migración que solo reemplaza `org_upsert`.

## Technical Context

**Language/Version**: TypeScript ~5.9 strict; PL/pgSQL (Postgres 15, Supabase)
**Primary Dependencies**: sin dependencias nuevas
**Storage**: migración `20261119000200_subcanal_horario_obligatorio.sql` (solo `org_upsert`)
**Testing**: pgTAP, Vitest, Playwright (`--workers=1`)
**Constraints**: JS inicial ≤ 170 KB gzip

## Constitution Check

| Principio | Estado | Nota |
|---|---|---|
| I–III | Cumple | No toca el registro de campo ni el embudo. |
| IV. Seguridad en la base | Cumple | La regla vive en `org_upsert` (`security definer`); el formulario solo da mensajes claros. |
| V. Simple | Cumple | Dos `raise` en la base; dos funciones puras en `logic.ts` con pruebas. |

## Decisiones (research)

- **R1 · Dónde validar**: en `org_upsert` (común a `org_save` y `org_save_many`), después de `org_check`:
  `v_start`/`v_end` nulos → `invalid_input`/`time`; `v_sub` nulo y el canal con subcanal activo → `invalid_input`/`subchannel`.
  `org_set_result` y `org_copy_day_v2` no pasan por ahí (FR-007).
- **R2 · Subcanal único**: `onlySubchannel(cat, channelId)` devuelve el id si el canal tiene exactamente un subcanal
  activo. Al elegir el canal (solo al crear) se marca y se propone su horario con `withTimes`.
- **R3 · «Tiene subcanales»**: `hasSubchannels(cat, channelId)` = al menos uno activo; la base usa la misma regla.

## Project Structure

```text
supabase/migrations/20261119000200_subcanal_horario_obligatorio.sql
supabase/tests/subcanal_horario_test.sql
src/features/organization/logic.ts            hasSubchannels · onlySubchannel
src/features/organization/AssignmentDialog.tsx  marcado automático · validaciones · títulos con *
tests/unit/organization.test.ts · tests/e2e/organization.spec.ts
```

## Deploy

1. Pegar `RB-union/migraciones-008-produccion.sql` en el SQL Editor de producción.
2. Unir a `main` y push (Vercel publica).
