# Encargo a Codex · Spec 029 · Paso 1: correcciones de QA

Reparto: el PM y QA (Claude) definió los criterios y escribió las pruebas; **tú programas**. Lee primero
`specs/029-permisos-por-persona/spec.md` (criterios 19 a 24), `CLAUDE.md` y `.specify/memory/constitution.md`.

## Pruebas que deben quedar en verde (NO las modifiques)
- `supabase/tests/permissions_qa_test.sql` (criterios 20, 21, 23). La corre QA contra la base local; tú no tienes base.
- `tests/unit/permissions_qa.test.ts` (criterios 19, 24).
- Y siguen en verde: `supabase/tests/permissions_test.sql`, `supabase/tests/permissions_baseline_test.sql`,
  `tests/unit/access.test.ts`, `tests/unit/permissions.test.ts`, `tests/unit/access_baseline.test.ts` y todo `npx vitest run`.

## Qué cambiar

### A. Migración `supabase/migrations/20261126000100_profile_permissions.sql` (se edita en el lugar: aún no está en producción)
1. **Re-ejecutable (criterio 22)**: `create table if not exists`; `drop policy if exists … ; create policy …`;
   `create or replace function` en TODAS las funciones; `drop trigger if exists` antes de crear el trigger.
2. **Privilegios (criterio 23)**: `revoke all on public.profile_permissions from anon;` y
   `revoke insert, update, delete, truncate, references, trigger on public.profile_permissions from authenticated;`
   (`authenticated` conserva solo `select`, limitado por la RLS existente).
3. **Quitar sin exigir rol ni actividad (criterio 21)** en `permission_set`: con `p_on = false` NO se exige
   `role = 'branch_manager'` ni `active`; se mantienen la validación del permiso, que la persona exista y el alcance
   (`v_global` o `manages_branch(v_t.branch_id)`, en ese orden, antes de mirar el rol). Con `p_on = true` todo sigue igual.
4. **Limpieza automática (criterio 20)**: función trigger `public.profile_permissions_cleanup()` (security definer,
   `search_path = ''`) y trigger `AFTER UPDATE OF role, branch_id, active ON public.profiles FOR EACH ROW` que, si
   `old.role is distinct from new.role` o `old.branch_id is distinct from new.branch_id` o (`old.active and not new.active`),
   borra los permisos de esa persona y deja UNA fila en `public.audit_log` por permiso borrado:
   `table_name = 'profile_permissions'`, `row_id = new.id`, `actor_id = auth.uid()`,
   `old = jsonb_build_object('permission', <permiso>, 'reason', 'role' | 'branch' | 'deactivated')`, `new = null`.
   (`acting_by` se completa solo por su valor por defecto.) Guardar el mismo rol y sucursal no borra nada.
   Revocar `execute` de la función trigger a `public, anon, authenticated`.
5. **«Deshacer» del encabezado (criterio 22)**: que sirva copiado tal cual. Primero «revertir la app (deploy anterior)»;
   después `drop trigger …; drop function …`, y volver a crear `org_can_replan`, `can_see_referrals` y
   `referral_branches` con `create or replace function` y su cuerpo anterior (escríbelos completos en el comentario,
   tomados de `20261123000100_org_replan_same_day.sql`, `20261118001000_referrals.sql` y `20261121000600_referrals_range.sql`);
   al final `drop table`.

### B. App
1. `src/features/auth/access.ts`: exporta
   `permissionsFrom(r: { data: { permission: string }[] | null; error: unknown }): Permission[]`
   → `[]` si hay `error` o no hay `data`; ignora valores que no sean un `Permission` conocido.
2. `src/features/auth/AuthProvider.tsx` (`fetchProfile`): quita el embebido `profile_permissions!…(permission)` del
   select del perfil y trae los permisos con una consulta aparte
   (`supabase.from('profile_permissions').select('permission').eq('profile_id', uid)`), en paralelo con la del perfil,
   pasando el resultado por `permissionsFrom`. Si la de permisos falla, el perfil carga igual (criterio 19). La del
   perfil sigue lanzando su error como hoy.
3. `src/features/permissions/permissions.ts`: exporta
   `undoOne(rows, v: { id: string; permission: Permission; on: boolean }): PermissionRow[]` = deshace SOLO esa casilla
   (usa `withPermission(rows, v.id, v.permission, !v.on)`).
4. `src/features/permissions/api.ts`: en `onError`, en vez de restaurar la foto entera, aplica `undoOne` sobre los datos
   ACTUALES de la caché. Quita lo que ya no se use.
5. `src/features/permissions/PermissionsPage.tsx`: mientras `set.isPending`, TODAS las casillas deshabilitadas (criterio 24).

## Reglas
- TypeScript estricto, sin `any`; async/await, nunca `.then()`; funciones arrow en callbacks; comentarios en español
  como el resto del repo; código y BD en inglés.
- Toca SOLO los archivos nombrados arriba. No modifiques pruebas. No corras comandos de base de datos, docker, git ni red.
- Listo cuando pasen: `npx tsc -b`, `npx eslint .`, `npx vitest run`.
- Al terminar, informa en español: archivos tocados, qué hiciste en cada uno y la salida final de los tres comandos.
