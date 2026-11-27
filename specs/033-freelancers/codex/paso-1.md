# Encargo a Codex · Spec 033 · Paso 1: freelancers

Reparto: el PM y QA (Claude) definió los criterios y escribió las pruebas; **tú programas**. Lee primero
`specs/033-freelancers/spec.md`, `CLAUDE.md` y `.specify/memory/constitution.md`.

## Pruebas que deben quedar en verde (NO las modifiques)
- `supabase/tests/freelance_sale_test.sql` (criterios 5 y 6). La corre QA.
- `tests/unit/freelance.test.ts` (criterio 1).
- `tests/e2e/capture-freelance.spec.ts` y `tests/e2e/organization-freelancers.spec.ts`. Las corre QA.
- Y sigue en verde todo `npx vitest run`.

## A. Migración nueva `supabase/migrations/20261127000300_freelance_sale.sql`

`submit_capture` se cambia con **parches de texto**, NO copiando su cuerpo (producción tiene partes que la base local
no tiene). Usa el mismo ayudante `pg_temp.patch_function(firma, texto_viejo, texto_nuevo)` que está al principio de
`supabase/migrations/20261113000200_capture_high_interest.sql` (cópialo tal cual). Tres parches sobre
`public.submit_capture(jsonb)`, con estos textos de anclaje (existen igual en local y en producción):

1. Anclaje `  v_ref_skipped boolean := false;` → agregar debajo
   `  v_sold boolean := coalesce((p ->> 'sold')::boolean, false);  -- spec 033`.
2. Anclaje `  -- Spec 014: referidor unido → el que quedó.` → agregar ANTES un bloque (spec 033, criterio 5):
   si `v_sold`: sin `v_product` → `raise exception 'invalid_input' using detail = 'product_id'`;
   sin `v_referrer` → `raise exception 'invalid_input' using detail = 'referrer'`.
3. Anclaje: la línea que empieza con `  return jsonb_build_object('id', v_id, 'result', case when v_status = 'active'`
   (la última `return`) → agregar ANTES un bloque (spec 033, criterio 5): si `v_sold and v_status = 'active'`:
   - insertar en `public.stage_events (prospect_id, from_stage, to_stage, note, actor_id)` la fila
     (`v_id`, etapa actual del cliente, `'sale'`, `'Venta directa (freelancer)'`, `v_uid`) leyendo la etapa actual de
     `public.prospects` antes de cambiarla;
   - si `assigned_to` actual es distinto de `v_uid`, insertar en `public.assignment_events (prospect_id, from_user,
     to_user, actor_id)` (`v_id`, el anterior, `v_uid`, `v_uid`);
   - `update public.prospects set stage = 'sale', stage_changed_at = v_now, sold_at = v_now, assigned_to = v_uid
     where id = v_id;`
4. Encabezado con «Deshacer»: los tres parches al revés (texto nuevo → texto viejo).
5. No cambies permisos ni ninguna otra función.

## B. App
1. Nuevo `src/features/capture/freelance.ts`: `export function isFreelanceChannel(name: string | undefined): boolean`.
   Normaliza como `asksOccupation` en `occupation.ts` (minúsculas, sin tildes, espacios recortados y colapsados) y
   devuelve `true` solo para `freelance` o `freelancers`.
2. `src/features/sync/db.ts`: el tipo de la captación en cola suma `sold?: boolean`.
3. `src/features/capture/ReferrerPicker.tsx`: prop opcional `fixedKind?: NewReferrerKind`. Con ella, «Agregar» crea
   el nuevo con ese tipo sin mostrar el grupo «¿Quién es?», y las sugerencias se limitan a ese tipo. Sin la prop,
   todo igual que hoy. Se puede pasar `text: PickerText` para cambiar rótulos (si ya existe, úsalo).
4. `src/features/capture/CaptureForm.tsx`, con `const freelanceMode = isFreelanceChannel(channelName)`:
   - Muestra solo «Nombre completo», «Celular», el buscador con rótulo **«Freelancer»** (placeholder «Nombre del
     freelancer», `fixedKind="freelance"`) y el selector de producto con el título **«Producto que compró»** (sin
     «(opcional)»). Oculta ocupación, «Producto de interés», «Es referido», dirección y nivel de interés.
   - Validación: sin freelancer → «Escribe el nombre del freelancer.»; sin producto → «Elige el producto que compró.»
     (los dos errores pueden salir a la vez, junto a su campo).
   - Al guardar manda `sold: true`, `product_id`, el freelancer con `toPayload` y NO manda ocupación, dirección,
     interés ni otro referidor.
   - Fuera del modo freelancer, el formulario queda exactamente igual que hoy.
5. Planificación: en `src/features/organization/api.ts`, hook `useFreelancerCount(branch: number | undefined,
   enabled: boolean)` que cuenta en `referrers` los de esa sucursal con `kind = 'freelance'`, `active = true` y
   `merged_into` nulo (`select('id', { count: 'exact', head: true })`). En `AssignmentDialog.tsx`, si el canal
   elegido cumple `isFreelanceChannel(nombre del canal)`, muestra bajo el canal un `<p data-testid="freelancer-count">`
   con «N freelancers en la sucursal» («1 freelancer en la sucursal» en singular) o, con 0,
   «No hay freelancers cargados en la sucursal. Se cargan en Referidos.».

## Reglas
- TypeScript estricto, sin `any`; async/await, nunca `.then()`; funciones arrow en callbacks; comentarios en español
  como el resto del repo; código y BD en inglés.
- Toca SOLO los archivos nombrados arriba. No modifiques pruebas. No corras comandos de base de datos, docker, git ni red.
- Listo cuando pasen: `npx tsc -b`, `npx eslint .`, `npx vitest run`.
- Al terminar, informa en español: archivos tocados, qué hiciste en cada uno y la salida final de los tres comandos.
