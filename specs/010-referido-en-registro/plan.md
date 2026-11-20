# Implementation Plan: Marcar el referido al registrar (010)

**Branch**: `010-referido-en-registro` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

## Summary

El formulario de registro muestra siempre «Es referido» y deja escribir quién lo recomendó, con sugerencias de la
sucursal. Si el referidor no existe, viaja dentro del mismo envío de la captación (`referrer_new`) y `submit_capture`
lo busca por nombre normalizado o lo crea, en la misma transacción. Los reportes (005 y 009) no cambian.

## Technical Context

**Language/Version**: TypeScript ~5.9 strict; PL/pgSQL (Postgres 15, Supabase)
**Primary Dependencies**: React 18, Dexie (cola sin señal). Ninguna nueva.
**Storage**: migración `20261120000200_referrer_on_capture.sql` (función `referrer_key`, índice único nuevo, columna `referrers.source`, parche de `submit_capture`)
**Testing**: pgTAP, Vitest, Playwright (`--workers=1`)
**Constraints**: JS inicial ≤ 170 KB gzip (el selector es código propio, sin librería); deploy SQL antes que app

## Constitution Check

| Principio | Estado | Nota |
|---|---|---|
| I. Campo primero | Cumple | El referidor nuevo va en la cola sin señal junto con la captación; nunca se rechaza una captación por el referidor. |
| II. Gama baja | Cumple | Sugerencias desde el catálogo guardado; sin llamadas extra al escribir. |
| III. Embudo | Cumple | El reporte se sigue calculando de las captaciones. |
| IV. Seguridad en la base | Cumple | La creación ocurre dentro de `submit_capture` (`security definer`), en la sucursal ya validada; la tabla sigue sin escritura directa. |
| V. Simple | Cumple | Sin tablas ni RPC nuevas; un campo opcional en el contrato existente. |

## Research

- **R1 · Un solo envío**: `referrer_new: { name, kind }` dentro del payload de `submit_capture`. Una llamada aparte podría guardar el cliente y perder el referidor (o al revés) sin señal. Así se guardan los dos o ninguno (FR-006) y la cola existente no cambia.
- **R2 · Idempotencia por nombre**: el servidor resuelve el referidor por `referrer_key(name)` en la sucursal. Reenviar el mismo `referrer_new` (reintento, o un segundo cliente antes de sincronizar) encuentra el ya creado. El cliente no necesita ids temporales (FR-008, US3.3).
- **R3 · `referrer_key`**: función `immutable`: recorta, colapsa espacios, quita tildes (también ü y ñ → u, n, igual que `normalizeText` del cliente) y pasa a minúsculas. El índice único pasa de `(branch_id, lower(name))` a `(branch_id, referrer_key(name))`; con `on conflict do nothing` cubre la carrera de dos auxiliares (US2.3). La migración se detiene con un mensaje claro si ya hay nombres que chocan con la regla nueva.
- **R4 · Nunca rechazar**: nombre inválido (fuera de 2–60) o tope diario superado → la captación entra sin referidor y la respuesta lleva `"referrer": "skipped"`. Tipo inválido o ausente → `other`. Mismo criterio que la 005 con `referrer_id` inválido (R3 de la 005).
- **R5 · Tope diario**: 10 referidores con `source = 'capture'` creados por la persona en el día de La Paz. Se cuenta sobre la tabla (sin contador nuevo).
- **R6 · Aviso en vez de guardar el nombre en la ficha**: la ficha no tiene campo de notas y agregar uno excede esta spec. Si la respuesta trae `skipped`, la app guarda un aviso local con el cliente y el nombre escrito (los tiene en la fila de la cola) y lo muestra en Registrar hasta que se cierre. *Ajuste de FR-010 respecto del borrador: «conservar el nombre en la ficha» pasa a «avisar a quien registra con el nombre escrito».*
- **R7 · Referidores recién escritos**: se recuerdan en `localStorage` por usuario (nombre, tipo, sucursal) para sugerirlos antes de que el catálogo se actualice; se descartan cuando el catálogo ya trae esa clave.
- **R8 · Origen**: `referrers.source` (`manager` | `capture`, por defecto `manager`). «Referidores y metas» muestra «Agregado en el registro por X · fecha» usando `created_by` y `created_at`, que ya existen.
- **R9 · Coincidencia con un desactivado**: se usa ese referidor y sigue desactivado (el reporte ya lista los inactivos con contactos).
- **R10 · Compatibilidad**: la app anterior no manda `referrer_new`; el parche solo actúa si llega. La app nueva contra la base vieja ignora el campo (queda sin referidor), por eso el SQL va primero.
- **R11 · Parche, no reescritura**: `submit_capture` se ajusta con `pg_temp.patch_function` sobre textos presentes en local y en producción (la base local no tiene el parche de interés alto).

## Project Structure

```text
supabase/migrations/20261120000200_referrer_on_capture.sql
supabase/tests/referrer_on_capture_test.sql
src/features/capture/referrerPick.ts        clave, limpieza, sugerencias, recordados (puro + localStorage)
src/features/capture/ReferrerPicker.tsx     campo «¿Quién lo recomendó?» con sugerencias y alta
src/features/capture/CaptureForm.tsx        casilla siempre visible; envía referrer_id o referrer_new
src/features/capture/RegisterHome.tsx       aviso «se guardó sin referidor»
src/features/sync/db.ts · sender.ts · syncLoop.ts · referrerNotices.ts   payload, resultado y avisos
src/features/referrals/api.ts · ReferralsPage.tsx   «Agregado en el registro por…»
tests/unit/referrerPick.test.ts · tests/e2e/referrals.spec.ts (ajuste) · tests/e2e/referrer-on-capture.spec.ts
```

## Deploy

1. `RB-union/migraciones-010-produccion.sql` en el SQL Editor.
2. Unir a `main` y push.
