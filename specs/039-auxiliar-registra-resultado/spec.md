# Spec 039 · El auxiliar registra el resultado de sus tareas en «Mi plan»

**Rama**: `feat/039-auxiliar-registra-resultado` · **Creada**: 2026-11-28 · **Estado**: Implementada 2026-11-28 (rama local, sin push ni producción).

**Origen**: observación 13 de ventas («APP - CAPTACION», 2026-11-28): «que el mismo encargado de la tarea pueda
registrar el resultado; por ejemplo los aux tienen sus tareas asignadas pero solo las pueden ver». Captura de «Mi plan»
de una auxiliar a las 9:22: todas las tareas en «Pendiente», incluso la de 08:30–08:45 que ya pasó; varias sin meta
(Acomodo de tienda, Tareas administrativas, Comentarios). Usa las reglas de resultados de la spec 032 y el avance de
metas de la 037.

## Qué resuelve

Hoy «Mi plan» es solo de lectura: el auxiliar ve sus tareas pero el resultado lo escribe el encargado. Con esta spec el
auxiliar registra él mismo, el mismo día, lo que hizo en cada tarea suya (captados, compartidas o «Hecho / No hecho»),
y el encargado ve quién lo registró y lo puede corregir.

## Cómo encaja en el sistema

- Tabla `org_assignments`: se suman `done`, `result_by` y `result_at`. `result`, `share_result` y `notes` son los
  mismos de siempre, así lo que registra el auxiliar ya cuenta en Metas (spec 037) y en el bloqueo de la spec 032.
- Función nueva `org_report_result`; las dos `org_set_result` (app publicada) siguen y además anotan quién registró.
- `org_list` suma `done`, `result_by`, `result_by_name`, `result_at` y abre `can_set_result` al auxiliar.
- Pantalla: la misma `/planificacion` («Mi plan» para el auxiliar) y el mismo `ResultDialog`.
- No se toca: `org_results_pending` / `org_check_results` (spec 032), `goals_for_day` (037), `org_verify_shares`.

## Decisiones (decisión del usuario 2026-11-28: «lo recomendado», sin esperar respuestas de ventas)

- **D1 · Solo sus tareas y solo el mismo día.** Igual que el encargado desde la spec 032; un día pasado lo corrigen las
  jefas. Evita que se «arreglen» números días después.
- **D2 · Lo que registra el auxiliar vale directo; el encargado lo puede corregir.** Sin paso de aprobación: sería más
  trabajo para el encargado, que es justo lo que la observación quiere quitar.
- **D3 · La corrección del encargado manda.** Si el último que registró es otra persona (encargado, supervisor, jefa),
  el auxiliar ya no puede cambiarlo (`result_locked`). Si el encargado borra todo el resultado, se libera otra vez.
- **D4 · «Hecho / No hecho» para tareas sin meta.** Columna `done` (null = sin marcar). En tareas con meta no hace falta.
  No cuenta para el bloqueo de la spec 032 (que solo mira metas).
- **D5 · Se guarda quién registró y cuándo** (`result_by`, `result_at`), también desde las `org_set_result` viejas.
  En la tarjeta se ve «Registrado por X» cuando no fue la propia persona.
- **D6 · Observaciones compartidas.** El auxiliar escribe en las mismas «Observaciones» (`notes`) del resultado, como hoy
  el encargado. Costo aceptado: si el encargado había dejado una nota al planificar, el auxiliar la ve y la puede
  cambiar.
- **D7 · Fuera de alcance: tareas que se cruzan de horario** (09:00–12:30 y 10:00–12:30 en la captura). Se decide aparte
  con lo que responda ventas.

## Vocabulario

- **Registrar resultado**: escribir captados, compartidas y/o hecho de una asignación.
- **Quién registró**: la última persona que cambió el resultado (`result_by`).

## Historias

### H1 · El auxiliar registra su resultado (P1)

