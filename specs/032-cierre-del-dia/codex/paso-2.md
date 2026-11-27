# Encargo a Codex · Spec 032 · Paso 2: las reglas rigen desde una fecha de inicio

Lee `specs/032-cierre-del-dia/spec.md`, criterios 14 a 16 (nuevos). El paso 1 ya está hecho y revisado.

## Pruebas que deben quedar en verde (NO las modifiques)
- `supabase/tests/day_close_test.sql` (ahora 21 casos; la corre QA). La prueba **reemplaza** `org_day_close_since()`
  dentro de su transacción para no depender del día en que se corre: tu función tiene que llamarse exactamente así y
  usarse en los tres lugares de abajo.
- Y sigue en verde todo `npx vitest run`.

## Qué cambiar — SOLO `supabase/migrations/20261127000200_day_close.sql` (se edita en el lugar: aún no está en producción)

1. Función nueva, al principio:
   ```sql
   -- spec 032: fecha desde la que rigen las reglas del cierre del día (decisión del 2026-11-27).
   create or replace function public.org_day_close_since() returns date
   language sql stable set search_path = '' as $$ select date '2026-11-27' $$;
   revoke execute on function public.org_day_close_since() from public, anon, authenticated;
   ```
2. `org_results_pending`: el día L se busca además con `a.work_date >= public.org_day_close_since()`.
3. `org_set_result` (las dos versiones): el chequeo pasa a
   `if not (public.org_can_replan(v_branch, v_day)
            or (v_day < public.org_day_close_since() and public.manages_org(v_branch))) then raise exception 'forbidden'; end if;`
4. `org_list`: `'can_set_result'` pasa a la misma expresión con `a.branch_id` y `a.work_date`.
5. Encabezado «Deshacer»: agrega `drop function public.org_day_close_since();` (después de los otros drop).
6. Comentarios en español («spec 032, criterio 15/16»). Nada más cambia.

## Reglas
- Toca SOLO ese archivo. No modifiques pruebas. No corras comandos de base de datos, docker, git ni red.
- Listo cuando pasen: `npx tsc -b`, `npx eslint .`, `npx vitest run`.
- Al terminar, informa en español qué cambiaste y la salida final de los tres comandos.
