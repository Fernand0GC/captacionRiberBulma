# Tasks — 014 Referidos con período, sucursales, filtros y lista ordenada

## Entrega 1 — Período, sucursales y filtros (US1–US3)

- [x] T001 Migración `20261121000600_referrals_range.sql`: `referral_branches`, `referral_range_goal`, `referral_report_range`.
- [x] T002 pgTAP de rango, prorrateo, cohorte, por día, alcance y permisos (`referrals_range_test.sql`).
- [x] T003 `search.ts`: filtros en la URL, períodos (con «Mes pasado»), período anterior; ruta `/referidos` con `validateSearch`.
- [x] T004 `logic.ts`: orden, columnas por día/mes, metas con decimal, diferencia contra el período anterior.
- [x] T005 `ReportSection.tsx`: tarjetas, tabla por sucursal con detalle y vuelta, resumen ordenable y filtrado por tipo, «Por día», evolución, mensaje vacío útil.
- [x] T006 Excel por rango (`exportRangeReport`): Sucursales o Resumen + Por día, Contactos, Quién registra.

## Entrega 2 — Contactos y acción (US4–US6)

- [x] T007 Pestaña Contactos con filtros en los títulos y días esperando (`ContactsSection.tsx`) + Excel.
- [x] T008 Pestaña Quién registra.
- [x] T009 Filtro `f.referrer` y `referrer_name` en `list_prospects` / `list_followup_status` (migración `…0500`).
- [x] T010 Captaciones: columna y filtro «Referido por» (título + barra en el celular) y columna en el Excel.
- [x] T011 Seguimientos: selector «Origen: Solo referidos».

## Entrega 3 — Lista de referidores (US7)

- [x] T012 `referrers.merged_into`, `referrer_merge`, `submit_capture` con el destino, `referrer_save` rechaza unidos (pgTAP).
- [x] T013 `ReferrersSection.tsx`: buscador, filtro (Todos · Agregados en el registro · Desactivados · Unidos), «Unir con…».
- [x] T014 Copiar metas del mes anterior y «Editar todas las metas».

## Cierre

- [x] T015 Vitest `referralsRange.test.ts`; e2e `referrals-range.spec.ts`; ajuste de `referrals.spec.ts`.
- [x] T016 SQL de producción `RB-union/migraciones-014-produccion.sql` (una transacción, exige la 013, se detiene si ya está), probado en local por los dos caminos.
- [ ] T017 Publicar: el usuario pega el SQL en producción (después de la 013) y luego hace commit/merge/push de la app.
- [ ] T018 Confirmar con ventas lo decidido por recomendación (Clarifications).
