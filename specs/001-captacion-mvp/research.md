# Research: MVP de captación (001)

Fase 0 del plan. Cada punto: **Decisión / Por qué / Alternativas descartadas**.

## R1. Framework y build
- **Decisión**: Vite + React 18.3 + TypeScript strict. SPA sin SSR.
- **Por qué**: lo pide la constitución; el equipo ya usa React; el build es estático, así que el hosting es barato y no hay servidor que mantener.
- **Alternativas**: Next.js (sobra el SSR y complica el offline), SvelteKit (stack nuevo para el equipo), React 19 (fuera de la constitución v1.0.2; se puede subir más adelante con una enmienda).

## R2. Routing
- **Decisión**: TanStack Router con rutas lazy (code splitting por ruta).
- **Por qué**: los filtros del módulo de gestión viven en la URL con tipos (search params tipados); el modo registro carga solo su ruta.
- **Alternativas**: React Router 7 (más peso y search params sin tipos), wouter (muy liviano, pero sin carga de datos ni search params tipados).

## R3. UI y estilos
- **Decisión**: Tailwind CSS 4 + componentes propios. En el registro de campo, `<select>` y `<dialog>` **nativos** (cero JS y selector del sistema en Android). Radix solo si gestión lo necesita (lazy). TanStack Table solo en el módulo de gestión (lazy).
- **Ajuste en implementación (2026-10-28)**: con Radix, supabase-js completo y React Query en el bundle inicial, el JS inicial medía 204 KB gzip (> 170). Se pasó a controles nativos, React Query lazy y R6b; quedó en 139 KB.
- **Por qué**: el presupuesto de ≤170 KB gzip de JS inicial descarta MUI. Tailwind no suma JS en runtime.
- **Alternativas**: MUI (pesado), shadcn completo (arrastra más Radix del necesario; se copian solo los componentes que se usan).

## R4. Offline y sincronización (núcleo del MVP)
- **Decisión**: un **outbox** en IndexedDB (Dexie). Cada captación se guarda primero ahí con un `id` UUID v7 generado en el cliente.
  La cola se vacía desde la página (no desde el service worker) con estos disparadores: al abrir la app, evento `online`,
  `visibilitychange` a visible, después de cada Guardar y cada 30 s mientras haya pendientes. Cada envío es una llamada
  idempotente `submit_capture` (ver `contracts/rpc.md`). Cuando el servidor confirma (aceptado o duplicado), el registro se **borra** del outbox.
- **Por qué**: la sync es **solo de escritura** (el campo no lee datos), así que no hay conflictos. Que sea idempotente por `id` hace seguros los reintentos.
  Vaciar la cola desde la página evita manejar el token de sesión dentro del service worker. SC-003 pide la sync con la app abierta.
- **Alternativas**: Background Sync API en el service worker (no anda en todos los navegadores y obliga a pasar el token al SW; queda para la v2),
  PowerSync o ElectricSQL (motor de sync bidireccional: sobra para una sync de solo escritura y suma peso y costo).

## R5. PWA
- **Decisión**: `vite-plugin-pwa` (Workbox) en modo `generateSW`: precache del app shell, actualización con aviso ("hay una versión nueva, recargar")
  pero **nunca** mientras haya pendientes en el outbox.
- **Por qué**: hace que el modo registro abra sin red (SC-004) y es lo estándar.
- **Alternativas**: un SW escrito a mano (más mantenimiento).

## R6. Backend, región y hosting
- **Decisión**: un proyecto Supabase **nuevo** en la región `sa-east-1` (São Paulo, la más cercana a Bolivia). El frontend se publica en **Vercel** como sitio estático, con previews por rama.
- **Por qué**: Postgres, Auth y RLS administrados; las agregaciones de los reportes se hacen en SQL. La cuenta de Vercel ya está conectada.
- **Alternativas**: Cloudflare Pages (equivalente; se descarta por tener una herramienta menos que administrar), Firebase (reportes con agregaciones caros y RLS menos expresiva).

## R6b. Cliente Supabase liviano (implementación, 2026-10-28)
- **Decisión**: `@supabase/auth-js` + `@supabase/postgrest-js` en lugar de `@supabase/supabase-js` (que incluye realtime, storage y functions, no usados por el campo). `retry: false` en PostgREST.
- **Por qué**: unos 25 KB gzip menos en el bundle inicial. Con los reintentos automáticos de postgrest-js, sin red cada consulta tardaba ~7 s en fallar y la app tardaba 7,4 s en abrir (incumplía SC-004); sin ellos abre en ~110 ms. Los reintentos de captaciones los hace el outbox.
- **Alternativas**: supabase-js completo (más pesado y más lento sin red).

## R7. Autenticación y usuarios
- **Decisión**: Supabase Auth con **usuario + contraseña**. El usuario se escribe sin dominio y se mapea a un email sintético
  `<usuario>@captacion.riberbulma.local`. Las cuentas las crea el administrador desde una Edge Function `admin-users` (service role); no hay registro público.
- **Por qué**: el personal temporal no siempre tiene email; el alta tiene que ser rápida.
- **Alternativas**: login por SMS/OTP (cuesta por mensaje y la señal es mala), magic link (necesita email real).

## R8. Rol, sucursal y permisos
- **Decisión**: la identidad sale del JWT verificado (`auth.uid()`). Rol, sucursal y estado activo se leen de `profiles` con funciones
  `security definer stable` (`app_role()`, `app_branch()`, `app_is_active()`) que se usan en **todas** las políticas RLS.
  Los usuarios de campo **no tienen ningún permiso SELECT** sobre `prospects`: insertan solo con la RPC `submit_capture`.
