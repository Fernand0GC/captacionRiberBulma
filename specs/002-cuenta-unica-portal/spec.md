# Feature Specification: Captación dentro del portal (cuenta única + puente)

**Feature Branch**: `feat/002-cuenta-unica-portal`

**Created**: 2026-11-16

**Status**: Draft

**Input**: User description: "Que Captación funcione dentro del portal de la empresa: (1) ingresar con la cuenta única
(OIDC), (2) modo portal con el protocolo del puente (postMessage), (3) permitir que solo el portal la muestre en un
marco." Contratos fuente de verdad (repo `barra-comun`, feature `002-portal-cuenta-unica`):
`contracts/cuenta-unica.md` (v1), `contracts/puente.md` (`rb-puente/1`) y `src/contrato.ts` (tipo `Aviso`).

> Numeración: el código ya menciona un `specs/002-monitoreo-seguimiento` que nunca se creó en esta carpeta; esta
> feature usa `002-cuenta-unica-portal` porque así la pidió el PM. Si se crea la otra, conviene renumerar una.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ingresar con la cuenta única (Priority: P1)

Una persona del equipo con usuario de Captación **activo** y su CI registrado toca **"Ingresar con la cuenta única"**
en la pantalla de ingreso, escribe su CI y clave de la cuenta única (Keycloak) y vuelve a Captación con su sesión
abierta, en su pantalla de inicio de siempre (según su rol). El ingreso con usuario y clave sigue igual.

**Why this priority**: Sin una identidad común el portal no puede abrir Captación para la persona.

**Independent Test**: Con el CI `7788990-1B` cargado en un perfil activo, tocar el botón, entrar en Keycloak con
`7788990-1b` / `CuentaUnica2026` y terminar en la pantalla de inicio de ese perfil.

**Acceptance Scenarios**:

1. **Given** un perfil activo con CI `7788990-1B`, **When** la persona entra por la cuenta única con `7788990-1b`, **Then** queda con la misma sesión que tendría entrando con su usuario y clave.
2. **Given** que nadie tiene ese CI o el perfil está inactivo, **When** vuelve de la cuenta única, **Then** ve en la pantalla de ingreso "Tu cuenta única no tiene acceso a Captación…" (`?sso=sin-acceso`) y no se crea ningún usuario.
3. **Given** que el `state` no coincide o venció (más de 10 min), **When** vuelve, **Then** ve `?sso=estado` con un mensaje para reintentar.
4. **Given** que la app no tiene configurada la cuenta única, **Then** el botón no aparece y la función responde 404.

---

### User Story 2 - Modo portal (Priority: P1)

Dentro del portal, Captación oculta su propia marca, su tarjeta de usuario y su botón "Salir" (la barra del portal
los reemplaza), conserva su navegación interna, avisa al portal en qué pantalla está y cuántos contactos piden
atención, abre la pantalla que el portal le pida y cierra sesión cuando el portal lo ordena.

**Why this priority**: Es lo que hace que la persona no pierda lo que estaba haciendo al cambiar de sistema.

**Independent Test**: Abrir Captación en un iframe de `http://localhost:5185` que responda `bienvenida` a `listo`:
la marca y "Salir" desaparecen, el portal recibe `ruta` en cada cambio de pantalla y `avisos`; enviar `abrir` con
`/planificacion` navega; enviar `salir` cierra la sesión y el portal recibe `sesion-cerrada`.

**Acceptance Scenarios**:

1. **Given** Captación en un marco del portal, **When** carga, **Then** envía `listo` solo a `PORTAL_ORIGEN` y, si en 3 s no llega `bienvenida`, sigue igual que hoy.
2. **Given** modo portal, **When** la persona cambia de pantalla, **Then** el portal recibe `ruta` con la ruta interna (ruta + filtros no personales).
3. **Given** modo portal, **When** llega `abrir` con una ruta que empieza con `/` (y no con `//`), **Then** la app navega ahí; cualquier otra cosa se ignora.
4. **Given** modo portal y sin captaciones sin subir, **When** llega `salir`, **Then** se cierra la sesión local y se envía `sesion-cerrada`. Con captaciones sin subir se muestra el mismo aviso que el botón "Salir" (no se pierde nada sin confirmación).
5. **Given** un mensaje de otro origen o de otro protocolo, **Then** se ignora en silencio.
6. **Given** Captación abierta fuera del portal, **Then** no envía nada y se ve como hoy.

