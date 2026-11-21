# Plan — 016 Cargar y asignar referidos

## Resumen técnico

Una migración aditiva (3 RPC nuevas + parches de `my_contacts` y `referral_report_range`) y pantalla. Sin
dependencias nuevas. Contrato: `contracts/rpc.md`.

## Base de datos

`20261121000800_referral_batch.sql`:

1. `referral_assignees(p_branch)` — como `assignee_options` + `pending` (activos asignados, en Captación, sin
   followups). Permiso: `can_see_referrals(p_branch)`.
2. `referral_phone_check(p_branch, p_phones text[])` — hasta 50; por cada celular válido que ya tiene un cliente
   activo: sucursal y, si `manages_branch` de esa sucursal, nombre del cliente y responsable.
3. `referral_batch_save(p jsonb)` — valida todo antes de escribir (sucursal, 1–50 filas, referidor, responsables);
   resuelve el referidor (por id, sigue `merged_into`, o crea uno `source = 'manager'`); por fila llama a
   `submit_capture` y, si fue aceptada y trae responsable, a `assign_prospects`. Devuelve el resultado por fila.
   Es una sola función: si algo falla, no queda nada a medias.
4. `my_contacts` (parche con `pg_temp.patch_function`): `referrer_name` y `assigned_by_name` (actor de la última
   asignación hacia mí, si no fui yo).
5. `referral_report_range` (parche): por contacto `contacts`, `first_contact_at`, `last_method`, `last_result`,
   `last_note` (lateral sobre `followups`).

SQL de producción: `RB-union/migraciones-016-produccion.sql` (una transacción; exige la 015; se detiene si la 016 ya
está; registra en `schema_migrations`).

## Pantalla

| Pieza | Archivo | Cambio |
|---|---|---|
| Sección | `referrals/search.ts`, `ReferralsPage.tsx` | `seccion=cargar`, pestaña «Cargar», sin período. |
| Lógica pura | **nuevo** `referrals/load.ts` | `parsePaste`, `rowIssue`, `proposeAssignees`, `buildItems`. Vitest. |
| Carga | **nuevo** `referrals/LoadSection.tsx` | Sucursal, `ReferrerPicker` (reutilizado de Registrar), filas/pegar, responsables con pendientes, guardar. |
| Datos | `referrals/api.ts` | `useReferralAssignees`, `usePhoneCheck`, `saveReferralBatch`; campos nuevos en `RangeContact`. |
| Detalle | **nuevo** `referrals/detail.ts` + `ReferrerDetailDialog.tsx` | Resumen, «Quién los atiende», grupos de la 012 (`OUTCOME_GROUPS`, `STAGE_COLOR`), lista, Excel. |
| Reporte | `referrals/ReportSection.tsx` | El nombre del referidor abre la ventana (sale la tablita). |
| Mis contactos | `followup/api.ts`, `followup/InboxPage.tsx` | `referrer_name`, `assigned_by_name`; etiqueta en tarjeta y fila. |

Decisiones:
- **Reutilizar `submit_capture` dentro de la RPC en lote** en vez de copiar su INSERT: duplicados, idempotencia,
  límites y referidor unido quedan con una sola regla.
- La propuesta de reparto se calcula en el cliente (`load.ts`, probada) y el servidor solo valida y guarda lo que
  llega: así lo que se ve es exactamente lo que se guarda.

## Constitución

- IV: permisos en el servidor (`can_see_referrals`, `submit_capture`, `assign_prospects`); el aviso de duplicado no
  revela clientes de sucursales ajenas; celulares fuera de la URL.
- II: sin dependencias; Referidos sigue en su chunk lazy.
- V: spec, contrato y plan en el mismo cambio.

## Pruebas

- pgTAP `referral_batch_test.sql`: permisos, sucursal ajena, validaciones, referidor nuevo/unido, duplicados,
  asignación e historial, idempotencia, `referral_assignees`, `referral_phone_check`, campos nuevos.
- Vitest `referral_load.test.ts` y `referral_detail.test.ts`.
- Playwright `referrals-load.spec.ts`: jefe carga y asigna; la auxiliar ve la etiqueta; ventana de detalle.
- Regresión: `referrals.spec.ts`, `referrals-range.spec.ts`, `followup.spec.ts`.
