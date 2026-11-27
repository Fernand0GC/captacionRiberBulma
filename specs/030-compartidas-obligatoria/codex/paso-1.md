# Encargo a Codex · Spec 030 · Paso 1: meta de compartidas obligatoria

Reparto: el PM y QA (Claude) definió los criterios y escribió las pruebas; **tú programas**. Lee primero
`specs/030-compartidas-obligatoria/spec.md`, `CLAUDE.md` y `.specify/memory/constitution.md`.

## Pruebas que deben quedar en verde (NO las modifiques)
- `supabase/tests/share_goal_required_test.sql` (criterios 1 a 4, 6 a 8). La corre QA contra la base local; tú no tienes base.
- `supabase/tests/ajustes_ventas_3_test.sql` (ya actualizada a la regla nueva).
- `tests/e2e/organization.spec.ts`, prueba de la carga múltiple (criterio 5). La corre QA.
- Y sigue en verde todo `npx vitest run`.

## Qué cambiar

### A. Migración nueva `supabase/migrations/20261127000100_share_goal_required.sql`
1. `create or replace function public.org_upsert(p jsonb, p_batch uuid)` copiando **tal cual** el cuerpo vigente, que
   es el de `supabase/migrations/20261121000100_org_no_duplicate_assignments.sql` (la última que la define). Cambia
   solo esto:
   ```sql
   if not v_flags.uses_share_goal then v_share := null;
   elsif v_share is null then raise exception 'invalid_input' using detail = 'share_goal'; end if;
   ```
   y actualiza el comentario de arriba («compartidas es obligatoria si aplica (030); reemplaza la FR-011 de la 007»).
2. Mantén la firma, `security definer`, `set search_path = ''` y los `grant`/`revoke` que tenga hoy esa función.
3. Encabezado con «Deshacer»: volver a crear la función con el cuerpo de la 20261121000100.
4. No toques `org_copy_day_v2`, `org_copy_day` ni `org_set_result` (criterios 8 y 9).

### B. App · `src/features/organization/AssignmentDialog.tsx`
1. En `readGoals`, la meta de compartidas deja de ser opcional: `parseGoal(g.share_goal, \`meta de compartidas${of}\`)`
   sin el tercer argumento. Actualiza el comentario de la función.
2. En `GoalFields`, el campo «Meta de compartidas» pasa a `required = true` (deja de decir «(opcional)») y actualiza
   su comentario.
3. No cambies el orden de validación de la carga múltiple: subcanales en el orden en que se marcaron (`picked`) y,
   dentro de cada uno, primero captación y luego compartidas. Por eso, en la prueba e2e, con Mensajería WhatsApp sin
   compartidas y Barrios chinos sin captación, el primer aviso es el de Mensajería WhatsApp.

## Reglas
- TypeScript estricto, sin `any`; async/await, nunca `.then()`; funciones arrow en callbacks; comentarios en español
  como el resto del repo; código y BD en inglés.
- Toca SOLO los archivos nombrados arriba. No modifiques pruebas. No corras comandos de base de datos, docker, git ni red.
- Listo cuando pasen: `npx tsc -b`, `npx eslint .`, `npx vitest run`.
- Al terminar, informa en español: archivos tocados, qué hiciste en cada uno y la salida final de los tres comandos.
