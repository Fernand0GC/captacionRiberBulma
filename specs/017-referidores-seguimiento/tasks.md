# Tasks — 017 Seguimiento a referidores

## Base

- [x] T001 Migración `20261121000900_referrer_asks.sql` (tablas, 3 RPC, parches `referrer_save` y `referral_batch_save`).
- [x] T002 pgTAP `referrer_asks_test.sql`.

## Lógica

- [x] T003 `referrals/asks.ts` (plazo, motivo, números, sumas, vistas, estado) + Vitest.
- [x] T004 `referrals/api.ts`: `useReferrerFollowup`, `saveReferrerAsks`, `useReferrerHistory`, `phone` en referidores.

## US1/US2 — Pestaña Seguimiento

- [x] T005 `seccion=seguimiento` y `ver` en `search.ts`; pestaña en `ReferralsPage.tsx`.
- [x] T006 `AskDialog.tsx` (uno o varios).
- [x] T007 `SeguimientoSection.tsx`: Para hoy, tarjetas, tabla «Ver por», Excel (`exportReferrals.ts`).

## US3/US4

- [x] T008 `ReferrersSection.tsx`: Celular y «Ya le pedí referidos hoy».
- [x] T009 `ReferrerDetailDialog.tsx`: historial y Pedir.

## Cierre

- [x] T010 e2e `referrals-followup.spec.ts` + regresión de Referidos.
- [x] T011 `RB-union/migraciones-017-produccion.sql` probado en local.
- [x] T012 CLAUDE.md y `.specify/feature.json`.
