# Plan — 014 Referidos con período, sucursales, filtros y lista ordenada

Spec: [spec.md](./spec.md) · Contratos: [contracts/rpc.md](./contracts/rpc.md)

## Enfoque

Todo aditivo (FR-018). El servidor suma una RPC de lectura nueva y una de escritura; las funciones existentes se
parchean sobre su texto vigente con `pg_temp.patch_function` (mismo patrón que 005, 010 y 013). La pantalla
`/referidos` se reescribe en secciones y pasa sus filtros a la URL, igual que `/gestion`.

## Servidor

| Migración | Qué hace |
|---|---|
| `20261121000500_referrer_merge.sql` | `referrers.merged_into`; `referrer_merge`; `submit_capture` usa el destino de un unido; `referrer_save` rechaza unidos; filtro `f.referrer` + `referrer_name` en `list_prospects` y `list_followup_status` |
| `20261121000600_referrals_range.sql` | `referral_branches` (alcance), `referral_range_goal` (meta prorrateada), `referral_report_range` |

Decisiones:

- **Cohorte por llegada** en el rango (R5 de la 005), ventas posteriores cuentan. La grilla por día suma las ventas
  que caen dentro del rango.
- **Meta**: mes completo si el rango lo cubre hasta su fin o hasta hoy; si no, prorrateo por días con 1 decimal.
- **Alcance**: `referral_branches(null)` = todas (gerencia) o `profile_branches` (jefe). El encargado sigue fuera.
- **`lists: false`** devuelve solo totales y sucursales: la comparación con el período anterior cuesta una consulta liviana.
- **Unir**: no se borra el origen (su nombre sigue en el historial de las fichas y en `referrer_key`, así que escribirlo
  otra vez al registrar cae en el destino). Candado `for update` en orden de id.
- `list_prospects` / `list_followup_status` dependen del texto de la 013 (`v_product`): el SQL de producción lo verifica.

## Cliente

- `src/features/referrals/search.ts`: filtros de la URL (`validateReferralSearch`), `referralRange` (con «Mes pasado»), `previousRange`.
- `src/features/referrals/logic.ts`: orden, columnas «Por día» (días ≤ 62, si no meses), metas con decimal, filtros de contactos, «quién registra», filtros de referidores.
- `src/features/referrals/parts.tsx`: `useReferralScope` (sucursal efectiva: gerencia sin elegir = todas; jefe con varias = «Todas mis sucursales» con `?todas=true`), `Tabs`, `SortHeader`.
- Secciones: `ReportSection.tsx` (tarjetas, tabla por sucursal + `BranchDrillBar`, resumen ordenable, «Por día», evolución, Excel), `ContactsSection.tsx` (Contactos + Quién registra), `ReferrersSection.tsx` (buscador, filtro, unir, copiar metas, metas en bloque).
- `BranchDrillBar` pasa a tipo estructural `{ branch_id, name }` para usarse en Referidos.
- Captaciones: columna y filtro «Referido por» (título en pantalla ancha, selector en la barra para el celular), Excel con la columna. Seguimientos: selector «Origen». Reutilizan `?origen=referidos&referidor=` de «Del día».

## Peso (constitución II)

Sin dependencias nuevas. `ReferralsPage` sigue en carga diferida (≈ 9,9 KB gzip); el JS inicial queda en ≈ 109 KB gzip.

## Pruebas

- pgTAP `supabase/tests/referrals_range_test.sql` (40): rango, prorrateo, cohorte, por día, alcance y permisos, filtros, unir.
- Vitest `tests/unit/referralsRange.test.ts` (21).
- Playwright `tests/e2e/referrals-range.spec.ts` (flujo completo) + ajuste de `referrals.spec.ts` (opción «Todas mis sucursales»).
