---

description: "Task list for 001-captacion-mvp"
---

# Tasks: MVP de captación de clientes

**Input**: Design documents from `/specs/001-captacion-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (rpc, sync, excel-export, ui-routes), quickstart.md

**Tests**: SÍ se incluyen. La constitución (Flujo de desarrollo) y research R15 exigen Vitest para la lógica, pgTAP para RLS/RPC y Playwright para el flujo offline. Las pruebas de cada historia se escriben primero y deben fallar antes de implementar.

**Organization**: Tareas agrupadas por historia (orden de prioridad: US1, US2 [P1] → US3, US7, US4, US6 [P2] → US5 [P3]).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de spec.md (US1…US7)
- Rutas relativas a la raíz del repo `riber-captacion/`

## Path Conventions

SPA única: `src/`, `tests/`, backend declarativo en `supabase/` (ver plan.md → Project Structure).
Migraciones: `supabase/migrations/2026102800NN00_<nombre>.sql`, en el orden de las tareas.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializar el proyecto y las herramientas

- [X] T001 Scaffold Vite + React 18.3 + TypeScript strict con pnpm en la raíz (`package.json`, `tsconfig.json` con `strict: true`, `vite.config.ts`, `index.html`, `src/main.tsx`)
- [X] T002 [P] Configurar Tailwind CSS 4 (`src/index.css`, plugin en `vite.config.ts`) y la base tipográfica para celular (botones ≥48 px)
- [X] T003 [P] Configurar ESLint + Prettier (`eslint.config.js`, `.prettierrc`) y los scripts `lint`, `format` y `typecheck` en `package.json`
- [X] T004 [P] Configurar Vitest (`vitest.config.ts`, `tests/unit/`) y el script `test`
- [X] T005 [P] Configurar Playwright con un perfil de celular Android emulado (`playwright.config.ts`, `tests/e2e/`) y el script `e2e`
- [X] T006 [P] Configurar size-limit con presupuesto de 170 KB gzip para el chunk inicial (`.size-limit.json`, script `size`)
- [X] T007 Inicializar Supabase local (`supabase init` → `supabase/config.toml`; zona horaria `America/La_Paz` en `config.toml`/`seed.sql`)
- [X] T008 [P] Crear `.env.example` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; documentar el arranque en `README.md` según quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Esquema base, identidad, permisos, cliente y app shell que usan todas las historias

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta terminar esta fase

### Base de datos

- [X] T009 Migración de enums (`app_role`, `contract_type`, `shift`, `interest_level`, `product_line`, `prospect_stage`, `prospect_status`, `contact_result`, `activity_status`) en `supabase/migrations/20261028000100_enums.sql` según data-model.md
- [X] T010 Migración de catálogos `branches`, `channels`, `products` (con `line`), `lost_reasons`, `agenda_strategies`, `settings` con RLS (SELECT a usuarios activos; escritura solo admin) en `supabase/migrations/20261028000200_catalogs.sql`
- [X] T011 Migración de `profiles` (checks de `branch_id` por rol, username en minúsculas) y funciones helper `app_role()`, `app_branch()`, `app_is_active()`, `is_field()`, `is_manager()`, `can_follow_up()` (`security definer stable`, `search_path=''`) con RLS en `supabase/migrations/20261028000300_profiles.sql`
- [X] T012 Migración de `audit_log` (solo inserción) y de la función trigger genérica `audit_row()` que guarda solo los campos que cambiaron en `supabase/migrations/20261028000400_audit.sql`
- [X] T013 Migración de las funciones `normalize_phone(text)` y `is_valid_phone(text)` (research R10), y `shift_for(timestamptz)` que lee el corte de `settings` (R12), en `supabase/migrations/20261028000500_functions.sql`
- [X] T014 Seed local: 10 sucursales, catálogos iniciales (canales, productos provisionales con línea, motivos provisionales, estrategias), `shift_cutoff`, y un usuario de prueba por rol en `supabase/seed.sql`
- [X] T015 [P] Pruebas pgTAP de `normalize_phone`, `is_valid_phone` y `shift_for` (formatos `+591`, espacios, guiones, fijo vs. celular, corte 13:00) en `supabase/tests/functions_test.sql`
- [X] T016 [P] Prueba pgTAP: un usuario inactivo no lee ni escribe catálogos ni perfiles, y los helpers devuelven el rol y la sucursal correctos, en `supabase/tests/profiles_test.sql`

### Cliente y app shell

- [X] T017 [P] Cliente Supabase con sesión persistida y refresco de token en `src/lib/supabase.ts`
- [X] T018 [P] Generador UUID v7 sin dependencias en `src/lib/uuidv7.ts` + prueba (orden temporal, formato) en `tests/unit/uuidv7.test.ts`
- [X] T019 [P] Normalización y validación de teléfono (mismas reglas que T013) en `src/lib/phone.ts` + pruebas con los mismos casos que T015 en `tests/unit/phone.test.ts`
- [X] T020 [P] Utilidades de fecha en La Paz y turno en `src/lib/dates.ts` + pruebas en `tests/unit/dates.test.ts`
- [X] T021 [P] Mapa de errores RPC (`code` → mensaje en español) en `src/lib/errors.ts`
- [X] T022 [P] Componentes UI base (Button, Field, Select con Radix, Dialog con Radix, Badge, Toast) en `src/ui/`
- [X] T023 Router TanStack con rutas lazy, layout y guard por rol que redirige según contracts/ui-routes.md en `src/app/router.tsx` y `src/app/guards.tsx`
- [X] T024 Providers (QueryClient, sesión) en `src/app/providers.tsx`
- [X] T025 Login usuario + contraseña (mapea a `<usuario>@captacion.riberbulma.local`), carga de perfil, pantalla "Usuario desactivado" y logout en `src/features/auth/` (`LoginPage.tsx`, `useSession.ts`, `useProfile.ts`)
- [X] T026 Edge Function `admin-users` con la acción `create` (verifica que quien llama sea admin; crea el usuario en Auth con email sintético + `profiles`) en `supabase/functions/admin-users/index.ts`

**Checkpoint**: Login funcionando por rol, esquema base con RLS y pruebas de helpers en verde

---

## Phase 3: User Story 1 - Registrar una captación en campo (Priority: P1) 🎯 MVP

**Goal**: Registrar → Guardar → Registrar, solo crear, sin señal, teléfono único global, conteo propio

**Independent Test**: 10 captaciones (5 en modo avión) llegan completas con autor, sucursal, fecha y turno; el usuario de campo no puede leerlas (quickstart escenarios 1–6)

### Tests for User Story 1 ⚠️ (escribir primero, deben fallar)

- [X] T027 [P] [US1] pgTAP `submit_capture`: acepta, es idempotente por `id`, guarda duplicado como `duplicate_rejected` sin devolver datos, fuerza la sucursal del perfil para el campo, recorta fechas futuras, reglas para inactivos (R9: dentro de la ventana de 7 días y con `late_after_deactivation`, fuera de ella `forbidden`), límite de 120 por minuto, conserva la sucursal original aunque el autor cambie de sucursal, en `supabase/tests/submit_capture_test.sql`
- [X] T028 [P] [US1] pgTAP permisos US1: los roles de campo obtienen 0 filas en SELECT de `prospects`; no hay INSERT/UPDATE/DELETE directo; `phone_available` con límite de llamadas; `my_capture_stats` y `my_rejections` solo devuelven lo propio, en `supabase/tests/rls_capture_test.sql`
- [X] T029 [P] [US1] Pruebas unitarias del outbox y el sender (borra al recibir `accepted` o `duplicate`, backoff también ante `rate_limited`, `blocked`, filtro por `userId`, un solo envío a la vez) con fake-indexeddb en `tests/unit/outbox.test.ts`
- [X] T030 [P] [US1] E2E offline: registrar online, pasar a offline, registrar, recargar y volver online; verificar el contador, la insignia de pendientes y la llegada al servidor, y que Guardar responda en ≤100 ms (constitución II), en `tests/e2e/capture-offline.spec.ts`

### Implementation for User Story 1

- [X] T031 [US1] Migración de `prospects` (campos, checks, índice único parcial de `phone_norm`, índices) y `stage_events` (solo inserción, con trigger que rechaza UPDATE/DELETE) con RLS (sin SELECT para el campo) en `supabase/migrations/20261028000600_prospects.sql`
- [X] T032 [US1] Migración de `rate_limits` y de las RPC `submit_capture`, `phone_available`, `my_capture_stats` y `my_rejections` según contracts/rpc.md en `supabase/migrations/20261028000700_capture_rpc.sql`
- [X] T033 [P] [US1] Base Dexie (`outbox`, `meta`) según contracts/sync.md en `src/features/sync/db.ts`
- [X] T034 [US1] Sender del outbox (disparadores: inicio, `online`, `visibilitychange`, después de Guardar, cada 30 s; lock con `navigator.locks`; backoff; manejo de 401) en `src/features/sync/sender.ts`
- [X] T035 [P] [US1] Hook `useSyncStatus` (pendientes, sincronizando, sin conexión) y componente `SyncBadge` en `src/features/sync/`
- [X] T036 [P] [US1] Catálogos para el formulario (canales y productos activos) con caché offline en `src/features/capture/useCatalogs.ts`
- [X] T037 [US1] Pantalla `/registrar`: botón Registrar, contador del día (`my_capture_stats` + pendientes locales), `SyncBadge` y avisos de duplicado (`my_rejections`), en `src/features/capture/RegisterHome.tsx`
- [X] T038 [US1] Formulario `/registrar/nuevo`: validación local, `phone_available` si hay señal, guardar en el outbox con UUID v7 y `client_created_at`, disparar el envío y volver a `/registrar`; teclado numérico y layout de una columna desde 360 px, en `src/features/capture/CaptureForm.tsx`
- [X] T039 [US1] Bloqueo de logout con pendientes (descartar con doble confirmación) y no enviar pendientes de otro usuario, en `src/features/auth/useLogout.ts`
- [X] T040 [US1] PWA con `vite-plugin-pwa` (generateSW, precache del shell, manifest con íconos, aviso de actualización que no recarga si hay pendientes, `navigator.storage.persist()`) en `vite.config.ts` y `src/app/pwa.ts`

**Checkpoint**: US1 completa. Se puede hacer un piloto de solo registro en una sucursal

---

## Phase 4: User Story 2 - Gestionar captaciones desde el módulo completo (Priority: P1)

> **Re-alcance 2026-10-28 (pedido del usuario):** primero un panel **solo de lectura** (T083–T088). Edición, asignación,
> anulación y duplicados (T041–T048) quedan después, sin cambios de diseño.

### Panel de solo lectura (primero)

- [X] T083 [P] [US2] pgTAP de `list_prospects`: el encargado solo su sucursal (otra → forbidden), gerente/admin todas, roles de campo forbidden, filtros de fecha (La Paz), autor, canal, búsqueda por nombre y celular, paginación y total, excluye anuladas y duplicadas, en `supabase/tests/list_prospects_test.sql`
- [X] T084 [US2] RPC `list_prospects(filters jsonb, limit, offset)` (POST: la búsqueda nunca va en una URL) + `staff_options()` para el filtro "registrado por", en `supabase/migrations/20261028000800_manage_read.sql`
- [X] T085 [P] [US2] Hooks de datos con TanStack Query en `src/features/prospects/api.ts`
- [X] T086 [US2] Pantalla `/gestion`: filtros (período, sucursal, autor, canal en la URL; búsqueda solo en estado), tabla en escritorio y tarjetas en celular, total y paginación, en `src/features/prospects/ProspectsPage.tsx`
- [X] T087 [US2] Encabezado de gestión con la marca y salir, en `src/features/prospects/ManageHeader.tsx`
- [X] T088 [P] [US2] E2E: el encargado ve solo su sucursal con autor, fecha y hora; el gerente ve todas; búsqueda por celular, en `tests/e2e/manage-read.spec.ts`

### Edición y gestión completa (después)

**Goal**: Listado, búsqueda y filtros, ficha, edición auditada, duplicados, anulación (solo admin), registro desde gestión

**Independent Test**: El encargado ve solo su sucursal y edita con auditoría; el gerente ve todas; solo el admin anula (quickstart escenario 7)

### Tests for User Story 2 ⚠️

- [X] T041 (hecho como ficha /cliente/$id con RPC get_prospect/update_prospect/void_prospect, 2026-10-29) [P] [US2] pgTAP permisos de gestión: el encargado solo ve y edita su sucursal; el gerente ve y edita todas; `void_prospect` solo para admin; `update_prospect` revalida que el teléfono sea único y deja auditoría, en `supabase/tests/rls_manage_test.sql`
- [X] T042 (hecho como ficha /cliente/$id con RPC get_prospect/update_prospect/void_prospect, 2026-10-29) [P] [US2] E2E: el encargado filtra, edita y ve la auditoría; el admin anula y la ficha desaparece del listado, en `tests/e2e/manage.spec.ts`

### Implementation for User Story 2

- [X] T043 (hecho como ficha /cliente/$id con RPC get_prospect/update_prospect/void_prospect, 2026-10-29) [US2] Migración: políticas SELECT de `prospects` para gestores, vista `v_prospects` (`security_invoker`), índice trigram de `full_name`, trigger `audit_row` en `prospects`, RPC `update_prospect` y `void_prospect` en `supabase/migrations/20261028000800_manage.sql`
- [X] T044 (hecho como ficha /cliente/$id con RPC get_prospect/update_prospect/void_prospect, 2026-10-29) [P] [US2] Hooks de datos (listado paginado con filtros, ficha, auditoría) con TanStack Query en `src/features/prospects/api.ts`
- [ ] T045 [US2] Listado `/gestion` con TanStack Table (lazy): filtros en search params tipados (sucursal fija para el encargado; `vence=hoy|vencidos` por `next_contact_at`; `tras_baja`); la búsqueda `q` va en el estado local, **nunca** en la URL, en `src/features/prospects/ProspectsList.tsx`
- [X] T046 (hecho como ficha /cliente/$id con RPC get_prospect/update_prospect/void_prospect, 2026-10-29) [US2] Ficha `/gestion/$id`: datos editables, historial de etapas, auditoría, anular (solo admin, con motivo) en `src/features/prospects/ProspectDetail.tsx`
- [ ] T047 [P] [US2] `/gestion/nuevo`: reutiliza `CaptureForm` en modo online con selector de sucursal (gerente y admin) en `src/features/prospects/ManageCreate.tsx`
- [ ] T048 [P] [US2] `/gestion/duplicados`: lista de `duplicate_rejected` con fecha y autor del original en `src/features/prospects/DuplicatesList.tsx`

**Checkpoint**: US1 + US2 = el núcleo de captación operativo

---

## Phase 5: User Story 3 - Seguimiento y avance por etapas (Priority: P2)

**Goal**: El encargado asigna; el responsable ve solo lo suyo; gestiones; máquina de etapas

**Independent Test**: Asignar 3 al auxiliar → los ve solo él → gestión → Venta; las transiciones inválidas se rechazan (quickstart escenarios 8–9)

### Tests for User Story 3 ⚠️

- [X] T049 [P] [US3] pgTAP: transiciones válidas e inválidas de `change_stage`, motivo obligatorio en `lost`, `sale`/`lost` finales, `stage_events` inmutable, en `supabase/tests/stages_test.sql`
- [X] T050 [P] [US3] pgTAP: `assign_prospect` (solo destinatarios `can_follow_up` de la misma sucursal), el responsable solo ve sus asignados, `add_followup` idempotente y que pasa `capture` → `followup`, en `supabase/tests/followup_test.sql`
- [X] T051 [P] [US3] E2E: asignar → bandeja del auxiliar → gestión → Venta, en `tests/e2e/followup.spec.ts`

### Implementation for User Story 3

- [X] T052 [US3] Migración de `followups` y `assignment_events` (solo inserción), trigger de `next_contact_at`, política SELECT por `assigned_to`, y RPC `change_stage`, `add_followup`, `assign_prospect` y `assign_prospects_bulk`, en `supabase/migrations/20261028000900_followup.sql`
- [X] T053 [P] [US3] Hooks de bandeja, gestiones, cambio de etapa y asignación en `src/features/followup/api.ts`
- [X] T054 [US3] Bandeja `/seguimiento` (hoy, vencidos, próximos) en `src/features/followup/Inbox.tsx`
- [X] T055 [US3] (ficha con historial y venta desde el registro de contacto, 2026-10-29) Ficha `/seguimiento/$id`: datos de solo lectura, historial, formulario de gestión y cambio de etapa (motivo obligatorio en Sin interés) en `src/features/followup/FollowupDetail.tsx`
- [X] T056 [US3] Asignar y reasignar desde la ficha de gestión, y la página `/gestion/sin-asignar` con asignación masiva, en `src/features/prospects/AssignControl.tsx` y `src/features/prospects/Unassigned.tsx`

**Checkpoint**: El embudo completo funciona

---

## Phase 6: User Story 7 - Usuarios y accesos (Priority: P2)

**Goal**: El admin da de alta, edita, desactiva y reactiva usuarios, resetea contraseñas y mantiene los catálogos

**Independent Test**: Crear un volantero, registrar, desactivar con pendientes offline → se suben las anteriores a la baja y queda sin acceso (quickstart escenario 13)

### Tests for User Story 7 ⚠️

- [ ] T057 [P] [US7] (cubierto en parte por `tests/e2e/users-admin.spec.ts`: crear, entrar, dar de baja) Prueba de la Edge Function `admin-users` (rechaza a quien no es admin; create, deactivate, reactivate, reset_password) en `supabase/functions/admin-users/index.test.ts`
- [ ] T058 [P] [US7] E2E: baja con pendientes offline → se suben las anteriores a la baja → pantalla "Usuario desactivado", en `tests/e2e/deactivate.spec.ts`

### Implementation for User Story 7

- [X] T059 [US7] Completar `admin-users` con `update`, `deactivate`, `reactivate` y `reset_password`, más el trigger de auditoría en `profiles`, en `supabase/functions/admin-users/index.ts` y `supabase/migrations/20261028001000_users_audit.sql`
- [X] T060 [US7] Pantalla `/admin/usuarios` (listado, alta, edición, baja y reactivación, reseteo de contraseña) en `src/features/admin/UsersPage.tsx`
- [ ] T061 [P] [US7] Pantalla `/admin/catalogos` (canales, productos con línea, motivos, estrategias, corte de turno; solo desactivar, no borrar) en `src/features/admin/CatalogsPage.tsx`

---

## Phase 7: User Story 4 - Agenda diaria de actividades (Priority: P2)

**Goal**: Agenda por sucursal, fecha y turno; copiar a otra fecha; cerrar con resultado y cumplimiento

**Independent Test**: Crear 6 actividades, copiarlas al día siguiente y cerrar 2 (quickstart escenario 10)

### Tests for User Story 4 ⚠️

- [X] T062 [P] [US4] pgTAP (versión simple: arman encargado, gerente y Sistemas; el resto del personal de la sucursal solo ve): `copy_agenda` crea las actividades en pendiente y sin resultado, check de meta, en `supabase/tests/agenda_test.sql`

### Implementation for User Story 4

- [X] T063 [US4] Migración de `agenda_activities` y RPCs `agenda_day`, `save_activity`, `set_activity_result`, `delete_activity`, `copy_agenda` en `supabase/migrations/20261029000600_agenda.sql` (+ `000700` limpia estrategias duplicadas)
- [X] T064 [P] [US4] Hooks de agenda en `src/features/agenda/api.ts`
- [X] T065 [US4] Pantalla `/planificacion` (versión simple): día con ‹ ›, turnos Mañana/Tarde, actividad con hora, estrategia, personal a cargo (texto), meta (texto) y lugares; copiar del día anterior / al siguiente; cerrar como Cumplida/No cumplida con lo logrado, en `src/features/agenda/PlanningPage.tsx` + `ActivityDialog.tsx`. E2E: `tests/e2e/planning.spec.ts`. Sin % de cumplimiento (meta en texto)

---

## Phase 8: User Story 6 - Reporte en Excel (Priority: P2)

**Goal**: Exportar el .xlsx con la estructura de `Unificado.xlsx` según contracts/excel-export.md

**Independent Test**: Exportar una semana de una sucursal; las hojas y columnas coinciden con el contrato y los totales con la app (quickstart escenario 12)

> Requiere US2 (vistas). Las hojas INFORMES, AGENDA y GERENCIA se llenan cuando están US3, US4 y US5; si falta alguna, la hoja sale vacía con sus encabezados.

### Tests for User Story 6 ⚠️

- [ ] T066 [P] [US6] Prueba unitaria del armado del libro con datos fijos (hojas, columnas, tipos de celda, totales del encabezado, exclusión de anuladas, hoja DUPLICADOS) en `tests/unit/export.test.ts`

### Implementation for User Story 6

- [ ] T067 [US6] Vista `v_followups` y RPC/consultas paginadas para la exportación en `supabase/migrations/20261028001200_export_views.sql`
- [ ] T068 [US6] Constructor del libro con ExcelJS (import lazy): hojas CLIENTES, DUPLICADOS, INFORMES, AGENDA y GERENCIA en `src/features/export/buildWorkbook.ts`
- [ ] T069 [US6] Pantalla `/exportar` (rango de fechas obligatorio, sucursales según el rol, progreso, descarga con el nombre del contrato) en `src/features/export/ExportPage.tsx`

---

## Phase 9: User Story 5 - Metas mensuales (Priority: P3)

**Goal**: Metas por sucursal × línea × mes; avance = ventas (1 unidad por prospecto en Venta) ÷ meta; objetivo diario

**Independent Test**: Meta 10 + 3 ventas de CELULARES → avance 30% y objetivo diario = 7 ÷ días restantes (quickstart escenario 11)

### Tests for User Story 5 ⚠️

- [ ] T070 [P] [US5] pgTAP de `v_goal_progress` (conteo desde `stage_events` con `to_stage='sale'`, por línea del producto y mes del evento en La Paz, excluye anuladas, días restantes) y permisos de `monthly_goals` (solo gerente y admin editan) en `supabase/tests/goals_test.sql`

### Implementation for User Story 5

- [ ] T071 [US5] Migración de `monthly_goals` con RLS y auditoría, y la vista `v_goal_progress`, en `supabase/migrations/20261028001300_goals.sql`
- [ ] T072 [US5] Pantalla `/metas` (tabla sucursal × línea del mes, edición para gerente y admin, avance y objetivo diario) en `src/features/goals/GoalsPage.tsx`
- [ ] T073 [US5] Llenar la hoja GERENCIA y el total nacional desde `v_goal_progress` en `src/features/export/buildWorkbook.ts`

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T074 [P] Prueba pgTAP de la matriz completa rol × acción de data-model.md (una aserción por celda) en `supabase/tests/rls_matrix_test.sql`
- [ ] T075 [P] Lighthouse CI en `/registrar` con perfil de celular y 3G lento (≤3 s interactivo) y size-limit en CI, en `.github/workflows/ci.yml` y `lighthouserc.json`
- [ ] T076 [P] Revisar que ningún teléfono ni nombre se registre en logs ni aparezca en URLs (verificar que `q` no entre en search params, historial ni analytics) en `src/lib/` y `src/features/prospects/`
- [ ] T077 [P] Accesibilidad y textos: labels, foco, contraste y revisión de todos los mensajes en español (Bolivia) en `src/ui/` y `src/lib/errors.ts`
- [ ] T078 Configurar el proyecto Vercel (build estático, rewrites SPA, variables por entorno, previews) en `vercel.json` — **el deploy a producción requiere autorización del usuario**
- [ ] T079 Documentar el runbook: crear el proyecto Supabase (`sa-east-1`, plan Pro), aplicar migraciones, crear el primer admin y cargar los catálogos definitivos, en `docs/runbook.md` — **aplicarlo en producción requiere autorización del usuario**
- [ ] T080 Correr todos los escenarios de quickstart.md y anotar los resultados en `specs/001-captacion-mvp/checklists/validation.md`
- [ ] T081 Piloto en una sucursal con celulares reales (SC-009, señal real): plan y resultado en `docs/piloto.md`
- [ ] T082 [P] Prueba de carga (SC-006): 90 usuarios virtuales llamando `submit_capture` durante 10 min contra un proyecto de **staging** (nunca producción); p95 ≤ 2 s, en `tests/load/submit_capture.k6.js`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (F1)**: sin dependencias
- **Foundational (F2)**: depende de F1; **bloquea todas las historias**
- **US1 (F3)**: depende de F2
- **US2 (F4)**: depende de F2 y de la migración de `prospects` (T031) de US1
- **US3 (F5)**: depende de US2 (políticas de gestión y vista)
- **US7 (F6)**: depende de F2 (T026); se puede hacer en paralelo con US2 y US3
- **US4 (F7)**: depende solo de F2; se puede hacer en paralelo con US1, US2 y US3
- **US6 (F8)**: depende de US2; las hojas se completan a medida que llegan US3, US4 y US5
- **US5 (F9)**: depende de US3 (ventas por `change_stage`); T073 depende de T068
- **Polish (F10)**: al final; T080, T081 y T082 cuando está todo (T082 necesita un proyecto Supabase de staging)

### Within Each User Story

- Pruebas primero (deben fallar) → migración → RPC → hooks → pantallas
- Las migraciones van en orden de número; no se edita una migración ya aplicada en un entorno compartido

### Parallel Opportunities

- F1: T002–T006 y T008 en paralelo
- F2: T015–T022 en paralelo después de T009–T014
- US1: T027–T030 en paralelo; T033, T035 y T036 en paralelo después de T032
- Entre historias: US4 y US7 en paralelo con US1/US2 (archivos distintos)

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 juntas:
Task: "pgTAP submit_capture en supabase/tests/submit_capture_test.sql"
Task: "pgTAP permisos de captura en supabase/tests/rls_capture_test.sql"
Task: "Unit outbox en tests/unit/outbox.test.ts"
Task: "E2E offline en tests/e2e/capture-offline.spec.ts"

# Después de las RPC (T032):
Task: "Dexie db en src/features/sync/db.ts"
Task: "SyncBadge en src/features/sync/"
Task: "useCatalogs en src/features/capture/useCatalogs.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. F1 Setup → F2 Foundational
2. F3 US1 → validar con los escenarios 1–6 del quickstart
3. **Piloto de solo registro** en una sucursal (las captaciones se revisan con un export mínimo o desde Supabase) → ajustar el formulario con el Excel actual

### Incremental Delivery

1. US1 → piloto de registro
2. US2 → los encargados ven y corrigen
3. US3 + US7 → seguimiento real y alta y baja de temporales sin tocar la base
4. US4 + US6 → agenda y reporte Excel (reemplaza la planilla)
5. US5 → metas y hoja GERENCIA
6. Despliegue a las 10 sucursales después del piloto (T081)

---

## Notes

- [P] = archivos distintos y sin dependencias pendientes
- Commit por tarea o grupo lógico; **git lo ejecuta el usuario** (CLAUDE.md)
- Nada se aplica en el Supabase ni en el Vercel de producción sin autorización explícita
- Si una tarea cambia el diseño, se actualizan spec, plan y contracts en el mismo cambio (constitución, principio V)
