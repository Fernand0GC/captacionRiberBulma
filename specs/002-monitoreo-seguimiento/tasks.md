---

description: "Tareas de implementación: Monitoreo de seguimiento y actividad del personal"
---

# Tasks: Monitoreo de seguimiento y actividad del personal

**Input**: Documentos de diseño en `/specs/002-monitoreo-seguimiento/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (rpc.md, ui-routes.md, excel-export.md), quickstart.md

**Tests**: incluidos. La constitución pide Vitest para cálculos de reportes y el plan/quickstart definen pgTAP (permisos por rol y conteos) y Playwright.

**Organization**: por historia de usuario (spec.md), para entregar cada una por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1…US5 de spec.md

## Reglas operativas (CLAUDE.md)

- Migraciones: aplicar en local con `supabase migration up`. **Nunca `supabase db reset`**. Nada en producción sin autorización.
- Datos de prueba: limpiar con `pnpm db:clean`.
- Git (commit/branch/push) lo hace el usuario.
- Código y BD en inglés; UI en español.

---

## Phase 1: Setup

**Purpose**: estructura de la feature

- [X] T001 Crear la carpeta `src/features/monitoring/` y `src/features/monitoring/labels.ts` con: `FOLLOWUP_TABS` (`sin_contactar`→`['capture']`, `seguimiento`→`['followup','recapture']`, `potencial`→`['interested']`, `venta`→`['sale']`, `sin_interes`→`['lost']`) y etiquetas en español ("Sin contactar", "Seguimiento / Recaptación", "Cliente potencial", "Venta", "Sin interés", "Todos"); `ACTIVITY_METRICS` (`calls`, `messages`, `store`, `effective`, `no_answer`, `visits`, `sales`, `clients`, `total`) con etiquetas ("Llamadas", "Mensajes", "En tienda", "Efectivos", "No contestó", "Visitas pactadas", "Ventas", "Clientes contactados", "Total"); `METHOD_LABEL` (`call` y `whatsapp_call` → "Llamada", `message` → "Mensaje", `store` → "En tienda"). Reutilizar `RESULT_LABEL` de `src/features/followup/api.ts` y `STAGE_LABEL`/`INTEREST_LABEL` de `src/features/prospects/format.ts` (no duplicar)

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: parámetros de URL, barra de filtros compartida y selector de vista en `/gestion`

- [X] T002 Extender `ManageSearch` y `validateManageSearch` en `src/features/prospects/search.ts` según `contracts/ui-routes.md`: `ver` acepta `'visitas' | 'seguimiento' | 'actividad'`; nuevos `estado` (`sin_contactar|seguimiento|potencial|venta|sin_interes`), `interes` (`alto|medio|bajo|sin`), `intentos` (`ninguno|1-2|3+`), `vencidos` (`1` → `true`), `sin_contacto` (`3|7|15|30`), `motivo` (entero), `orden` (string `^-?[a-z_]+$`), `persona` (uuid), `metrica` (`all|calls|messages|store|effective|no_answer|visits|sales`). Valores fuera de lista → `undefined`
- [X] T003 [P] Crear `tests/unit/manageSearch.test.ts` (search.test.ts es del buscador de productos) para cada parámetro nuevo: valor válido se conserva, inválido se descarta, `vencidos=1` → `true`
- [X] T004 Extraer de `src/features/prospects/ProspectsPage.tsx` la barra de filtros (período + rango, búsqueda, sucursal, registrado por, responsable, etapa, canal) a `src/features/prospects/ManageFilterBar.tsx` con props para elegir qué controles mostrar (`show: { search, author, assignee, stage, channel }`) y callbacks `setSearch`/`setQ`; `ProspectsPage` la usa sin cambio visible (verificar con `tests/e2e/manage-read.spec.ts`)
- [X] T005 En `src/features/prospects/ProspectsPage.tsx`: el grupo "Ver" pasa a 4 opciones (Captaciones · Visitas pactadas · Seguimientos · Actividad), con desplazamiento horizontal en celular; al cambiar de vista conservar `periodo/desde/hasta/sucursal` y limpiar `pagina`, `estado`, `interes`, `intentos`, `vencidos`, `sin_contacto`, `motivo`, `orden`, `persona`, `metrica`. Cuando `ver` es `seguimiento` o `actividad`, renderizar `React.lazy(() => import('@/features/monitoring/FollowupStatusView'))` / `ActivityView` dentro de `<Suspense>` en lugar de la tabla de captaciones, pasándoles `search`, `setSearch`, `branchId`, `isGlobal` y el nombre de la sucursal. Ocultar "Seleccionar" en esas vistas; el título de la página sigue la vista elegida. Crear stubs mínimos de `src/features/monitoring/FollowupStatusView.tsx` y `src/features/monitoring/ActivityView.tsx` (export nombrado + default) para que compile

**Checkpoint**: `/gestion?ver=seguimiento` y `?ver=actividad` cargan sus stubs; Captaciones y Visitas pactadas siguen igual.

---

## Phase 3: User Story 1 - Ver en qué punto está el seguimiento de cada cliente (Priority: P1) 🎯 MVP

**Goal**: vista Seguimientos con pestañas por estado, columnas de último contacto/observación/intentos/vencimiento, filtros nuevos y orden por atraso.

**Independent Test**: con clientes en distintas etapas y contactos, entrar como encargado a `?ver=seguimiento`: la suma de pestañas = Todos; cada fila muestra la última observación e intentos correctos; los filtros reducen bien; otra sucursal → `forbidden`.

### Tests US1

- [X] T006 [P] [US1] Escribir `supabase/tests/followup_status_test.sql` (pgTAP, estilo de `supabase/tests/list_prospects_test.sql`, usando `tests.login_as` de `00_helpers.sql`): datos con clientes en las 6 etapas, uno anulado y uno de otra sucursal; contactos con y sin nota (insert directo con `contacted_at` conocido o vía `add_followup`). Verificar: encargado ve solo su sucursal y `branch_id` ajeno → `forbidden`; jefe de ventas solo sus `profile_branches`; auxiliar → `forbidden`; anulado excluido; `by_tab` suma = `todos` y `total` respeta `tab`; `last_note`/`last_result` = contacto más reciente; `contacts_total` y `no_answer_streak`; `overdue` solo con `next_contact_at < now()` y etapa abierta; primer row es el vencido más atrasado; filtros `interest` (incluido `none`), `attempts` (`0`, `1-2`, `3+`), `stale_days`, `lost_reason_id`, `assigned='none'`; `days_without_contact` usa `client_created_at` si no hay contactos; rango > 366 días → `invalid_input`

### Implementation US1

- [X] T007 [US1] Crear `supabase/migrations/20261114000100_followup_status.sql` con `public.list_followup_status(f jsonb default '{}', p_limit int default 50, p_offset int default 0) returns jsonb` según `contracts/rpc.md`: `stable security definer set search_path = ''`; guardia `app_is_active() and is_manager()`; `v_branch := public.scoped_branch(...)`; parseo y validación de filtros como `list_prospects` (copiar el escape de `q` y `normalize_phone`); CTE `scope` (todos los filtros menos `tab`) con `left join lateral` al último `followups` (`order by contacted_at desc limit 1`), `count(*)` de followups, cálculo de `overdue` y `days_without_contact` en `America/La_Paz`; `by_tab` con `count(*) filter (where stage = ...)`; `base` = `scope` + `tab`; página con joins a `branches`, `profiles` (responsable, autor, actor del último contacto), `channels`, `lost_reasons`; orden `overdue desc, next_contact_at asc nulls last, days_without_contact desc, client_created_at, id`; `p_limit` máx. 200. `revoke execute ... from public, anon; grant ... to authenticated`. Aplicar con `supabase migration up` y correr `pnpm db:test` hasta que T006 pase
- [X] T008 [P] [US1] En `src/features/monitoring/api.ts`: tipos `FollowupStatusRow`, `FollowupStatusFilters`, `FollowupTab`; hook `useFollowupStatus(filters, page)` (React Query, `keepPreviousData`, clave `['monitoring','followup-status',filters,page]`) que llama `supabase.rpc('list_followup_status', { f, p_limit: 50, p_offset })` con `toAppError`; `fetchAllFollowupStatus(filters)` paginando de a 200 (como `fetchAllProspects`)
- [X] T009 [US1] Implementar `src/features/monitoring/FollowupStatusView.tsx`: mapea `search` → filtros RPC (`estado`→`tab`, `interes` `alto/medio/bajo/sin`→`high/medium/low/none`, `intentos` `3`→`3+`, `vencidos`, `sin_contacto`→`stale_days`, `motivo`→`lost_reason_id` solo si `estado=sin_interes`; período/sucursal/autor/canal/responsable/q como en `ProspectsPage`); usa `ManageFilterBar` (sin el filtro "Etapa", que lo reemplazan las pestañas) + controles nuevos: Interés, Intentos, Sin contacto hace más de (3/7/15/30 días), toggle "Solo vencidos", Motivo (solo en Sin interés; catálogo de `lost_reasons` leído con `supabase.from('lost_reasons')`); pestañas con `role="tablist"`/`aria-selected` y número de `by_tab`
- [X] T010 [US1] En `FollowupStatusView.tsx`, tabla de escritorio (`hidden md:table`) con columnas de `contracts/ui-routes.md`: Cliente · Responsable ("Sin asignar" si null) · Etapa (Badge) · Interés · No contestó (`n/3`) · Contactos · Último contacto (`fmtDate fmtTime` + forma + resultado) · Observación (una línea `truncate`, `title` con el texto completo; si es nula, mostrar el resultado en gris) · Próximo · Días sin contacto; filas vencidas con fondo ámbar y badge "Vencido"; tarjetas en celular (`md:hidden`) con nombre, etapa, interés, "No contestó n/3 · n contactos", observación `line-clamp-2`, próximo contacto y badge "Vencido". Fila/tarjeta navega a `/cliente/$id` con `<Link>`
- [X] T011 [US1] En `FollowupStatusView.tsx`: paginación de 50 (mismo componente/estilo de `ProspectsPage`, parámetro `pagina`), estados de carga y error, y estado vacío con mensaje según pestaña/filtro (p. ej. "No hay clientes vencidos", "Ningún cliente sin contactar en este período", genérico "No hay clientes con estos filtros")
- [X] T012 [P] [US1] Escribir `tests/e2e/monitoring.spec.ts` (caso US1) con `login` de `tests/e2e/helpers.ts`: encargado abre `/gestion?ver=seguimiento&periodo=mes`, ve las pestañas con números, cambia a "Sin contactar", filtra "Solo vencidos", abre un cliente y vuelve con "atrás" conservando filtros; en viewport 375 px se ven tarjetas y la página no tiene scroll horizontal

**Checkpoint**: US1 completa y entregable (MVP).

---

## Phase 4: User Story 2 - Ver cuánto trabaja cada persona (Priority: P1)

**Goal**: vista Actividad con una fila por persona, conteos por forma y resultado, fila de totales y orden por columna.

**Independent Test**: registrar contactos de dos personas hoy; en `?ver=actividad&periodo=hoy` cada número coincide, auxiliares sin contactos aparecen en cero, el encargado solo si contactó, totales = suma.

### Tests US2

- [X] T013 [P] [US2] Escribir `supabase/tests/agent_activity_test.sql` (pgTAP): contactos con `method` `call`, `whatsapp_call`, `message`, `store` y resultados `no_answer`, `visit_store`, `sold`; verificar por actor `calls` (suma `call`+`whatsapp_call`), `messages`, `store`, `effective`, `no_answer`, `visits`, `sales`, `clients` (distintos), `total`; invariantes `calls+messages+store = total` y `effective+no_answer = total`; auxiliar activa sin contactos aparece en cero; encargado sin contactos no aparece y con contactos sí; persona inactiva con contactos aparece con `active=false`; contacto sobre cliente reasignado cuenta para quien lo hizo; contactos de clientes anulados u otra sucursal excluidos; corte de día en La Paz (contacto 23:50 -04 cuenta ese día); alcance por rol y `forbidden` como en T006
- [X] T014 [P] [US2] Escribir `tests/unit/activity.test.ts` para `src/features/monitoring/activity.ts`: `activityTotals(rows)` suma cada columna; `sortActivity(rows, orden)` ordena asc/desc por cualquier métrica y por `full_name`, desempate estable por nombre

### Implementation US2

- [X] T015 [US2] Crear `supabase/migrations/20261114000200_agent_activity.sql` con `public.agent_activity(f jsonb default '{}') returns jsonb` según `contracts/rpc.md` y research R8: guardia + `scoped_branch`; validar `from/to` (≤ 366 días); CTE `contacts` = `followups` con `contacted_at` en el rango La Paz unidos a `prospects` vigentes del alcance (sucursal del cliente); CTE `people` = perfiles activos `field_assistant`/`field_supervisor` con `branch_id` en el alcance (`v_branch` o, si null, todas; para jefe de ventas `scoped_branch` ya devuelve una sola) ∪ `distinct actor_id` de `contacts`; agregados con `count(*) filter (...)` y `count(distinct prospect_id)`; salida `{ rows: [...] }` ordenada `total desc, full_name`. `revoke`/`grant` como siempre. Aplicar con `supabase migration up` y correr `pnpm db:test` hasta que T013 pase
- [X] T016 [P] [US2] Crear `src/features/monitoring/activity.ts` (puro): tipo `AgentActivityRow`, `activityTotals`, `sortActivity`, parseo de `orden` (`-sales` = desc)
- [X] T017 [P] [US2] En `src/features/monitoring/api.ts`: tipos `AgentActivityFilters`; hook `useAgentActivity(filters)` (clave `['monitoring','activity',filters]`) que llama `supabase.rpc('agent_activity', { f })`
- [X] T018 [US2] Implementar `src/features/monitoring/ActivityView.tsx`: solo filtros de período y sucursal (`ManageFilterBar` con los demás controles ocultos); tabla dentro de contenedor `overflow-x-auto` con columna "Personal" `sticky left-0` (fondo opaco) mostrando nombre, rol (`ROLE_LABEL`) y badge "Inactiva" si `active=false`; columnas numéricas de `ACTIVITY_METRICS` alineadas a la derecha (`tabular-nums`); cabeceras como botones ordenables que escriben `orden` en la URL con `aria-sort`; fila "Total" (`activityTotals`) al final, en negrita; carga, error y vacío ("Nadie registró contactos en este período")
- [X] T019 [US2] Agregar a `tests/e2e/monitoring.spec.ts` (caso US2): una auxiliar registra 2 contactos desde Mis contactos; el encargado abre `?ver=actividad&periodo=hoy` y ve los números esperados en la fila de la auxiliar y en Total; ordenar por "Ventas" cambia el orden

**Checkpoint**: US1 y US2 funcionan cada una por su cuenta.

---

## Phase 5: User Story 3 - Bajar del número al detalle (Priority: P2)

**Goal**: tocar persona o número en Actividad abre la lista de esos contactos; desde ahí se entra al cliente.

**Independent Test**: tocar "Ventas" de una persona → la lista tiene exactamente esa cantidad, todos "Compró"; tocar uno → ficha; atrás → misma vista.

- [X] T020 [US3] Agregar `public.list_agent_contacts(f jsonb, p_limit int default 50, p_offset int default 0) returns jsonb` a `supabase/migrations/20261114000200_agent_activity.sql` (si ya se aplicó en local, crear `supabase/migrations/20261114000300_agent_contacts.sql` en su lugar): misma base `contacts` que `agent_activity`, `actor_id` obligatorio (`invalid_input` detail `actor_id`), `metric` (`all` por defecto) traducido a la misma condición que su columna en `agent_activity`; join a `prospects` para `full_name`; orden `contacted_at desc, id`; `{ total, rows }`; `p_limit` máx. 200; `revoke`/`grant`
- [X] T021 [P] [US3] Agregar a `supabase/tests/agent_activity_test.sql`: para cada métrica, `list_agent_contacts.total` = valor de la celda en `agent_activity` con los mismos filtros; sin `actor_id` → `invalid_input`; alcance por rol
- [X] T022 [P] [US3] En `src/features/monitoring/api.ts`: tipo `AgentContactRow`; `useAgentContacts(filters, metric, actorId)` con `useInfiniteQuery` de a 50 (clave `['monitoring','agent-contacts',...]`), habilitado solo con `actorId`
- [X] T023 [US3] Crear `src/features/monitoring/AgentContactsDialog.tsx` con `Dialog` de `src/ui/Dialog`: título "Nombre · Métrica · período"; lista de contactos (cliente, `fmtDate fmtTime`, forma, resultado, observación) donde cada ítem es `<Link to="/cliente/$id">`; botón "Cargar más"; vacío "Sin contactos"
- [X] T024 [US3] En `src/features/monitoring/ActivityView.tsx`: nombre de persona → `setSearch({ persona: id, metrica: 'all' })`; números > 0 → `setSearch({ persona, metrica })` (métrica `clients` y `total` → `all`); ceros no tocables; montar `AgentContactsDialog` cuando `persona` está en la URL; cerrar → `setSearch({ persona: undefined, metrica: undefined })`
- [X] T025 [US3] Agregar a `tests/e2e/monitoring.spec.ts` (caso US3): tocar el número de "Visitas pactadas" de la auxiliar → diálogo con esa cantidad de filas; tocar una → `/cliente/…`; `page.goBack()` → diálogo y filtros siguen

**Checkpoint**: Actividad con detalle navegable.

---

## Phase 6: User Story 4 - Ver en el cliente quién lo contactó y cuántas veces (Priority: P2)

**Goal**: bloque "Contactos por persona" arriba del Historial en la ficha.

**Independent Test**: cliente contactado por dos personas → el bloque coincide con el Historial.

- [X] T026 [P] [US4] Crear `src/features/client/contactSummary.ts` (puro): `summarizeContacts(timeline: TimelineItem[])` → `{ actor, total, calls, messages, store }[]` agrupando items `type === 'contact'` por `actor` (`call` y `whatsapp_call` → `calls`), orden `total desc, actor`
- [X] T027 [P] [US4] Escribir `tests/unit/contactSummary.test.ts`: sin contactos → `[]`; dos actores con métodos mezclados; ignora items que no son `contact`; orden por total
- [X] T028 [US4] En `src/features/client/ClientPage.tsx`, arriba de la sección "Historial", agregar sección "Contactos por persona" (`aria-label`) con una línea por persona: nombre, total destacado y desglose ("3 llamadas · 1 mensaje · 1 en tienda", omitiendo ceros, singular/plural); sin contactos → "Sin contactos todavía"
- [X] T029 [US4] Agregar a `tests/e2e/client.spec.ts` (o `monitoring.spec.ts`) un caso: cliente con contactos de dos personas muestra el bloque con los totales correctos

**Checkpoint**: ficha con resumen por persona.

---

## Phase 7: User Story 5 - Llevarse los datos a Excel (Priority: P3)

**Goal**: exportar Seguimientos y Actividad con los filtros activos.

**Independent Test**: exportar con filtros → mismas filas/columnas que pantalla; observación completa; Actividad con fila TOTAL.

- [X] T030 [P] [US5] Crear `src/features/monitoring/exportFollowups.ts` según `contracts/excel-export.md` (hoja `SEGUIMIENTOS`): `import('exceljs')` dinámico + `fetchAllFollowupStatus(filters)`; encabezado con vista, sucursal y rango; fila de títulos congelada; observación completa; fechas con el ajuste de hora La Paz de `src/features/export/exportProspects.ts` (extraer `laPazWallClock` a un helper compartido si se reutiliza); nombre `Seguimientos_<sucursal>_<desde>_<hasta>.xlsx`; devuelve la cantidad de filas
- [X] T031 [P] [US5] Crear `src/features/monitoring/exportActivity.ts` (hoja `ACTIVIDAD`): filas en el orden de pantalla + fila `TOTAL` (`activityTotals`); columnas del contrato; nombre `Actividad_<sucursal>_<desde>_<hasta>.xlsx`
- [X] T032 [US5] Botón "Exportar Excel" en `FollowupStatusView.tsx` y `ActivityView.tsx` (import dinámico del exportador, estado "Exportando…", toast de error y de éxito con la cantidad; deshabilitado sin filas), con el mismo estilo que el de `ProspectsPage`
- [X] T033 [US5] Agregar a `tests/e2e/export.spec.ts` (o `monitoring.spec.ts`) un caso por vista: dispara la descarga, el archivo tiene el nombre esperado y la cantidad de filas de la pantalla

**Checkpoint**: todas las historias completas.

---

## Phase 8: Polish & Cross-Cutting

- [X] T034 [P] Actualizar `specs/001-captacion-mvp/contracts/ui-routes.md` (fila `/gestion`) para mencionar las vistas `ver=seguimiento|actividad` y enlazar `specs/002-monitoreo-seguimiento/contracts/ui-routes.md`
- [X] T035 Correr `pnpm typecheck && pnpm lint && pnpm test && pnpm db:test` y `pnpm size`; confirmar que el JS inicial no creció (vistas y exportadores en chunks separados)
- [X] T036 Correr `pnpm e2e` completo (incluye `manage-read.spec.ts`, `bulk-reassign.spec.ts`, `export.spec.ts` para no romper Captaciones)
- [ ] T037 Recorrer `specs/002-monitoreo-seguimiento/quickstart.md` (escenarios manuales 1–7) con `pnpm dev` en celular (375 px) y escritorio; limpiar datos de prueba con `pnpm db:clean` — *Pendiente: recorrido manual en celular real del usuario (los escenarios ya están cubiertos por `tests/e2e/monitoring.spec.ts` en Pixel 7 emulado)*
- [X] T038 Proponer al usuario los comandos git (rama `002-monitoreo-seguimiento`, commit, push) y, solo con autorización explícita, el paso de migraciones a producción

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)** → **Foundational (2)** → historias.
- **US1 (3)**: depende solo de Foundational.
- **US2 (4)**: depende solo de Foundational (independiente de US1).
- **US3 (5)**: depende de US2 (usa `ActivityView` y la migración de actividad).
- **US4 (6)**: independiente de todo lo demás (solo `ClientPage`); puede ir en paralelo desde el inicio.
- **US5 (7)**: depende de US1 (Excel Seguimientos) y US2 (Excel Actividad); cada exportador puede hacerse apenas su vista esté.
- **Polish (8)**: al final.

### Within Each User Story

- Test pgTAP primero (debe fallar) → migración → api.ts → vista → e2e.
- T007 antes de T009–T011; T015 antes de T018; T020 antes de T022–T024.

### Parallel Opportunities

- T003 en paralelo con T004–T005.
- US1 y US2 en paralelo por dos personas (archivos distintos salvo `api.ts`: coordinar o hacerlas secuenciales en ese archivo).
- US4 (T026–T028) en paralelo con cualquier fase.
- T030 y T031 en paralelo.

---

## Parallel Example: User Story 2

```bash
# Tests y piezas puras a la vez:
Task: "T013 supabase/tests/agent_activity_test.sql"
Task: "T014 tests/unit/activity.test.ts"
Task: "T016 src/features/monitoring/activity.ts"
Task: "T017 useAgentActivity en src/features/monitoring/api.ts"
# Luego: T015 (migración) → T018 (vista) → T019 (e2e)
```

## Parallel Example: User Story 4

```bash
Task: "T026 src/features/client/contactSummary.ts"
Task: "T027 tests/unit/contactSummary.test.ts"
# Luego: T028 (ClientPage) → T029 (e2e)
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2.
2. Phase 3 (US1) → validar con quickstart escenario 1 y 2 → entregable: el encargado ya ve en qué punto está cada cliente.

### Incremental Delivery

1. US1 (Seguimientos) → demo.
2. US2 (Actividad) → demo.
3. US3 (detalle) + US4 (resumen en ficha) → demo.
4. US5 (Excel) → cierre.

Cada incremento se puede subir solo: las migraciones están separadas por historia y las vistas son chunks lazy.
