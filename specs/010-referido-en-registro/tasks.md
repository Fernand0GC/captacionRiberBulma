---
description: "Tareas de la feature 010: marcar el referido al registrar"
---

# Tasks: Marcar el referido al registrar (010)

## Phase 1: Base de datos

- [x] T001 Migración `20261120000200_referrer_on_capture.sql`: `referrer_key`, índice único nuevo (con control de choques), `referrers.source`, parche de `submit_capture` (contrato)
- [x] T002 Aplicar en local
- [x] T003 pgTAP `referrer_on_capture_test.sql`: sucursal sin lista crea y asigna; mismo nombre con otras mayúsculas, tildes y espacios reutiliza; reenvío no duplica; desactivado se reutiliza y sigue desactivado; tipo inválido → other; nombre inválido → sin referidor y `skipped`; tope 10 → `skipped`; `referrer_id` válido gana; otra sucursal no se mezcla; `referrer_save` choca por tildes; el reporte cuenta al cliente; app vieja (sin campo) igual que antes

## Phase 2: Registro (US1–US3)

- [x] T004 `referrerPick.ts`: clave, limpieza, validación, sugerencias y recordados (puro, Vitest)
- [x] T005 `db.ts` (`referrer_new` en el payload), `sender.ts`/`syncLoop.ts` (resultado `referrer: 'skipped'`), `referrerNotices.ts` (avisos locales)
- [x] T006 `ReferrerPicker.tsx` y `CaptureForm.tsx`: casilla siempre visible, «¿Quién lo recomendó?», sugerencias, «Agregar», tipo
- [x] T007 `RegisterHome.tsx`: aviso «se guardó sin referidor»

## Phase 3: Lista del jefe (US4)

- [x] T008 `api.ts` y `ReferralsPage.tsx`: «Agregado en el registro por X · fecha»

## Phase 4: Pruebas y cierre

- [x] T009 Vitest `tests/unit/referrerPick.test.ts`
- [x] T010 Playwright: ajustar `referrals.spec.ts` al campo nuevo; `referrer-on-capture.spec.ts` (sucursal sin lista, con y sin señal, aparece en Referidos y en la lista del jefe)
- [x] T011 lint, typecheck, build, size (133,97 KB de 170), unit (175), pgTAP (`referrer_on_capture_test` 32/32), e2e (37 de 41). Fallas ajenas a la 010, propias de la base local: pgTAP `capture_high_interest`, `org_assignments`, `org_catalog` y `referrals` (catálogos y datos de demo locales); e2e `users-admin`, `team`, `verify-shares` (crean usuarios con la edge function, que no corre en local) y `distribute` (cupos según el personal de demo)
- [x] T012 `RB-union/migraciones-010-produccion.sql` (guarda de «ya aplicada» probada; simulado sobre una función con el parche de interés alto, como producción); `CLAUDE.md`; comandos de git propuestos al usuario (pendiente: commit, pegar el SQL en producción y publicar)
