# Handoff · 002-cuenta-unica-portal (Captación)

Rama `feat/002-cuenta-unica-portal` · worktree `/Users/daniel/Documents/RB-union/worktrees/captacion-cuenta-unica`.
Sin push ni merge. Base: `main` @ `bf39758`.

## Qué se construyó

| Pieza | Dónde | Qué hace |
|---|---|---|
| CI en perfiles | `supabase/migrations/20261116000100_profiles_ci.sql` | `profiles.ci` opcional, único, formato `^[0-9]{4,12}(-[0-9A-Z]{1,4})?$` (mayúsculas) |
| CI por Sistemas | `supabase/functions/admin-users/index.ts`, `src/features/admin/*` | campo "CI (cuenta única)" al crear/editar; `7788990-1b` se guarda `7788990-1B`; duplicado → "Ese CI ya lo tiene otro usuario." |
| Cuenta única | `supabase/functions/cuenta-unica/{index,oidc}.ts`, `_shared/ci.ts` | `GET …/iniciar` (cookie `cu_estado` HttpOnly/Lax/600 s + `state` y `nonce` de 32 bytes) → Keycloak → `GET …/callback` (state en tiempo constante, canje servidor a servidor, id_token validado con JWKS) → perfil **activo** por CI → enlace mágico de un solo uso → `{APP_URL}/ingreso-unico#token_hash=…` |
| SPA | `src/features/auth/{LoginPage,SsoLanding,sso}.tsx/ts`, `src/app/router.tsx` | botón "Ingresar con la cuenta única" (solo con `VITE_CUENTA_UNICA=true`), mensajes `?sso=estado|cuenta|ci|sin-acceso|sesion`, `/ingreso-unico` canjea con `verifyOtp` y borra el token de la barra |
| Marco | `vercel.json`, `vite.config.ts` | `Content-Security-Policy: frame-ancestors 'self' [PORTAL_ORIGEN]`, sin `X-Frame-Options` |
| Puente | `src/features/portal/{contract,bridge,PortalProvider,portalMode,notices}.ts(x)` | `listo` → `bienvenida` (3 s), `ruta`, `avisos` (≤ 1 cada 5 s, solo si cambian), `abrir`, `salir` → `sesion-cerrada`; `tema` se ignora |
| Salir reutilizable | `src/features/auth/logout.tsx` | el aviso de "captaciones sin subir" ahora es un contexto: lo usan el botón Salir y la orden `salir` |

## Resultados reales (2026-11-16)

| Verificación | Resultado |
|---|---|
| `pnpm typecheck` · `pnpm lint` | OK · OK (0 avisos) |
| `pnpm test` | **14 archivos, 97 pruebas OK** (antes: 10 / 69). Nuevas: `ci`, `sso` (firma RS256 real con WebCrypto, iss/aud/azp/exp/nonce, cookie, URLs), `portal-bridge` (12), `portal-notices` |
| `pnpm build && pnpm size` | **131.03 KB gzip** (main: 130.19 KB; +0.84 KB; límite 170 KB). `notices` en chunk aparte (0.47 KB) |
| Migración en la base local compartida | aplicada con `supabase migration up --db-url …56322…` (sin reset) |
| pgTAP `profiles_ci_test.sql` | 6/6 OK (corrido dentro de `begin … rollback`) |
| pgTAP suite completa | **No corrida**: ver Bloqueos (disco de Docker lleno) |
| Humo OIDC con `curl` contra Keycloak real (función en un edge-runtime aislado, puerto 56399) | `7788990-1b` → `302 /ingreso-unico#token_hash`; `verify` en GoTrue → `access_token` de `aux.verdolago`; segundo uso del enlace → `otp_expired`; `state` alterado → `?sso=estado`; perfil inactivo → `?sso=sin-acceso`; ruta desconocida → 404 |
| `admin-users` (edge-runtime aislado) | CI `12` → 400 `field: ci`; CI de otro → 409 `duplicate`; CI propio → 200 |
| Navegador (Playwright, servidor dev del worktree en :5191 + portal falso en :5196) | dentro del marco: botón de cuenta única visible, "Instalar" y "Salir" ocultos, secciones visibles; mensajes recibidos `listo, ruta:/login, avisos:[], ruta:/seguimiento, ruta:/planificacion (por abrir), sesion-cerrada (por salir), ruta:/login`; `abrir https://malo.test/` ignorado; todos desde el origen exacto; fuera del marco "Salir" visible y nada enviado |
| `/ingreso-unico` en navegador | con token real → `/seguimiento` como Auxiliar Verdolago; reusado → `/login?sso=sesion` "No se pudo abrir tu sesión. Vuelve a intentarlo." |
| Servidor dev | `curl -I` → `Content-Security-Policy: frame-ancestors 'self' http://localhost:5185` |
| `pnpm e2e` (Playwright del repo) | no corrido: la versión de Playwright pide un navegador que no está descargado (`npx playwright install`) |