- **Por qué**: si el rol se leyera de los claims del JWT, los cambios de rol o la baja no aplicarían hasta que el token expira (hasta 1 h). Leyéndolo de la tabla, la baja aplica de inmediato (FR-070).
- **Alternativas**: un hook de access token con claims de rol (más rápido, pero la baja no sería inmediata).

## R9. Baja de usuarios con pendientes offline
- **Decisión**: dar de baja = `profiles.active=false` y `deactivated_at=now()`. **No** se bloquea la cuenta de Auth (no hay ban).
  Toda RLS exige `app_is_active()`. `submit_capture` acepta a un usuario inactivo **solo** si `client_created_at <= deactivated_at`
  **y** `now() <= deactivated_at + 7 días`; esas captaciones quedan con `late_after_deactivation = true` para que las revise el encargado. Fuera de la ventana: `forbidden`.
  La app, al ver que el usuario está inactivo, muestra "usuario desactivado" y solo vacía su outbox; después cierra la sesión.
- **Por qué**: cumple el caso borde de la spec (se aceptan las pendientes de antes de la baja). Con un ban de Auth, esas pendientes no podrían subir nunca.
- **Riesgo**: el reloj del celular puede estar mal. Mitigación: si `client_created_at > received_at + 10 min`, se usa `received_at` (no se aceptan fechas futuras).
- **Riesgo**: un usuario dado de baja atrasa el reloj para subir captaciones nuevas. Mitigación: la ventana de 7 días y la marca `late_after_deactivation` para revisión (analyze S1).

## R10. Teléfono único y normalización
- **Decisión**: `phone_norm` = solo dígitos, sin el prefijo `591` y sin el `0` inicial. Es válido si son 8 dígitos que empiezan con 6 o 7 (celular),
  o 7–8 dígitos que empiezan con 2, 3 o 4 (fijo con código de área). Índice **único parcial** `on prospects(phone_norm) where status='active'`.
  Con señal: la RPC `phone_available(phone)` responde solo true/false antes de guardar. Sin señal: el índice único resuelve al sincronizar,
  y `submit_capture` guarda el registro como `status='duplicate_rejected'`.
- **Por qué**: bloqueo global (pedido del usuario) sin mostrar datos de la ficha existente.
- **Riesgo**: `phone_available` y `submit_capture` (respuesta `duplicate`) dejan saber si un número existe. Mitigación: solo para usuarios autenticados y activos, con límite por usuario (60 por minuto en `phone_available`, 120 por minuto en `submit_capture`; contador en `rate_limits`).

## R11. Etapas y auditoría
- **Decisión**: la etapa actual vive en `prospects.stage`. Cada cambio se hace solo con la RPC `change_stage` (que valida la transición e inserta en `stage_events` en la misma transacción).
  `stage_events`, `followups` y `assignment_events` son de solo inserción (sin políticas UPDATE ni DELETE, más un trigger que los rechaza).
  Las ediciones de `prospects` se auditan con un trigger que guarda en `audit_log` un jsonb con los valores anteriores y los nuevos.
- **Por qué**: cumple el principio III (eventos inmutables, reportes calculados de eventos) y FR-021 y FR-031.

## R12. Turno y zona horaria
- **Decisión**: el turno lo calcula el servidor a partir de `client_created_at` en `America/La_Paz`: antes de las 13:00 es mañana; desde las 13:00, tarde. El corte de las 13:00 se guarda en `settings` y lo edita el administrador.

## R13. Exportación Excel
- **Decisión**: se genera **en el navegador** con ExcelJS, que se carga con lazy import solo al exportar. Los datos se traen con vistas y RPC paginadas (1000 filas por página). Las hojas y columnas siguen `contracts/excel-export.md`.
- **Por qué**: ExcelJS ya se usa en riber-bulma; no hace falta un servidor. El volumen es chico: un mes de las 10 sucursales son unas decenas de miles de filas.
- **Alternativas**: SheetJS (el paquete de npm está desactualizado), una Edge Function que genere el archivo (límite de memoria y tiempo; queda para cuando el volumen lo pida).

## R14. Ventas y metas
- **Decisión**: la vista `v_goal_progress` cuenta los eventos `stage_events` con `to_stage='sale'` (constitución III: los reportes salen de los eventos), agrupados por sucursal, por línea del producto (`products.line`) y por mes del evento (en hora de La Paz), sin prospectos anulados, y los une con `monthly_goals`.
  Días restantes = días del mes posteriores a hoy, incluido hoy.

## R15. Pruebas
- **Decisión**: Vitest para la lógica pura (teléfono, UUID v7, outbox, turno, transiciones). **pgTAP** (`supabase test db`) para RLS y RPC, con una matriz rol × acción.
  Playwright con un celular emulado y `context.setOffline(true)` para el flujo offline de punta a punta. Lighthouse CI para el tamaño del bundle y el arranque en 3G.
- **Por qué**: lo más riesgoso son los permisos y la sync. pgTAP prueba la RLS donde de verdad se aplica.

## R16. Estado del servidor en el módulo de gestión
- **Decisión**: TanStack Query para listados, fichas y bandejas (caché e invalidación al mutar). El módulo de gestión requiere conexión; en v1 no trabaja offline.
- **Por qué**: la spec pide offline solo para el registro de campo; los usuarios de gestión trabajan mayormente en escritorio.