1. **Dado** un auxiliar con una tarea suya de hoy sin resultado, **cuando** abre «Mi plan», **entonces** ve el botón
   «Registrar resultado» en esa tarea; al guardar 12 captados, la tarjeta muestra «12 de 20 · 60 %» sin recargar.
2. **Dado** una tarea suya sin meta (Tareas administrativas), **cuando** registra, **entonces** elige «Hecho» o
   «No hecho» y la tarjeta muestra «Hecho» (verde) o «No hecho» (rojo).
3. Permisos: una tarea suya de ayer, o una tarea de otra persona, no muestra el botón y la base rechaza con `forbidden`.
4. Permisos: la volantera no puede (`forbidden`).
5. Error: 10000 captados → `invalid_input` / `result`; observaciones de más de 300 caracteres → `invalid_input` / `notes`.

### H2 · El encargado ve y corrige (P1)

1. **Dado** un resultado registrado por el auxiliar, **cuando** el encargado mira la Planificación, **entonces** ve el
   resultado y lo puede cambiar con «Resultado».
2. **Dado** que el encargado corrigió, **cuando** el auxiliar intenta cambiarlo, **entonces** no ve el botón y la base
   rechaza con `result_locked`; la app dice «El encargado ya corrigió este resultado. Si hay que cambiarlo, pídeselo.»
3. **Dado** que el encargado borra todo el resultado (captados, compartidas y hecho vacíos), **entonces** el auxiliar
   puede volver a registrarlo.
4. La tarjeta muestra «Registrado por X» cuando quien registró no es la persona de la tarea.

## Requisitos

- **RF-01** Migración `20261128000100_own_result.sql`: columnas en `org_assignments`:
  `done boolean null`, `result_by uuid null references public.profiles(id)`, `result_at timestamptz null`.
- **RF-02** `org_report_result(p_id uuid, p_result integer, p_share_result integer, p_done boolean, p_notes text)
  returns void`, `security definer`, `search_path = ''`, `execute` solo para `authenticated`:
  - `not_found` si no existe la asignación.
  - Puede quien ya podía con la spec 032 (`org_can_replan(sucursal, día)` o, antes de `org_day_close_since()`,
    `manages_org(sucursal)`), **o** el auxiliar (`app_role() = 'field_assistant'`, `app_is_active()`) dueño de la
    asignación (`profile_id = auth.uid()`) si `work_date` = hoy en Bolivia. Si no, `forbidden`.
  - El auxiliar recibe `result_locked` si `result_by` no es null ni él mismo.
  - Valida `result` y `share_result` entre 0 y 9999 (`invalid_input` con detalle `result` / `share_result`) y `notes`
    hasta 300 caracteres (`notes`).
  - Guarda `result`, `share_result`, `done`, `notes` (recortado, vacío = null), `updated_by`, `updated_at`. Si
    `result`, `share_result` y `done` quedan todos null: `result_by = null`, `result_at = null`; si no,
    `result_by = auth.uid()`, `result_at = now()`.
- **RF-03** Las dos `org_set_result` (3 y 4 argumentos) conservan sus reglas y además ponen `result_by`/`result_at` con la
  misma regla de RF-02 (en la de 3 argumentos cuenta `result` y el `share_result`/`done` que ya tenía la fila).
- **RF-04** `org_list` suma por fila `done`, `result_by`, `result_by_name` (nombre de quien registró) y `result_at`; y
  `can_set_result` = la regla de la spec 032 **o** (la persona es auxiliar, la fila es suya, es de hoy y `result_by` es
  null o ella misma).
- **RF-05** Lógica pura en `src/features/organization/logic.ts`:
  - `resultState(a: { result: number | null; share_result: number | null; done: boolean | null })` →
    `'score'` si hay `result` o `share_result`; si no `'done'` / `'not_done'` según `done`; si no `'pending'`.
  - `registeredBy(a: { profile_id: string; result_by: string | null; result_by_name: string | null })` →
    `'Registrado por X'` si `result_by` existe y es distinto de `profile_id`; si no `null`.
