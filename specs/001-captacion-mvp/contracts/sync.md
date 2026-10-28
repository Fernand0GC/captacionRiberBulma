# Contract: Outbox y sincronización del modo registro

## Almacenamiento local (IndexedDB, base `captacion`)

### Tabla `outbox`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string (UUID v7) | PK = id del prospecto (clave de idempotencia) |
| `userId` | string | dueño; **solo** se envía con la sesión de ese usuario |
| `payload` | objeto | entrada de `submit_capture` (ver rpc.md) |
| `createdAt` | ISO string | `client_created_at` |
| `attempts` | number | |
| `lastError` | string \| null | `code` del último error |
| `state` | `pending` \| `sending` \| `blocked` | `blocked` = error no reintentable (por ejemplo, `forbidden` después de la baja) |

### Canal de la jornada (localStorage, no IndexedDB)
`captacion.channel.<userId>.<YYYY-MM-DD La Paz>` → `channel_id`. Se pide antes del primer registro del día; cambia con un toque desde `/registrar`.

### Tabla `meta`
`todayCount` (por usuario y fecha; caché del contador para cuando no hay señal), `lastRejectionCheck`.

No se guarda ningún otro dato de clientes. Una fila del outbox se **borra** apenas el servidor responde `accepted` o `duplicate` (FR-015).

## Algoritmo de envío
1. Disparadores: inicio de la app, `online`, `visibilitychange` a visible, después de Guardar, y cada 30 s mientras haya filas `pending`.
2. Un solo envío a la vez (lock en memoria + `navigator.locks` si existe, para no duplicar entre pestañas).
3. Toma las filas `pending` del usuario actual en orden de `createdAt`, y las manda de a una con `submit_capture`.
4. Respuesta:
   - `accepted`: borrar la fila y sumar al contador.
   - `duplicate`: borrar la fila y mostrar el aviso "El teléfono 7123••67 ya estaba registrado".
   - Error de red, 5xx o `rate_limited`: `attempts++`, backoff exponencial (2 s, 4 s, 8 s… tope 60 s), sigue `pending`.
   - `invalid_input` o `invalid_phone`: `blocked` (no debería pasar, porque la UI valida antes) y se muestra al usuario para que lo vea el encargado.
   - `forbidden`: `blocked`.
   - Sesión vencida (401): refrescar el token y reintentar; si no se puede, dejar `pending` y pedir login cuando haya red.

## Reglas de sesión
- **Cerrar sesión** con filas `pending`: se bloquea con el aviso "Tienes N captaciones sin subir". Hay una opción explícita de descartarlas, con doble confirmación.
- **Cambio de usuario** en el mismo dispositivo: las filas de otro `userId` no se envían ni se cuentan; se mantienen hasta que ese usuario vuelva a entrar.
- **Usuario desactivado** (el perfil devuelve `active=false`): pantalla "Usuario desactivado". Se vacía su outbox (el servidor acepta lo anterior a la baja, hasta 7 días después de ella) y se cierra la sesión.

## Indicadores en pantalla
- Contador "Hoy registraste N": lo que dice el servidor (`my_capture_stats`) más las filas pendientes locales de hoy.
- Insignia "N por subir" mientras haya filas `pending`, y estado "sin conexión" o "sincronizando".