`aux.verdolago` no tiene contactos asignados, por eso `avisos` llegó vacío; la regla de conteo está probada en
`tests/unit/portal-notices.test.ts` y en el navegador se vio la llamada `rpc/my_contacts` en modo portal.

## Cómo probar en local

1. **Datos**: el CI ya está puesto en la base local: `aux.verdolago` = `7788990-1B` (también en `seed.sql`).
   Revertir: `update public.profiles set ci = null where username = 'aux.verdolago';`
2. **Secretos de la función**: `cp supabase/functions/.env.example supabase/functions/.env` (valores locales listos).
3. **Servir la función**. El edge runtime del stack corriendo solo conoce `admin-users` (lista de funciones fijada al
   arrancar, montada del checkout principal). Después del merge, en el checkout principal, una de dos:
   - `pnpm exec supabase functions serve --env-file supabase/functions/.env` (reemplaza el contenedor de funciones del
     stack mientras corre), o
   - reiniciar el stack (`supabase stop` + `supabase start …`) — comprobar luego con
     `docker inspect supabase_edge_runtime_riber-captacion` que el entorno tenga `SSO_EMISOR`; si no, usar la opción 1.
4. **SPA**: en `.env.local` agregar `VITE_CUENTA_UNICA=true` y `VITE_PORTAL_ORIGEN=http://localhost:5185`; reiniciar
   `vite --port 5180`.
5. En `http://localhost:5180/login` → "Ingresar con la cuenta única" → `7788990-1b` / `CuentaUnica2026` → Mis contactos.
6. Portal: abrir Captación desde `http://localhost:5185` con la entrada
   `http://localhost:56321/functions/v1/cuenta-unica/iniciar`.

Probar sin el stack (como se hizo acá): edge-runtime aislado en la misma red Docker, ver comandos en la sección
"Prueba aislada" al final.

## Decisiones (modo loop; el usuario puede revertirlas — detalle en spec.md → Clarifications)

- Flujo confidencial en Edge Function `cuenta-unica` (`verify_jwt = false`); sesión = enlace mágico de un solo uso + `verifyOtp`, token en el fragmento.
- id_token (no userinfo), validado con JWKS; se agregó `nonce`. `iss` aceptado: `SSO_EMISOR` o `SSO_EMISOR_INTERNO`.
- Desde Docker (Colima) llegan a Keycloak **`host.docker.internal:8080` y `host.lima.internal:8080`** (ambos probados); se usa `host.docker.internal`.
- CI de prueba en `aux.verdolago` (tiene Mis contactos y Registrar).
- Avisos = conteos sin datos personales (atrasados / para hoy / visitas de mañana) desde `my_contacts`, `url: /seguimiento`, fecha = inicio del día en La Paz.
- `tema` ignorado: Captación no tiene modo claro/oscuro.
- Modo portal: escritorio sin marca ni tarjeta de usuario; celular con barra de sección + ☰ sin logo; menú sin marca, "Instalar" ni "Salir".
- `salir` = mismo flujo que el botón Salir (con captaciones sin subir pregunta antes; no se pierde nada).
- `ruta` = ruta + filtros (no personales por diseño); nunca `/ingreso-unico`.
- `vercel.json` queda con `frame-ancestors 'self'` (Vercel no interpola variables): Fer agrega el origen del portal.
- La constitución dice que el usuario hace los commits; se commiteó porque el usuario pidió implementar todo (rama propia, sin push).
- Numeración: el código ya menciona un `specs/002-monitoreo-seguimiento` inexistente; esta carpeta es `002-cuenta-unica-portal` por pedido del PM.

## Para el PM: Keycloak

**Nada obligatorio que cambiar** para el flujo de Captación en local: el cliente `captacion` (confidencial, secreto
`captacion-secreto-local`) aceptó `redirect_uri=http://localhost:56321/functions/v1/cuenta-unica/callback` (entra en
`http://localhost:56321/*`), el canje por `host.docker.internal` funciona y el id_token trae `preferred_username`.

Recomendado / a revisar:
1. **Emisor estable** (opcional): sin `KC_HOSTNAME`, Keycloak pone en `iss` el host por el que se le pidió el token
   (desde Docker, `http://host.docker.internal:8080/...`); la función lo acepta por `SSO_EMISOR_INTERNO`. Para que `iss`
   sea siempre el público: `KC_HOSTNAME=http://localhost:8080` y `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true` en el
   contenedor `rb-cuenta-unica`. No hace falta tocar nada en Captación si se cambia.
2. **Keycloak dentro del marco**: el portal abre Captación en un iframe con la entrada `…/cuenta-unica/iniciar`. Si la
   persona ya tiene sesión en la cuenta única, Keycloak redirige sin mostrar nada (funciona). Si no la tiene, Keycloak
   tendría que mostrar su formulario **dentro del iframe** y por defecto lo prohíbe (`X-Frame-Options: SAMEORIGIN`,
   `frame-ancestors 'self'` en *Realm settings → Security defenses*). O el portal garantiza sesión previa (lo esperado),
   o se ajustan esas cabeceras del reino para permitir `http://localhost:5185`.
