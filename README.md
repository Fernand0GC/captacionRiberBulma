# Riber Captación

PWA de captación y seguimiento de prospectos para el equipo de ventas (volanteros, supervisores, encargados, gerencia).

Stack: Vite + React 18 + TypeScript · PWA offline-first (Workbox + IndexedDB/Dexie) · Supabase (Postgres + Auth + RLS).
Diseño y alcance: `specs/001-captacion-mvp/` (spec, plan, data-model, contracts, tasks).

## Requisitos
- Node 24 y pnpm
- Docker Desktop corriendo (Supabase local)

## Arranque local
```bash
pnpm install
pnpm db:start          # Supabase local: aplica supabase/migrations y supabase/seed.sql
cp .env.example .env.local   # completar con API_URL y ANON_KEY de `pnpm exec supabase status`
pnpm dev               # http://localhost:5173
```
Usuarios de prueba (solo local): ver `supabase/seed.sql`.

> Si `supabase start` falla con `docker-credential-desktop: executable file not found`, agregá
> `/Applications/Docker.app/Contents/Resources/bin` al `PATH` de la terminal.

## Verificaciones
```bash
pnpm typecheck && pnpm lint
pnpm test        # Vitest: teléfono, UUID v7, turno, outbox
pnpm db:test     # pgTAP: funciones, permisos (RLS), submit_capture
pnpm e2e         # Playwright sobre el build de producción: registro con y sin señal
pnpm build && pnpm size   # JS inicial ≤ 170 KB gzip (constitución II)
```