- **RF-06** App:
  - `Assignment` suma `done: boolean | null`, `result_by: string | null`, `result_by_name: string | null`,
    `result_at: string | null`.
  - `setAssignmentResult` llama `org_report_result` y manda `done`.
  - `result_locked` → «El encargado ya corrigió este resultado. Si hay que cambiarlo, pídeselo.»
  - El botón de resultado se muestra con `can_set_result` (sin el `!ownOnly`). En «Mi plan» dice «Registrar
    resultado»; en la Planificación sigue «Resultado».
  - `ResultDialog`: si la tarea no tiene ninguna meta (sin `uses_goal`, `uses_share_goal`, `goal`, `share_goal`), un
    selector «¿Se hizo?» con «Hecho» y «No hecho» (se puede desmarcar tocando el elegido). Captados sigue como hoy.
  - Tarjeta y tabla: «Hecho» en verde / «No hecho» en rojo cuando `resultState` lo dice; «Registrado por X» en gris
    debajo, cuando `registeredBy` no es null.
  - Excel de la Planificación: columnas «Hecho» (Sí / No / vacío) y «Registrado por».

## Criterios de éxito

- Cada escenario tiene prueba de base (`supabase/tests/own_result_test.sql`), de lógica
  (`tests/unit/ownResult.test.ts`) o comprobación en el navegador.
- El auxiliar registra una tarea en menos de 3 toques desde «Mi plan».
- Ninguna prueba existente deja de pasar (base local: 5 pgTAP rojos desde antes).

## Fuera de alcance (después)

- Bloquear o avisar tareas que se cruzan de horario (D7).
- Contar captados automáticamente desde las captaciones registradas.
- Aprobación del encargado; evidencia con foto.

## Por validar con ventas

- Que el auxiliar no pueda tocar lo que el encargado corrigió (D3).
- Que «Hecho / No hecho» alcance para las tareas sin meta, o si quieren foto o comentario obligatorio.
- Si el supervisor o las volanteras/freelancers de la tarea también deberían registrar.

## Evidencia (2026-11-28)

| Comprobación | Resultado |
|---|---|
| pgTAP `own_result_test.sql` | 30/30 |
| pgTAP del proyecto | 53/58 archivos; los 5 rojos son los de siempre por datos locales (acomodo_tienda_channel, capture_high_interest, followup, org_catalog, referrals) |
| Vitest | 453/453 (incluye `ownResult.test.ts`) |
| tsc / eslint | 0 errores |
| Navegador (aux.verdolago y enc.verdolago, 360 px y escritorio) | 16/16 |

Ajuste de prueba: `tests/unit/organization.test.ts` suma los 4 campos nuevos de `Assignment` en su dato de ejemplo
(cambio de contrato de esta spec).

## Nota para Fer

- Archivos: `src/features/organization/{OrganizationPage,ResultDialog,api,logic,exportOrganization}.ts(x)`.
- Migración `20261128000100_own_result.sql`: 3 columnas nuevas en `org_assignments`, función nueva
  `org_report_result`, reemplaza las dos `org_set_result` y `org_list`. **Orden: migración primero, push después**
  (la app nueva llama a `org_report_result`; la app vieja sigue funcionando con la base nueva).
- Producción: `RB-union/precheck-039-produccion.sql` (solo lectura, huellas md5) y luego
  `RB-union/migraciones-039-produccion.sql` (con registro en `schema_migrations`).
- Verificar: con una cuenta de auxiliar, «Mi plan» muestra «Registrar resultado» en las tareas de hoy.
- Volver atrás: ver «Deshacer» en el encabezado de la migración (cuerpos en `codex/vigentes.sql`).
- Riesgo nuevo: el auxiliar ahora escribe `result`, que alimenta Metas (spec 037). Lo puede corregir el encargado.
