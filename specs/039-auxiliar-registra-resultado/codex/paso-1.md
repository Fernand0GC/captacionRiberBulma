# Encargo para Codex · Spec 039: el auxiliar registra el resultado de sus tareas

Reparto: el PM y QA (Claude) definió los criterios y escribió las pruebas; **tú programas**.

## Dónde trabajas

- Carpeta: `/Users/daniel/Documents/RB-union/captacionRiberBulma`, rama `feat/039-auxiliar-registra-resultado`.
- Lee `CLAUDE.md`, `.specify/memory/constitution.md` y `specs/039-auxiliar-registra-resultado/spec.md` completa.
- Fuente de verdad de las funciones a reemplazar: `specs/039-auxiliar-registra-resultado/codex/vigentes.sql`
  (cuerpos **vigentes** de las dos `org_set_result` y de `org_list`, sacados de la base). Copia cada cuerpo **tal cual**
  desde ahí y cambia solo lo que se pide. No uses migraciones viejas como base.
- Modelo de estilo de migración: `supabase/migrations/20261127000200_day_close.sql` (encabezado con «Deshacer»,
  comentarios «spec 0NN» en cada cambio).
- Se reutiliza sin rehacer: `src/features/organization/ResultDialog.tsx`, `OrganizationPage.tsx` (`Score`,
  `ResultCell`), `api.ts` (`rpc`, `INVALID_DETAIL`), `exportOrganization.ts`, componentes de `src/ui`.

## Pruebas que ya existen y hoy fallan (NO las modifiques)

- `supabase/tests/own_result_test.sql` (contrato de base: RF-01 a RF-04). La corre QA; tú no tienes base.
- `tests/unit/ownResult.test.ts` (RF-05: `resultState`, `registeredBy`).

Deben seguir pasando: todo `npx vitest run`, en especial `organization.test.ts`, `dayClose.test.ts`,
`goalsBreakdown.test.ts`; y las pgTAP `day_close_test.sql`, `goals_plan_breakdown_test.sql`.

## Qué construir

### A. Migración `supabase/migrations/20261128000100_own_result.sql` (ya creada, solo con un comentario)

1. Columnas (idempotente, `add column if not exists`) en `public.org_assignments`:
   `done boolean`, `result_by uuid references public.profiles(id)`, `result_at timestamptz`. Comentario de columna en
   español en cada una.
2. Función nueva `public.org_report_result(p_id uuid, p_result integer, p_share_result integer, p_done boolean,
   p_notes text) returns void`, `language plpgsql security definer set search_path = ''`:
   - Lee `branch_id`, `work_date`, `profile_id`, `result_by` de la asignación; `not_found` si no existe.
   - `v_manager` = la regla vigente de `org_set_result` (copiarla: `org_can_replan(v_branch, v_day) or
     (v_day < public.org_day_close_since() and public.manages_org(v_branch))`).
   - `v_own` = `public.app_is_active() and public.app_role() = 'field_assistant' and v_profile = auth.uid() and
     v_day = (now() at time zone 'America/La_Paz')::date`.
   - Si no `v_manager` y no `v_own` → `raise exception 'forbidden'`.
   - Si no `v_manager` (o sea, va por `v_own`) y `v_result_by is not null and v_result_by <> auth.uid()` →
     `raise exception 'result_locked'`.
   - Validaciones con los mismos mensajes que `org_set_result`: `invalid_input` detalle `result`, `share_result`,
     `notes` (notas recortadas con `nullif(trim(p_notes), '')`, máximo 300).
   - `update`: `result`, `share_result`, `done`, `notes`, `updated_by = auth.uid()`, `updated_at = now()`, y
     `result_by`/`result_at` = null si `p_result`, `p_share_result` y `p_done` son todos null; si no,
     `auth.uid()` / `now()`.
   - `revoke execute ... from public, anon;` `grant execute ... to authenticated;`
3. Las dos `org_set_result` (3 y 4 argumentos): mismo cuerpo vigente + en el `update` poner `result_by` y
   `result_at` con la regla de arriba. En la de 3 argumentos los «todos null» se miran con `p_result`, el
   `share_result` y el `done` que ya tiene la fila (`case when p_result is null and share_result is null and done is
   null then null else auth.uid() end`; en un `update`, `share_result`/`done` sin prefijo son los valores viejos). En la
   de 4: con `p_result`, `p_share_result` y el `done` de la fila.
