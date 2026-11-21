# Plan — 015 Seguimientos accionable

## Resumen técnico

Una migración aditiva (parche de `list_followup_status`) y cambios de pantalla. Sin dependencias nuevas.

## Base de datos

`20261121000700_followup_status_context.sql`, con `pg_temp.patch_function` (mismo patrón que la 0400 y la 0500):

1. Declarar `v_product integer := nullif(f ->> 'product_id', '')::integer;`.
2. Filtrar en el CTE `scope` (así afecta total, `by_tab` y filas): `and (v_product is null or p.product_id = v_product)`.
3. En `page`: `b.channel_detail, pr.name as product_name, au.role as created_by_role` y `left join public.products pr`.

Compatibilidad: la app publicada no manda `product_id` y ignora los campos nuevos (SC-004). pgTAP nuevo en
`supabase/tests/followup_status_context_test.sql`. SQL de producción en `RB-union/migraciones-015-produccion.sql`
(una transacción; exige la 014 —`referrer_name` en la función—; se detiene si la 015 ya está).

## Pantalla

| Pieza | Archivo | Cambio |
|---|---|---|
| Período por defecto | `prospects/search.ts` | `defaultPeriod(ver)`: `'mes'` en Seguimientos; `periodRange` lo usa. |
| Botones de período | `prospects/ManageFilterBar.tsx` | El activo sale de `defaultPeriod`. |
| Selección y asignación | **nuevo** `prospects/AssignSelection.tsx` | Hook `useAssignSelection` + `AssignBar` + `ReassignDialog` + `ownersSummary`, extraídos de `ProspectsPage.tsx` sin cambiar comportamiento. |
| Registro de contacto | **nuevo** `prospects/ContactDialog.tsx` | Extraído de `ProspectsPage.tsx`. |
| Captaciones | `prospects/ProspectsPage.tsx` | Usa las piezas compartidas. |
| Seguimientos | `monitoring/FollowupStatusView.tsx` | Botón Seleccionar, casillas (tabla y tarjetas), barra, botón «Seguimiento», contexto apilado, «Referido por» y «Producto» de la barra común, texto del período. |
| Datos | `monitoring/api.ts` | `product_id` en filtros; `product_name`, `channel_detail`, `created_by_role` en la fila. |
| Refresco | `prospects/api.ts`, `followup/api.ts` | Asignar y registrar contacto invalidan también `['monitoring']`. |
| Excel | `monitoring/exportFollowups.ts` | Producto, Detalle del canal, Referido por. |

Decisión de diseño: **extraer y no copiar** la barra de asignación. Son ~150 líneas con reglas delicadas (reparto,
confirmación de reasignación, selección por filtro); dos copias se separan con el primer ajuste de ventas.

## Constitución

- IV: el celular se muestra (ya se mostraba en Captaciones a los mismos roles) pero no entra a la URL; permisos en `assign_prospects` y `scoped_branch`.
- II: sin dependencias; Seguimientos sigue en su chunk lazy.
- V: spec, contrato y plan en el mismo cambio.

## Pruebas

- pgTAP: `followup_status_context_test.sql` (filtro de producto en total/by_tab/filas, campos nuevos, sin `product_id` igual que antes).
- Vitest: `defaultPeriod`/`periodRange` por vista.
- Playwright: `followup-actionable.spec.ts` (abre con Este mes, asigna desde Seguimientos, botón Seguimiento, contexto).
- Regresión: `monitoring.spec.ts` y el e2e de Captaciones (selección).
