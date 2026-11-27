# Spec 037 · Metas de hoy: avance desde la Planificación y desglose por canal

Estado: en producción (2026-11-27). Origen: revisión de la spec 034 (obs. 9). En Cobija la tarjeta «Hoy» mostró
Captaciones **8 / 410 (2%)**: la meta (410) suma todas las metas de la Planificación (llamadas, mensajería, calle…) pero
el avance (8) cuenta solo clientes nuevos registrados. Tampoco se ve de dónde sale el 410.

## Decisión del usuario (2026-11-27)
Recomendación aceptada, con **desglose por canal**.

## Criterios de aceptación

### Base: `goals_for_day`
1. **Avance de Captaciones**, por sucursal: si la sucursal toma la meta de la Planificación ese día (spec 034), su
   avance es la **suma de `result`** (Captados) de esas asignaciones; si no, sigue siendo los clientes nuevos
   registrados (`day_actuals` de esa sucursal), como antes. `actuals.captures` = suma de lo de cada sucursal del alcance.
2. Nuevo **`by_channel`**: lista de canales con asignaciones ese día en las sucursales del alcance que tengan alguna
   meta (`goal` o `share_goal`), cada uno `{channel, goal, result, share_goal, share_result}` (sumas; `goal` y
   `share_goal` en 0 si no hay; `result` y `share_result` en 0 si no hay). Orden: `goal` de mayor a menor, luego nombre.
   Lista vacía si no hay Planificación.
3. Contactos, Potenciales, Ventas, Compartidas (spec 034), permisos y alcance: sin cambio.

### App: Metas → tarjeta «Hoy»
4. Si `by_channel` tiene filas, debajo de las barras: tabla **«Por canal»** con columnas **Canal · Meta · Captados · %**
   y, solo si algún canal tiene meta de compartidas, **Meta compart. · Compartidas**. El % = Captados ÷ Meta redondeado;
   «—» si la meta es 0. Última fila **Total** con las sumas.
5. Enlace **«Ver detalle en Planificación»** a `/planificacion`.
6. El Panel sigue mostrando solo las barras (sin tabla).

## Fuera de alcance
- Desglose por persona (se ve en la Planificación con el filtro «Personal»).

## Pruebas
- `supabase/tests/goals_plan_breakdown_test.sql` (criterios 1 a 3).
- `tests/unit/goalsBreakdown.test.ts` (criterio 4: filas, % y total).