4. `org_list`: en el objeto de cada fila, sumar `'done', a.done, 'result_by', a.result_by, 'result_by_name',
   rb.full_name, 'result_at', a.result_at` (`left join public.profiles rb on rb.id = a.result_by`), y
   `can_set_result` = (la expresión vigente) `or (v_role = 'field_assistant' and a.profile_id = auth.uid()
   and a.work_date = (now() at time zone 'America/La_Paz')::date and (a.result_by is null or a.result_by = auth.uid()))`.
   Nada más cambia.
5. Encabezado «Deshacer»: volver a crear las 3 funciones con `vigentes.sql`,
   `drop function public.org_report_result(uuid, integer, integer, boolean, text);` y
   `alter table public.org_assignments drop column done, drop column result_by, drop column result_at;`.
6. Relee la migración completa buscando líneas cortadas o paréntesis sin cerrar (QA la aplica; si falla una línea,
   falla toda).

### B. App

1. `src/features/organization/logic.ts`: exporta `resultState` y `registeredBy` (firmas exactas en RF-05 de la spec).
2. `api.ts`:
   - `Assignment` suma `done: boolean | null`, `result_by: string | null`, `result_by_name: string | null`,
     `result_at: string | null` (comentados como los vecinos).
   - `setAssignmentResult` recibe también `done: boolean | null` y llama `org_report_result` con
     `p_id, p_result, p_share_result, p_done, p_notes`.
   - En `rpc`: `error.message === 'result_locked'` → `new Error('El encargado ya corrigió este resultado. Si hay que
     cambiarlo, pídeselo.')`.
3. `OrganizationPage.tsx`:
   - El botón de resultado se muestra con `r.can_set_result` (quitar `&& !ownOnly` **solo** ahí; «Editar» y «✕»
     siguen ocultos para el auxiliar). Texto: «Registrar resultado» si `ownOnly`, «Resultado» si no. Revisa también la
     vista de tabla/escritorio y la de tarjeta móvil: en las dos.
   - `ResultCell`: con `resultState` → `'pending'` «Pendiente» (igual que hoy), `'score'` como hoy, `'done'` «Hecho» en
     verde, `'not_done'` «No hecho» en rojo (colores del tema que ya usa `Score`).
   - Debajo del resultado, si `registeredBy(r)` no es null, una línea chica gris con ese texto.
4. `ResultDialog.tsx`:
   - Si la tarea no tiene ninguna meta (`!a.uses_goal && !a.uses_share_goal && a.goal === null && a.share_goal ===
     null`): grupo «¿Se hizo?» con dos botones «Hecho» y «No hecho» (`aria-pressed`), que empiezan con `a.done`;
     tocar el elegido lo desmarca (null). Va arriba de Captados.
   - Manda `done` (el elegido; en tareas con meta manda `a.done` sin cambio).
   - Error del servidor: se muestra en el diálogo y no se cierra (ya lo hace).
5. `exportOrganization.ts`: después de «Resul. compartidas», columnas «Hecho» (`'Sí'` / `'No'` / null) y al final
   «Registrado por» (`result_by_name`).

Criterios que QA prueba en el navegador (cuenta `aux.verdolago` y `enc.verdolago`):
1. En «Mi plan», una tarea de hoy sin resultado muestra «Registrar resultado»; una de ayer no.
2. Guardar 12 captados actualiza la tarjeta sin recargar.
3. En una tarea sin meta, «Hecho» deja la tarjeta en «Hecho»; el encargado la ve igual y **sin** «Registrado por»
   (lo registró la persona de la tarea); cuando el encargado la corrige, el auxiliar ve «Registrado por Encargado
   Verdolago» y ya no ve el botón.
4. A 360 px la tarjeta no desborda con el botón.

## Límites

- No modifiques pruebas existentes ni migraciones anteriores.
- Sin dependencias nuevas; sin `config.toml` ni `.env*`.
- Sin comandos de base de datos, docker, git ni red. Sin commit.
- TypeScript estricto sin `any`; async/await; arrow en callbacks; comentarios en español; código y BD en inglés.
  Mismo formato que los archivos vecinos (Prettier del proyecto), sin líneas de JSX kilométricas.

## Cómo comprobar

```sh
npx vitest run
npx tsc -b
npx eslint .
```

## Qué entregar

Resumen corto: archivos cambiados, salida de los comandos, dónde se resuelve cada criterio y decisiones propias.
