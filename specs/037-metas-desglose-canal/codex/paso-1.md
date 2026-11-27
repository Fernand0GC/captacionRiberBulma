# Encargo a Codex · Spec 037 · Paso 1: avance desde la Planificación y desglose por canal

Reparto: el PM y QA (Claude) definió los criterios y escribió las pruebas; **tú programas**. Lee primero
`specs/037-metas-desglose-canal/spec.md`, `CLAUDE.md` y `.specify/memory/constitution.md`.

## Pruebas que deben quedar en verde (NO las modifiques)
- `supabase/tests/goals_plan_breakdown_test.sql` (criterios 1 a 3). La corre QA.
- `tests/unit/goalsBreakdown.test.ts` (criterio 4).
- Y siguen en verde `supabase/tests/goals_from_plan_test.sql` (la corre QA) y todo `npx vitest run`.

## A. Migración nueva `supabase/migrations/20261127000600_goals_plan_breakdown.sql`
`create or replace function public.goals_for_day(...)` partiendo **tal cual** del cuerpo de
`specs/037-metas-desglose-canal/codex/vigente.sql`. Cambios:
1. En el lateral de la Planificación por sucursal, suma también `plan_result = coalesce(sum(a.result), 0)` de las
   asignaciones con `goal` escrito.
2. En `eff`, por sucursal: `captures_done = case when from_plan then plan_result
   else (public.day_actuals(b.id, v_day) ->> 'captures')::int end`.
3. `'actuals'`: el objeto de `day_actuals(v_branch, v_day)` como hoy, más `shares` (spec 034), pero con
   `'captures'` reemplazado por `sum(captures_done)` (usa `|| jsonb_build_object('captures', …)`).
4. Nuevo `'by_channel'`: de `public.org_assignments a join public.org_channels c` con `a.work_date = v_day` y
   sucursal en el alcance (mismas sucursales que `eff`), agrupado por `c.name`, solo grupos con algún `goal` o
   `share_goal` escrito: `{channel, goal: coalesce(sum(goal),0), result: coalesce(sum(result),0),
   share_goal: coalesce(sum(share_goal),0), share_result: coalesce(sum(share_result),0)}`, ordenado por `goal`
   descendente y luego nombre; `'[]'` si no hay.
5. Nada más cambia (permisos, alcance, Contactos/Potenciales/Ventas, Compartidas, firma, grants).
6. Encabezado «Deshacer»: recrear la función con `vigente.sql`.

## B. App
1. `src/features/goals/api.ts`: `DayGoals` suma `by_channel: ChannelGoal[]` con
   `type ChannelGoal = { channel: string; goal: number; result: number; share_goal: number; share_result: number }`.
2. `src/features/goals/logic.ts`: `channelBreakdown(rows: ChannelGoal[])` → `null` si no hay filas; si no,
   `{ rows: (ChannelGoal & { pct: string })[], total: ChannelGoal & { pct: string }, showShares: boolean }`.
   `pct` = `Math.round(result / goal * 100) + '%'`, o `'—'` si `goal` es 0. `total.channel = 'Total'`.
   `showShares` = algún `share_goal > 0`.
3. `src/features/goals/GoalsPage.tsx`, tarjeta «Hoy»: debajo de `GoalProgress`, si `channelBreakdown` no es `null`,
   una tabla con título **«Por canal»**, columnas **Canal · Meta · Captados · %** y, si `showShares`,
   **Meta compart. · Compartidas**; última fila **Total** en negrita. Debajo, un `Link` **«Ver detalle en
   Planificación»** a `/planificacion`. Números con `tabular-nums`; en celular la tabla se desplaza en horizontal.
4. El Panel (`DashboardPage.tsx`) no cambia.

## Reglas
- TypeScript estricto, sin `any`; async/await, nunca `.then()`; funciones arrow en callbacks; comentarios en español
  como el resto del repo; código y BD en inglés.
- Toca SOLO los archivos nombrados arriba. No modifiques pruebas. No corras comandos de base de datos, docker, git ni red.
- Listo cuando pasen: `npx tsc -b`, `npx eslint .`, `npx vitest run`.
- Al terminar, informa en español: archivos tocados, qué hiciste en cada uno y la salida final de los tres comandos.
