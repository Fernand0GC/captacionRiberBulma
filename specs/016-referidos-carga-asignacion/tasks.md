# Tasks — 016 Cargar y asignar referidos

## Base

- [x] T001 Migración `20261121000800_referral_batch.sql` (3 RPC + parches `my_contacts` y `referral_report_range`).
- [x] T002 pgTAP `referral_batch_test.sql`.

## US1 — Cargar y asignar

- [x] T003 `referrals/load.ts` (`parsePaste`, `rowIssue`, `proposeAssignees`, `buildItems`) + Vitest.
- [x] T004 `referrals/api.ts`: `useReferralAssignees`, `usePhoneCheck`, `saveReferralBatch`.
- [x] T005 `seccion=cargar` en `search.ts` y pestaña en `ReferralsPage.tsx`.
- [x] T006 `LoadSection.tsx`: sucursal, referidor, filas/pegar, responsables, guardar y aviso.

## US2 — Mis contactos

- [x] T007 `FollowupRow` con `referrer_name`/`assigned_by_name`; etiqueta en tarjeta y fila.

## US3 — Detalle por referidor

- [x] T008 `referrals/detail.ts` + Vitest.
- [x] T009 `ReferrerDetailDialog.tsx` y el Reporte la abre.

## Cierre

- [x] T010 e2e `referrals-load.spec.ts` + regresión de Referidos y Mis contactos.
- [x] T011 `RB-union/migraciones-016-produccion.sql` probado en local.
- [x] T012 CLAUDE.md (lista de features) y `.specify/feature.json`.
