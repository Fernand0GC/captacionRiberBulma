# Plan — 017 Seguimiento a referidores

## Técnica

- **Base** (`supabase/migrations/20261121000900_referrer_asks.sql`): tablas `referrer_asks` y `referrer_phones` con RLS
  activa y sin grants directos (todo por RPC `security definer`, `search_path ''`). RPC nuevas `referrer_ask_save`,
  `referrer_followup`, `referrer_history`; parches con `pg_temp.patch_function` a `referrer_save` (celular) y
  `referral_batch_save` (registro automático). `kept` (promesa cumplida) se calcula en el servidor por pedido.
- **Lógica pura** (`src/features/referrals/asks.ts`, Vitest): plazo y motivo de Para hoy, números por referidor,
  sumas, por sucursal, por quién pide, estado.
- **UI**: `SeguimientoSection.tsx` (Para hoy, tarjetas, tabla «Ver por», Excel), `AskDialog.tsx` (como
  `ResultDialog`), `ReferrersSection.tsx` (Celular, casilla), `ReferrerDetailDialog.tsx` (historial). Excel en
  `exportReferrals.ts` (exceljs ya se carga bajo demanda). Sin dependencias nuevas.
- **Pruebas**: pgTAP `referrer_asks_test.sql`, Vitest `referral_asks.test.ts`, e2e `referrals-followup.spec.ts`.
- **Producción**: `RB-union/migraciones-017-produccion.sql` con guardas (no la base equivocada, 016 aplicada, 017 no).

## Constitución

Mobile-first (Para hoy en tarjetas), sin dependencias, permisos en el servidor, datos personales (celular) fuera de
la URL y sin lectura directa, cambios aditivos.
