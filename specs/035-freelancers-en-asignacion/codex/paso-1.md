# Encargo a Codex · Spec 035 · Paso 1: freelancers que van en la asignación

Reparto: el PM y QA (Claude) definió los criterios y escribió las pruebas; **tú programas**. Lee primero
`specs/035-freelancers-en-asignacion/spec.md`, `CLAUDE.md` y `.specify/memory/constitution.md`. El modelo a imitar es
«Volanteras que van» (spec 006: `org_channels.uses_flyers`, `org_assignments.flyer_ids`, `org_flyer_ids`).

## Pruebas que deben quedar en verde (NO las modifiques)
- `supabase/tests/freelancers_assignment_test.sql` (criterios 1 a 6). La corre QA.
- `tests/e2e/organization-freelancers.spec.ts` (criterio 7). La corre QA.
- Y sigue en verde todo `npx vitest run`.

## Fuente de verdad
`specs/035-freelancers-en-asignacion/codex/vigentes.sql`: cuerpos **vigentes** de `org_upsert`, `org_list` y
`org_copy_day_v2`. Copia cada uno **tal cual** y cambia solo lo pedido. No uses migraciones viejas como base.

## A. Migración nueva `supabase/migrations/20261127000500_freelancers_in_assignment.sql`
1. `alter table public.org_channels add column if not exists uses_freelancers boolean not null default false;`
   y `update` que la pone en `true` para el canal cuyo nombre normalizado (minúsculas, sin tildes ni espacios de
   más) es `freelancers`.
2. `alter table public.org_assignments add column if not exists freelancer_ids smallint[] not null default '{}';`
3. `org_upsert`: lee `freelancer_ids` del json (array de números; ausente al editar = conservar los de `v_old`;
   ausente al crear = `'{}'`). Después de las volanteras: si el canal no tiene `uses_freelancers` → `'{}'`; si lo
   tiene, rechaza con `invalid_input` detalle `freelancers` cualquier id que no sea (ya lo tenía `v_old`) o (referidor
   activo, `kind = 'freelance'`, `merged_into is null`, `branch_id = v_branch`). Guarda la columna en insert y update.
   Quita duplicados y ordena el array.
4. `org_list`: suma `'uses_freelancers', c.uses_freelancers`, `'freelancer_ids', to_jsonb(a.freelancer_ids)` y
   `'freelancers'` = `[{id, name}]` de `public.referrers` con `id = any(a.freelancer_ids)`, ordenado por nombre
   (`'[]'` si no hay).
5. `org_copy_day_v2`: copia `freelancer_ids` solo si el canal tiene `uses_freelancers`, dejando los que siguen
   activos, `freelance`, sin unir y de la sucursal (como hace con `flyer_ids`); si no, `'{}'`.
6. RPC nueva `public.org_add_freelancer(p_branch smallint, p_name text) returns jsonb` (`plpgsql`, `security definer`,
   `search_path = ''`): `manages_org(p_branch)` o `forbidden`; nombre = `regexp_replace(trim(p_name), '\s+', ' ', 'g')`,
   2 a 60 caracteres o `invalid_input` detalle `name`; si existe referidor de la sucursal con
   `public.referrer_key(name) = public.referrer_key(<nombre>)` devuelve `{id, existed: true}` (usa el que quedó si
   está unido: `coalesce(merged_into, id)`); si no, lo inserta (`kind 'freelance'`, `source 'manager'`,
   `created_by auth.uid()`) con `on conflict (branch_id, public.referrer_key(name)) do nothing` y devuelve
   `{id, existed: false}`. `revoke ... from public, anon;` `grant execute ... to authenticated;`
7. Comentarios en español («spec 035»). Encabezado «Deshacer»: recrear las 3 funciones con `vigentes.sql`,
   `drop function public.org_add_freelancer(smallint, text);` y quitar las dos columnas.

## B. App
1. `src/features/organization/api.ts`: tipos `Assignment` (+ `uses_freelancers`, `freelancer_ids: number[]`,
   `freelancers: {id: number; name: string}[]`), `Channel` (+ `uses_freelancers`), `AssignmentInput` y
   `AssignmentBatchInput` (+ `freelancer_ids: number[]`); `INVALID_DETAIL.freelancers` = «Los freelancers tienen que
   estar activos y ser de esta sucursal.»; `addFreelancer(v: {branch, name})` → `org_add_freelancer`; un hook que lista
   los freelancers activos de la sucursal (`referrers`: `kind = 'freelance'`, `active`, `merged_into` nulo, por nombre),
   que el conteo de la 033 puede reutilizar.
2. `src/features/organization/logic.ts`: `usesFreelancers(cat, channelId)` como `usesFlyers`.
3. `src/features/organization/AssignmentDialog.tsx`: con `usesFreelancers`, debajo del conteo (`freelancer-count`,
   sin cambiar su texto) un `fieldset` con `aria-label="Freelancers que van"`: una casilla por freelancer activo
   (con su nombre como etiqueta) más los que ya tenía la asignación con «(inactivo)»; botón **«+ Agregar freelancer»**
   que muestra un campo **«Nombre del freelancer»** y un botón **«Agregar»** (llama `addFreelancer`, refresca la lista
   y deja marcado el nuevo; errores con el aviso del formulario). Manda `freelancer_ids` al guardar (vacío si el canal
   no los usa). Opcional: se puede guardar sin marcar ninguno.
4. `src/features/organization/OrganizationPage.tsx`: «Freelancers: Ana, Luis» donde hoy dice «Volanteras: …» (las dos
   vistas).
5. `src/features/organization/exportOrganization.ts`: columna «Freelancers» después de «Volanteras».
6. `src/features/organization/CatalogPage.tsx`: la marca `uses_freelancers` con etiqueta «Freelancers» en canales,
   como «Volanteras».

## Reglas
- TypeScript estricto, sin `any`; async/await, nunca `.then()`; funciones arrow en callbacks; comentarios en español
  como el resto del repo; código y BD en inglés.
- Toca SOLO los archivos nombrados arriba. No modifiques pruebas. No corras comandos de base de datos, docker, git ni red.
- Listo cuando pasen: `npx tsc -b`, `npx eslint .`, `npx vitest run`.
- Al terminar, informa en español: archivos tocados, qué hiciste en cada uno y la salida final de los tres comandos.
