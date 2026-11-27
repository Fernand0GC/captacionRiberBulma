# Encargo a Codex · Spec 032 · Paso 1: cierre del día

Reparto: el PM y QA (Claude) definió los criterios y escribió las pruebas; **tú programas**. Lee primero
`specs/032-cierre-del-dia/spec.md`, `CLAUDE.md` y `.specify/memory/constitution.md`.

## Pruebas que deben quedar en verde (NO las modifiques)
- `supabase/tests/day_close_test.sql` (criterios 1 a 5 y 8 a 12). La corre QA contra la base local; tú no tienes base.
- `tests/unit/dayClose.test.ts` (criterio 13).
- Y sigue en verde todo `npx vitest run`.

## Fuente de verdad
`specs/032-cierre-del-dia/codex/vigentes.sql` tiene el cuerpo **vigente** de las 6 funciones que hay que reemplazar
(sacado de la base). Copia cada cuerpo **tal cual** desde ahí y cambia solo lo que se pide abajo. No uses migraciones
viejas como base.

## Qué cambiar

### A. Migración nueva `supabase/migrations/20261127000200_day_close.sql`

1. **Ayudante nuevo** `public.org_results_pending(p_branch smallint, p_day date) returns text`
   (`language sql stable security definer set search_path = ''`):
   - L = `max(work_date)` de `public.org_assignments` con `branch_id = p_branch`, `work_date < p_day` y
     `work_date <= (now() at time zone 'America/La_Paz')::date`.
   - N = cantidad de asignaciones de esa sucursal en L con `(goal is not null and result is null) or
     (share_goal is not null and share_result is null)`.
   - Devuelve `L::text || '|' || N` si N > 0; si no hay L o N = 0, `null`.
   - `revoke execute ... from public, anon, authenticated;`
2. **Ayudante nuevo** `public.org_check_results(p_branch smallint, p_day date) returns void`
   (`plpgsql`, `security definer`, `search_path = ''`): si `public.app_role()` es `sales_lead`, `general_manager` o
   `admin`, no hace nada. Si no, y `org_results_pending` no es null, `raise exception 'results_pending' using detail = <ese texto>`.
   `revoke execute ... from public, anon, authenticated;`
3. `org_set_result` (las **dos** versiones, 3 y 4 argumentos): lee también `work_date` de la asignación y cambia
   `if not public.manages_org(v_branch) then raise exception 'forbidden'` por
   `if not public.org_can_replan(v_branch, v_day) then raise exception 'forbidden'`.
4. `org_list`: el campo `'can_set_result'` pasa de `public.manages_org(a.branch_id)` a
   `public.org_can_replan(a.branch_id, a.work_date)`. Nada más.
5. `org_upsert`: **solo al crear** (`v_id is null`), después de los chequeos de permiso y datos y antes del candado
   `pg_advisory_xact_lock`, llama `perform public.org_check_results(v_branch, v_day);`. Editar no cambia.
6. `org_copy_day_v2` y `org_copy_day`: después de sus chequeos de permiso y de que origen ≠ destino, y antes de
   insertar, `perform public.org_check_results(p_branch, p_to);` (usa los nombres de parámetros reales de cada función).
7. Comentarios en español en cada cambio («spec 032, obs. 7» / «spec 032, obs. 8»).
8. Encabezado con «Deshacer»: volver a crear las 6 funciones con los cuerpos de `vigentes.sql` y
   `drop function public.org_check_results(smallint, date); drop function public.org_results_pending(smallint, date);`.
9. Los `grant`/`revoke` de las 6 funciones existentes no cambian (`create or replace` los conserva; no agregues otros).

### B. App
1. `src/features/organization/logic.ts`: exporta `resultsPendingMessage(detail: string): string`.
   - Detalle `AAAA-MM-DD|N` válido → `Faltan resultados del DD/MM (N asignaciones). Cárgalos antes de planificar un día nuevo.`
     (con N = 1: `(1 asignación)`).
   - Cualquier otra cosa → `Faltan resultados del último día trabajado. Cárgalos antes de planificar un día nuevo.`
2. `src/features/organization/api.ts`, función `rpc`: si `error.message === 'results_pending'`, lanza
   `new Error(resultsPendingMessage(detail))` (antes del `toAppError`). Así lo muestran tal cual el formulario y el
   aviso de «Copiar día».
3. `src/features/permissions/permissions.ts`: el `help` de `replan_past` pasa a
   `'Editar y quitar asignaciones de días anteriores a hoy en su sucursal, y cargar sus resultados.'`

## Reglas
- TypeScript estricto, sin `any`; async/await, nunca `.then()`; funciones arrow en callbacks; comentarios en español
  como el resto del repo; código y BD en inglés.
- Toca SOLO los archivos nombrados arriba. No modifiques pruebas. No corras comandos de base de datos, docker, git ni red.
- Listo cuando pasen: `npx tsc -b`, `npx eslint .`, `npx vitest run`.
- Al terminar, informa en español: archivos tocados, qué hiciste en cada uno y la salida final de los tres comandos.
