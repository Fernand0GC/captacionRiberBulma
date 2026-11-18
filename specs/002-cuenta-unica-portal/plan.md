# Implementation Plan: Captación dentro del portal (cuenta única + puente)

**Branch**: `feat/002-cuenta-unica-portal` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

## Summary

Tres piezas independientes: (1) **identidad** — columna `profiles.ci` + edición por Sistemas; (2) **cuenta única** —
Edge Function `cuenta-unica` (OIDC Authorization Code confidencial) que termina en un enlace mágico de un solo uso que la
SPA canjea en `/ingreso-unico`; (3) **portal** — cabecera `frame-ancestors` y el lado sistema del puente
`rb-puente/1` (modo portal, `ruta`, `avisos`, `abrir`, `salir`).

## Technical Context

- **Language**: TypeScript strict (SPA) · Deno (Edge Function) · SQL (Postgres 17)
- **Dependencias nuevas**: ninguna. La validación del id_token usa WebCrypto (RS256) y `fetch`; el puente es código
  propio (~2 KB) con los tipos copiados de `barra-comun/src/contrato.ts`.
- **Testing**: Vitest (puente, CI, avisos, utilidades de la función: módulo puro `supabase/functions/cuenta-unica/oidc.ts`
  sin APIs de Deno), pgTAP (`profiles.ci`), prueba de humo del flujo completo con `curl` contra Keycloak local.
- **Performance**: JS inicial ≤ 170 KB gzip. El puente entra al bundle inicial (pequeño); los avisos (que dependen de
  `followup/api` → React Query) se cargan con `import()` solo al entrar en modo portal.

## Constitution Check

| Principio | Cumple | Cómo |
|---|---|---|
| I. Offline-first | Sí | Nada nuevo bloquea `/registrar`; el puente no espera red; el botón de cuenta única pide conexión como el ingreso con clave. |
| II. Gama baja | Sí | Sin dependencias; avisos lazy; `pnpm size` en verde. |
| III. Embudo | N/A | No toca etapas. |
| IV. Seguridad en BD | Sí | El acceso lo decide `profiles` (activo + CI) en el servidor; el secreto OIDC y la service role solo en la función; avisos sin datos personales; token en el fragmento. |
| V. Spec-driven | Sí | Esta carpeta. |
| Git | **Excepción** | La constitución dice que el usuario hace los commits; en este loop el usuario pidió a Claude implementar todo con un commit por tarea en una rama/worktree propia, sin push ni merge. |

## Diseño

### Base de datos — `supabase/migrations/20261116000100_profiles_ci.sql`

```sql
alter table public.profiles add column ci text unique
  check (ci ~ '^[0-9]{4,12}(-[0-9A-Z]{1,4})?$');
```

Aditiva, sin datos. Escrituras solo por `admin-users` (service role); RLS existente sin cambios.

### Edge Function `cuenta-unica` (`verify_jwt = false`)

| Variable (secreto de la función) | Local | Uso |
|---|---|---|
| `SSO_EMISOR` | `http://localhost:8080/realms/riberbulma` | redirección del navegador; `iss` esperado |
| `SSO_EMISOR_INTERNO` | `http://host.docker.internal:8080/realms/riberbulma` | token + JWKS desde Docker (opcional; por defecto `SSO_EMISOR`) |
| `SSO_CLIENTE` / `SSO_SECRETO` | `captacion` / `captacion-secreto-local` | cliente confidencial |
| `SSO_REDIRECCION` | `http://localhost:56321/functions/v1/cuenta-unica/callback` | `redirect_uri` registrado |
| `APP_URL` | `http://localhost:5180` | a dónde vuelve el navegador |

Flujo: `iniciar` → cookie `cu_estado=<state>.<nonce>` → Keycloak. `callback` → compara `state` (tiempo constante) →
`POST token` con `client_secret_post` → valida id_token (`oidc.ts`) → `ciDesdeUsuario(preferred_username)` →
`profiles` activo por `ci` → email de `auth.users` → `generateLink(magiclink)` → `302 {APP_URL}/ingreso-unico#token_hash=…`.
Toda falla → `302 {APP_URL}/login?sso=<motivo>`. Sin `SSO_EMISOR` → 404.

### SPA

- `src/features/auth/ssoConfig.ts`: `SSO_ENABLED`, `SSO_START_URL`, `SSO_MESSAGES`, `ssoReason()`.
- `LoginPage`: botón + mensaje `?sso`. Ruta `/ingreso-unico` (`SsoLanding.tsx`): lee y borra el fragmento, `verifyOtp`.
- `LogoutProvider` (`features/auth/logout.tsx`): mueve el flujo de "Salir" (aviso de captaciones sin subir) a un
  contexto con `requestLogout()`, usado por el botón y por `salir` del puente.
- `src/features/portal/`: `contract.ts` (tipos copiados), `bridge.ts` (lógica pura, probada con un `window` falso),
  `PortalProvider.tsx` (conecta router/auth/avisos; `usePortalMode()`), `notices.ts` (lazy: `my_contacts` → `Aviso[]`).
- `AppShell`: con `usePortalMode()` oculta marca, tarjeta de usuario e instalar.

### Marco

- `vercel.json`: `{"source": "/(.*)", "headers": [{"key": "Content-Security-Policy", "value": "frame-ancestors 'self' https://<portal>"}]}`
  (placeholder que Fer reemplaza; Vercel no interpola variables en headers).
- `vite.config.ts`: `server.headers` / `preview.headers` con `frame-ancestors 'self' ${VITE_PORTAL_ORIGEN}` (lee `loadEnv`).

## Project Structure

```text
supabase/migrations/20261116000100_profiles_ci.sql
supabase/functions/cuenta-unica/{index.ts,oidc.ts,deno.json}
supabase/functions/admin-users/index.ts          # + ci
supabase/tests/profiles_ci_test.sql
src/features/auth/{ssoConfig.ts,SsoLanding.tsx,logout.tsx,LoginPage.tsx,LogoutButton.tsx}
src/features/portal/{contract.ts,bridge.ts,PortalProvider.tsx,notices.ts}
src/app/{router.tsx,AppShell.tsx,providers.tsx}
tests/unit/{portal-bridge,portal-notices,sso,ci}.test.ts
```

## Complexity Tracking

| Decisión | Por qué | Alternativa descartada |
|---|---|---|
| Enlace mágico + `verifyOtp` | Abre una sesión normal de Supabase Auth sin tocar GoTrue | Proveedor OIDC propio de GoTrue: es "Keycloak provider" con creación automática de usuarios, contradice el contrato (no crear nadie) |
| Validación del id_token propia (WebCrypto) | 60 líneas; sin dependencia `jose` en la función | `jose` por `npm:`: correcto, pero agrega descarga y versión que mantener |