3. Sin registro de *Web origins* (no hay llamadas CORS desde el navegador a Keycloak).

## Para Fer: despliegue

1. **Migración**: `supabase/migrations/20261116000100_profiles_ci.sql` (aditiva, sin datos) → `supabase db push`.
   Cargar los CI reales desde la pantalla Usuarios (Sistemas) o por SQL.
2. **Edge Function**: `supabase functions deploy cuenta-unica` (toma `verify_jwt = false` de `config.toml`; si no,
   `--no-verify-jwt`) y volver a desplegar `admin-users` (ahora acepta `ci`; usa `../_shared/ci.ts`).
3. **Secretos** (`supabase secrets set …`):
   `SSO_EMISOR=https://<emisor>/realms/<reino>` · `SSO_CLIENTE=captacion` · `SSO_SECRETO=<secreto real>` ·
   `SSO_REDIRECCION=https://<proyecto>.supabase.co/functions/v1/cuenta-unica/callback` · `APP_URL=https://<app captación>`
   · `SSO_EMISOR_INTERNO` solo si el servidor ve al emisor por otra dirección (en la nube normalmente no).
   Registrar ese `SSO_REDIRECCION` como redirect URI del cliente `captacion` en el proveedor.
4. **Vercel (variables de build)**: `VITE_CUENTA_UNICA=true`, `VITE_PORTAL_ORIGEN=https://<portal>`.
5. **`vercel.json`**: cambiar el valor a `frame-ancestors 'self' https://<portal>` (Vercel no lee variables en `headers`).
6. **Riesgo a decidir antes de producción**: la cookie de `state` es `SameSite=Lax` (contrato). Si el portal
   (`portal.…`) y la función (`*.supabase.co`) son sitios distintos, dentro del iframe el navegador no guarda/envía esa
   cookie y el ingreso desde el portal terminaría en `?sso=estado` (fuera del portal funciona igual). Opciones:
   servir la función bajo el mismo sitio que el portal (dominio propio para Supabase o un rewrite), o una versión del
   contrato que permita `SameSite=None; Secure; Partitioned`. Lo mismo aplica a la cookie de sesión de la cuenta única.
7. Supabase Auth no necesita URLs de redirección nuevas (el canje con `token_hash` no redirige) y no se envía ningún
   correo (`generateLink` solo genera el enlace).

## Bloqueos y avisos

- **Disco de Docker (Colima) lleno: 19.5 GB, ~23 MB libres.** Durante la sesión Postgres de Captación llegó a rechazar
  conexiones (`No space left on device`) después de que `supabase test db` descargara la imagen `pg_prove` (78 MB);
  la borré (era mía) y la base volvió a responder, pero queda al límite. `tukuy-web-db-1` está en bucle de reinicio
  (probablemente por lo mismo). Liberar espacio requiere la decisión del usuario; candidatas (versiones viejas sin
  uso): `edge-runtime:v1.77.8`, `postgres:17.11.0.006`, `studio:2026.10.19…`, `storage-api:v1.84.19`,
  `realtime:v2.147.1` (~6.5 GB). Hasta entonces no corrí la suite pgTAP completa.
- `pnpm db:test` **no es seguro desde el worktree tal cual**: su `config.toml` tiene los puertos 543xx (los 563xx del
  checkout principal son locales, `skip-worktree`) y apuntaría a la base de riber-bulma-app-migracion. Usar
  `supabase test db --db-url "postgresql://postgres:postgres@127.0.0.1:56322/postgres?sslmode=disable"`.
- **Merge**: `supabase/config.toml` y `vite.config.ts` cambian en esta rama y en el checkout principal están marcados
  `skip-worktree` con cambios locales (puertos): al traer la rama Git puede negarse a sobrescribirlos; hay que guardar
  los cambios locales, quitar el `skip-worktree`, fusionar y volver a aplicar los puertos.
- Los encargados pueden leer el CI del personal de su sucursal por la API (misma RLS de filas de `profiles`); se
  aceptó porque ya ven nombre y rol. Si se quiere ocultar, hace falta permiso por columna.

## Prueba aislada (lo que se usó, sin tocar el stack)

```bash
# edge-runtime propio en la red del stack, con las funciones del worktree; puerto 56399
docker run -d --rm --name cu-test-cuenta-unica --network supabase_network_riber-captacion -p 127.0.0.1:56399:8081 \
  -v $PWD/supabase/functions:/home/deno/functions:ro -v supabase_edge_runtime_riber-captacion:/root/.cache/deno:ro \
  -e SUPABASE_URL=http://kong:8000 -e SUPABASE_SERVICE_ROLE_KEY=<service role local> --env-file supabase/functions/.env \
  public.ecr.aws/supabase/edge-runtime:v1.78.1 start --main-service=/home/deno/functions/cuenta-unica --port=8081
# iniciar → login en Keycloak con curl (sin seguir el 302 a :56321) → callback contra :56399 con la cookie → verify en GoTrue
```
