# Riber Captación Constitution

App web responsive (PWA) de captación de clientes para el equipo de ventas de Riber Bulma.
Usuarios principales: volanteros en campo, supervisores de ventas y gerencia.

## Core Principles

### I. Campo primero (offline-first)
El volantero registra prospectos y seguimientos sin señal. Toda escritura de campo se guarda
primero en el dispositivo (IndexedDB) y se sincroniza en segundo plano cuando hay red.
- Ninguna pantalla de campo bloquea esperando al servidor.
- Cada registro lleva un id generado en el cliente (UUID v7), así reintentar no duplica (idempotente).
- Los conflictos se resuelven de forma explícita y documentada (por defecto: gana el último que escribió, por campo y con `updated_at`; el historial de etapas nunca se pisa, solo se agrega).

### II. Rápido en gama baja
Objetivo: celulares Android de gama baja con 3G.
- JS inicial ≤ 170 KB gzip; las rutas pesadas (reportes, gráficos, mapas) se cargan con lazy loading.
- Carga en frío ≤ 3 s en 3G simulado; interacciones de campo ≤ 100 ms (lectura local).
- Ninguna dependencia entra sin justificar su peso en el plan.

### III. El embudo es la fuente de verdad
El ciclo del prospecto (captación → seguimiento → cliente interesado → venta / sin interés; recaptación entra en la v2; la planificación es la agenda de actividades, no una etapa)
se modela como una máquina de estados con transiciones permitidas definidas en la spec.
- Cada cambio de etapa queda como evento inmutable (quién, cuándo, desde dónde, motivo).
- Los reportes se calculan de los eventos; no hay contadores sueltos editables a mano.

### IV. Seguridad en la base de datos
Supabase con Row Level Security en todas las tablas; el frontend nunca es la barrera de permisos.
- La identidad sale del JWT verificado; rol, sucursal y estado activo se leen en el servidor a partir de esa
  identidad en cada operación (una baja aplica de inmediato).
- Roles: volantero, auxiliar, supervisor, encargado, gerente, administrador.
- El personal de campo (volantero, auxiliar, supervisor) solo crea captaciones: no las ve, no las edita ni las elimina.
- El responsable de seguimiento ve solo los prospectos que tiene asignados; el encargado, los de su sucursal;
  gerencia y administración, todos. Solo el administrador anula.
- Datos personales de prospectos (teléfono, CI, dirección) solo en tablas con RLS; nunca en URLs ni en logs.

### V. Simple y spec-driven
Cada feature pasa por spec → plan → tasks antes de escribir código (Spec Kit).
- YAGNI: nada que la spec no pida. La complejidad se justifica en el plan.
- Si el código cambia, la spec y los contratos se actualizan en el mismo cambio.
- No se declara éxito en campo a partir de pruebas locales.

## Stack y restricciones

- Frontend: Vite + React 18 + TypeScript (strict), PWA con `vite-plugin-pwa` (Workbox).
- Datos locales: IndexedDB (Dexie) como cola de sync y caché; TanStack Query para el estado del servidor.
- Backend: proyecto Supabase **nuevo y separado** de riber-bulma (Postgres, Auth, RLS, RPC/vistas para reportes).
- Migraciones SQL versionadas en `supabase/migrations/`; nunca se cambia el esquema a mano en producción.
- Hosting estático (Vercel o Cloudflare Pages) con previews por rama.
- Nombres en código y BD en inglés; la UI en español (Bolivia).
- Sin conexión a las bases de riber-bulma (Firebase/Supabase) salvo integración definida en una spec y autorizada.

## Flujo de desarrollo

- Features numeradas en `specs/NNN-nombre/` (spec.md, plan.md, tasks.md, contracts/).
- Pruebas: Vitest para la lógica (máquina de estados, sync, cálculos de reportes), Playwright para el flujo de campo offline/online.
- Git: el usuario hace commit, push y merge; el agente solo propone los comandos.
- Cada PR revisa que cumpla esta constitución.

## Governance

Esta constitución manda por encima de otras prácticas. Para cambiarla hace falta aprobación del usuario,
subir la versión (semver) y anotar el motivo. `CLAUDE.md` tiene la guía operativa del día a día.

**Version**: 1.1.0 | **Ratified**: 2026-10-27 | **Last Amended**: 2026-10-27 (principio IV alineado a la spec 001: permisos por rol y rol leído del servidor; v1.0.2: recaptación pasa a la v2)
