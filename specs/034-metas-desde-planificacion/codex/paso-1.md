# Encargo a Codex · Spec 034 · Paso 1: metas del día desde la Planificación

Reparto: el PM y QA (Claude) definió los criterios y escribió las pruebas; **tú programas**. Lee primero
`specs/034-metas-desde-planificacion/spec.md`, `CLAUDE.md` y `.specify/memory/constitution.md`.

## Pruebas que deben quedar en verde (NO las modifiques)
- `supabase/tests/goals_from_plan_test.sql` (criterios 1 a 5). La corre QA.
- `tests/unit/goals.test.ts` (criterio 6).
- Y sigue en verde todo `npx vitest run`.

## A. Migración nueva `supabase/migrations/20261127000400_goals_from_plan.sql`
`create or replace function public.goals_for_day(...)` partiendo **tal cual** del cuerpo de
`specs/034-metas-desde-planificacion/codex/vigente.sql` (cuerpo vigente; no uses migraciones viejas). Cambios:
1. En el CTE `eff`, por sucursal, agrega `plan_captures` = `sum(a.goal)` de `public.org_assignments a` con
   `a.branch_id = b.id`, `a.work_date = v_day` y `a.goal is not null` (subconsulta o join lateral). `captures` pasa a
   `coalesce(plan_captures, <lo de hoy: ajuste o base>)` y agrega `from_plan = plan_captures is not null`.
2. Agrega `plan_shares` = `sum(a.share_goal)` (con `share_goal is not null`) y `plan_share_done` =
   `coalesce(sum(a.share_result), 0)` de las asignaciones de ese día y sucursal.
3. En el `jsonb_build_object` final: `'goals'` suma `'shares', sum(plan_shares)` (queda `null` si ninguna tiene);
   agrega `'captures_from_plan', coalesce(bool_or(from_plan), false)`; y `'actuals'` pasa a
   `public.day_actuals(v_branch, v_day) || jsonb_build_object('shares', coalesce(sum(plan_share_done), 0))`.
4. Contactos, Potenciales, Ventas, permisos y alcance no cambian. Firma, `security definer`, `search_path` y grants
   tampoco (`create or replace` los conserva).
5. Encabezado «Deshacer»: volver a crear la función con el cuerpo de `vigente.sql`.

## B. App
1. `src/features/goals/api.ts`: `DayGoals` suma `captures_from_plan: boolean`; `goals` y `actuals` suman `shares`
   (`goals.shares: number | null`, `actuals.shares: number`). Exporta `type ShownGoalKey = GoalKey | 'shares'` y en
   `GOAL_LABEL` (o un mapa nuevo para mostrar) la etiqueta `shares: 'Compartidas'`. `GOAL_KEYS` (las casillas para
   escribir a mano) NO cambia.
2. Nuevo `src/features/goals/logic.ts` (lógica pura):
   - `shownGoalKeys(data: DayGoals): ShownGoalKey[]` → las de `['captures','contacts','potential','sales','shares']`
     cuya meta no es `null`/`undefined`, en ese orden.
   - `todaySubtitle(data: DayGoals): string` → `'Meta base'` o `'Meta ajustada'` (+ `' · ' + note` si hay nota),
     y si `captures_from_plan`, agrega `' · Captaciones desde la Planificación'`.
3. `src/features/goals/GoalProgress.tsx`: usa `shownGoalKeys` y las etiquetas de mostrar (incluye Compartidas).
4. `src/features/goals/GoalsPage.tsx`: el subtítulo de «Hoy» usa `todaySubtitle`; la condición «Todavía no hay
   metas» usa `shownGoalKeys(...).length`; el subtítulo de «Meta base» pasa a
   «Se aplica todos los días. Deja vacío lo que no tenga meta. Si el día tiene Planificación, la meta de Captaciones
   sale de ahí.»
5. Si `DashboardPage.tsx` arma su propio subtítulo de metas, que use `todaySubtitle`; si no, no lo toques.

## Reglas
- TypeScript estricto, sin `any`; async/await, nunca `.then()`; funciones arrow en callbacks; comentarios en español
  como el resto del repo; código y BD en inglés.
- Toca SOLO los archivos nombrados arriba. No modifiques pruebas. No corras comandos de base de datos, docker, git ni red.
- Listo cuando pasen: `npx tsc -b`, `npx eslint .`, `npx vitest run`.
- Al terminar, informa en español: archivos tocados, qué hiciste en cada uno y la salida final de los tres comandos.