---

### User Story 3 - Permiso para mostrarse en el portal (Priority: P1)

Solo el propio sitio y el portal pueden mostrar Captación dentro de un marco.

**Independent Test**: Las respuestas HTML de producción (Vercel) y del servidor de desarrollo llevan
`Content-Security-Policy: frame-ancestors 'self' <PORTAL_ORIGEN>` y no llevan `X-Frame-Options`.

---

### User Story 4 - Sistemas registra el CI (Priority: P2)

Sistemas (admin) puede cargar o corregir el CI de un usuario al crearlo o editarlo. El CI es opcional y único.

**Acceptance Scenarios**:

1. **Given** el formulario de usuario, **When** Sistemas escribe `7788990-1b`, **Then** se guarda como `7788990-1B`.
2. **Given** un CI que ya tiene otro usuario, **Then** ve "Ese CI ya lo tiene otro usuario."
3. **Given** un CI con formato inválido, **Then** ve el formato esperado y no se guarda.

### Edge Cases

- La persona cancela en Keycloak (vuelve con `error=access_denied`) → `?sso=cuenta`.
- Keycloak no responde o el canje del código falla → `?sso=cuenta`.
- El `preferred_username` no es un CI válido → `?sso=ci`.
- El enlace de un solo uso ya se usó o venció (recarga de `/ingreso-unico`) → `?sso=sesion`.
- La persona tenía otra sesión abierta en ese navegador: queda la de la cuenta única (es la persona que se identificó).
- Sin señal: el botón de cuenta única muestra el mismo aviso que el ingreso con clave ("Necesitas conexión…").
- El service worker no intercepta las rutas de la función (otro origen o `/functions/v1/` en la lista de exclusión) y `/ingreso-unico` se sirve como cualquier ruta de la SPA.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `profiles.ci` opcional y único, guardado en mayúsculas con el formato `^[0-9]{4,12}(-[0-9A-Z]{1,4})?$`.
- **FR-002**: La Edge Function `admin-users` acepta `ci` en `create` y `update` (vacío = quitar), lo normaliza y valida; la pantalla de Usuarios lo muestra y lo edita.
- **FR-003**: Edge Function `cuenta-unica` con `GET …/iniciar` y `GET …/callback` según `contracts/cuenta-unica.md` (cookie de `state` `HttpOnly; SameSite=Lax; Max-Age=600`, comparación en tiempo constante, canje de servidor a servidor con `client_secret`, `preferred_username` del id_token validado).
- **FR-004**: La sesión que abre la cuenta única es la misma sesión de Supabase Auth del ingreso con clave (enlace mágico de un solo uso generado en el servidor y canjeado en la SPA con `verifyOtp`).
- **FR-005**: Fallas → `/login?sso=<estado|cuenta|ci|sin-acceso|sesion>` con mensaje en español neutral sin datos técnicos.
- **FR-006**: Botón "Ingresar con la cuenta única" solo si la app tiene la cuenta única configurada.
- **FR-007**: `frame-ancestors 'self' <PORTAL_ORIGEN>` en Vercel y en el servidor de desarrollo; sin `X-Frame-Options`.
- **FR-008**: Puente `rb-puente/1` del lado sistema (`sistema: 'captacion'`): saludo con espera de 3 s, `ruta`, `avisos` (máx. 1 cada 5 s, solo si cambian), `abrir`, `salir` → `sesion-cerrada`, `tema`.
- **FR-009**: En modo portal se ocultan marca, tarjeta de usuario con "Salir" y la tarjeta de instalar; se mantiene la navegación.
- **FR-010**: Los `avisos` no llevan datos personales de prospectos (nombres ni teléfonos): son conteos.
- **FR-011**: El JS inicial sigue ≤ 170 KB gzip; la lógica de avisos se carga aparte y solo en modo portal.

### Key Entities

- **Perfil** (`profiles`): agrega `ci text null unique`.
- **Aviso** (`contrato.ts`): `{ id, texto, sistema: 'captacion', fecha, url? }`.

## Success Criteria *(mandatory)*

- **SC-001**: La persona de prueba entra por la cuenta única y llega a su inicio en menos de 3 pasos (botón → clave → inicio).
- **SC-002**: Fuera del portal la app se comporta igual que antes (pruebas existentes en verde).
- **SC-003**: JS inicial ≤ 170 KB gzip.

