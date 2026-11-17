# Handoff · 003 ingreso único en el mismo dominio

**Rama**: `feat/003-ingreso-mismo-dominio` (sale de `feat/002-cuenta-unica-portal`; fusionar esta y queda todo) ·
**Fecha**: 2026-11-17 · Spec: `barra-comun/specs/004-unificacion` (US2, FR-002, FR-003). Implementó Claude en modo loop.

## Por qué

La función `cuenta-unica` vive en `*.supabase.co`. Dentro del portal, su cookie de estado es de otro sitio y el
navegador no la guarda: el ingreso único fallaba con `estado`. Además Captación solo permitía marcos de sí misma.

## Qué cambia

| Archivo | Cambio |
|---|---|
| `vercel.json` | Reescritura `/api/cuenta-unica/:path*` → `https://bivyhhanipdgmxzrmrll.supabase.co/functions/v1/cuenta-unica/:path*` (antes de la de la SPA) y `frame-ancestors 'self' https://*.ribersoft.com` |
| `src/features/auth/sso.ts`, `LoginPage.tsx` | `ssoStartUrl`: con `VITE_CUENTA_UNICA_RUTA=/api/cuenta-unica` el botón usa la ruta del mismo dominio; sin ella, Supabase directo (local) |
| `vite.config.ts` | El service worker ya no responde `/api/*` con `index.html` (si no, el ingreso nunca llegaba a Vercel) |
| `.env.example` | `VITE_CUENTA_UNICA_RUTA` |

La función no cambia: su cookie toma el `Path` de `SSO_REDIRECCION`.

## Resultados

typecheck sin errores · lint sin errores · vitest 99/99 (2 nuevas). Los avisos de Prettier en `sso.ts` y `sso.test.ts`
existían antes de este cambio.

## Nota para Fer

- Vercel: `VITE_CUENTA_UNICA=true`, `VITE_CUENTA_UNICA_RUTA=/api/cuenta-unica`, `VITE_PORTAL_ORIGEN=https://<portal>`.
- Secreto de la función: `SSO_REDIRECCION=https://<captacion>/api/cuenta-unica/callback`; registrar esa misma
  dirección en el cliente `captacion` de la cuenta única.
- Portal: `VITE_CAPTACION_ENTRADA_UNICA=https://<captacion>/api/cuenta-unica/iniciar`.
- Si el dominio final **no** es `*.ribersoft.com`, cambiar `frame-ancestors` en `vercel.json` antes de publicar.
- Si se cambia el proyecto de Supabase, cambiar el `ref` de la reescritura.
- Verificar: abrir `https://<captacion>/api/cuenta-unica/iniciar` → debe redirigir a la cuenta única (no a la SPA).
