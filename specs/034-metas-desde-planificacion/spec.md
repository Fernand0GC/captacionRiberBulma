# Spec 034 · Metas del día desde la Planificación

Estado: en producción (2026-11-27). Origen: observación 9 de ventas («APP - CAPTACION»): «Metas: cargar las metas de
la organización».

## Problema

La página **Metas** tiene metas diarias por sucursal (Captaciones, Contactos de recaptación, Clientes potenciales y
Ventas) que se escriben a mano (meta base y ajustes por día). Ventas ya pone metas en la **Planificación** (meta de
captación y de compartidas por asignación) e invierte tiempo ahí: no quiere cargarlas dos veces.

## Decisión del usuario (2026-11-27)

«Todo a Captaciones»: la suma de **todas** las metas de captación de la Planificación del día es la meta de
**Captaciones**. Se agrega **Compartidas**. Contactos, Potenciales y Ventas siguen a mano.

## Criterios de aceptación

1. `goals_for_day(sucursal, día)`: por cada sucursal del alcance, si ese día tiene asignaciones con meta de captación
   (`goal` escrito), la meta de **Captaciones** de esa sucursal es la **suma de esos `goal`**; si no tiene, se usa la
   meta escrita a mano (ajuste del día o meta base), como hoy. La de la Planificación manda sobre el ajuste.
2. Nueva meta **`shares`** (Compartidas) = suma de `share_goal` de las asignaciones del día de las sucursales del
   alcance; `null` si ninguna tiene.
3. Nuevo avance **`actuals.shares`** = suma de `share_result` de esas asignaciones (0 si no hay).
4. Nuevo campo **`captures_from_plan`**: `true` si al menos una sucursal del alcance tomó Captaciones de la Planificación.
5. Contactos, Potenciales y Ventas: sin cambio. Permisos y alcance: sin cambio.
6. App, tarjeta «Hoy» de Metas (y el Panel, que usa la misma tarjeta): muestra también **Compartidas** cuando hay meta;
   si `captures_from_plan`, el subtítulo dice «Captaciones desde la Planificación» (sumado a «Meta ajustada…» si aplica).
7. App, tarjeta «Meta base»: aclara «Si el día tiene Planificación, la meta de Captaciones sale de ahí.» Las casillas
   para escribir metas a mano no cambian (no hay casilla de Compartidas).

## Fuera de alcance
- Metas mensuales de ventas por línea.
- Repartir Contactos o Ventas desde la Planificación.

## Pruebas
- `supabase/tests/goals_from_plan_test.sql` (criterios 1 a 5).
- `tests/unit/goals.test.ts` (criterio 6: qué metas se muestran y el subtítulo).