## Assumptions

- La cuenta única es la de los contratos de `barra-comun`; en local, Keycloak `riberbulma`, cliente `captacion`.
- Las URLs de la función y de la app se configuran por variables de entorno (no se deducen de la petición).

## Clarifications

### Session 2026-11-16

Decisiones del PM con el modo loop; el usuario puede revertirlas.

- Q: ¿Dónde vive el flujo confidencial si la app es una SPA estática? → A: En una Edge Function `cuenta-unica`
  (verify_jwt desactivado: la llama un navegador sin sesión). El secreto del cliente nunca llega al navegador.
- Q: ¿Cómo se abre "la misma sesión"? → A: La función genera un enlace mágico de un solo uso
  (`auth.admin.generateLink`, tipo `magiclink`) y redirige a `{APP_URL}/ingreso-unico#token_hash=…`; la SPA lo canjea
  con `verifyOtp({ type: 'magiclink', token_hash })`. El token va en el fragmento (`#`): no llega a servidores ni logs.
- Q: ¿userinfo o id_token? → A: id_token de la respuesta del canje (servidor a servidor), con firma verificada contra
  el JWKS, `aud`/`azp` = cliente, `exp` vigente y `nonce` igual al guardado. Se agrega `nonce` (no lo pide el contrato;
  más seguro y gratis). `iss` se acepta si es `SSO_EMISOR` o `SSO_EMISOR_INTERNO`: Keycloak sin `KC_HOSTNAME` firma con
  el host por el que se le pidió el token (desde Docker, `host.docker.internal`). Con `KC_HOSTNAME` fijo solo hace falta
  `SSO_EMISOR`.
- Q: ¿Qué perfil se busca? → A: `profiles.ci = upper(preferred_username)` y `active = true`; no se crea nadie.
- Q: ¿Qué hace el botón de inicio? → A: navega a `{VITE_SUPABASE_URL}/functions/v1/cuenta-unica/iniciar`. El botón
  aparece si `VITE_CUENTA_UNICA=true`.
- Q: ¿Tema? → A: Captación tiene un solo aspecto (marco oscuro con contenido claro, sin modo claro/oscuro): `tema`
  y el tema de `bienvenida` se ignoran (documentado). Se agregará si la app tiene modo oscuro algún día.
- Q: ¿Qué es "ocultar el encabezado" si en el celular la barra superior es el acceso al menú (☰)? → A: En escritorio
  se oculta la marca y la tarjeta de usuario de la barra lateral (las secciones quedan). En el celular la barra superior
  queda solo con el nombre de la sección y ☰, sin logo; el menú lateral pierde marca, "Instalar" y "Salir".
- Q: ¿De dónde salen los avisos? → A: De `my_contacts` (Mis contactos), con la misma regla del contador del menú
  (`dueStatus`): hasta 3 avisos de conteo — atrasados, para hoy y visitas de mañana por confirmar — con
  `url: '/seguimiento'`. Sin nombres ni teléfonos (constitución IV). Solo para roles con Mis contactos; para los demás,
  lista vacía. Se recalculan cada 60 s y al volver a la pestaña; se envían solo si cambian.
- Q: ¿`salir` con captaciones sin subir? → A: Mismo efecto que el botón "Salir": si hay pendientes aparece el aviso
  "Tienes N captaciones sin subir" y no se cierra hasta que la persona decida. `sesion-cerrada` se envía cada vez que la
  sesión pasa a cerrada estando en modo portal (por `salir`, por el botón o porque venció).
- Q: ¿`ruta` incluye filtros? → A: Sí, ruta + `?filtros`: los filtros de la URL ya son no personales por diseño
  (`prospects/search.ts`). Nunca el fragmento.
- Q: ¿Qué CI de prueba local? → A: `7788990-1B` en `aux.verdolago` (Auxiliar Verdolago, activo, tiene Mis contactos y
  Registrar, así se prueban avisos y captura). Reversible con `update profiles set ci = null where username = 'aux.verdolago'`.
- Q: ¿Cookie de `state` en producción dentro del portal? → A: Se respeta el contrato (`SameSite=Lax`, más `Secure` si la
  callback es https, `Path` de la función). Riesgo documentado para Fer: si el portal y la función están en sitios
  distintos, el navegador no guarda cookies Lax dentro del iframe; ver handoff.
