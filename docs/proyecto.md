# Riber Captación: definición del proyecto (borrador)

> Estado: **borrador v2, 2026-10-27**. Ya pasó a la spec: `specs/001-captacion-mvp/spec.md` manda; este documento queda como contexto.
> Lo marcado con ❓ se completa con las notas de planificación y captación del equipo de ventas.

## 1. Problema

Los volanteros salen a campo a buscar datos de posibles clientes. Hoy la planificación, los datos que juntan
y el seguimiento se manejan ❓ (¿papel, WhatsApp, Excel?). Por eso no se sabe cuántos prospectos
se convierten en venta, quién rinde, ni dónde se pierde el prospecto.

## 2. Objetivo

Una mini app web responsive, instalable en el celular (PWA), que cubra el ciclo completo del prospecto
y le dé a supervisión y gerencia reportes del embudo, sin depender de la señal en campo.

## 3. Usuarios, roles y permisos (definido 2026-10-27)

Login obligatorio. Cada acción se controla por rol, y la RLS lo hace cumplir en la base, no solo la UI.

| Rol | Contrato | Modo registro (campo) | Módulo de gestión | Eliminar | Alcance |
|---|---|---|---|---|---|
| Volantero | Temporal | ✔ | — | — | Lo propio |
| Auxiliar | Contrato | ✔ | — | — | Lo propio |
| Supervisor | Contrato | ✔ | — | — | Lo propio |
| Encargado | Contrato | ✔ | ✔ | — | Su sucursal |
| Gerente | Contrato | — | ✔ | — | Todas las sucursales |
| Administrador (Sistemas) | Contrato | — | ✔ | ✔ | Todo + usuarios y catálogos |

- Volantero, auxiliar y supervisor tienen **los mismos permisos**; cambia el tipo de contrato. Los volanteros son temporales,
  así que el alta y baja (desactivar usuario) tiene que ser rápida, y lo que registraron se conserva.
- Encargado: uno por sucursal; usa los dos modos.
- Eliminar: solo el administrador. Se anula con un motivo (soft delete) y queda en el historial.

**A. Modo registro (campo)**
- Flujo único: **Registrar**, completa los datos, **Guardar** y vuelve a Registrar.
- Solo crea: no ve el listado, no edita ni elimina.
- Ve solo su **conteo** ("hoy registraste 12"), sin ver los datos.
- Sin señal: guarda en una cola local y se sube solo. El celular no conserva datos de clientes una vez subidos.

**B. Módulo de gestión (completo)**
- Registrar, ver, buscar y editar captaciones; seguimiento y cambio de etapa; agenda; metas; exportar Excel.
- Uso principal en escritorio, responsive.

Sucursales: 10 (RURRE, COBIJA, REYES, GUAYARAMERÍN, VERDOLAGO, SAN JOSÉ, TRINIDAD, SAN IGNACIO, SAN BORJA, SANTA CRUZ).
Equipo: 9 personas por sucursal (~90 usuarios, confirmado), 2 turnos por día (mañana y tarde).

> `Unificado.xlsx` es el **modelo nuevo** que se va a usar. El Excel actual de captaciones está pedido; cuando llegue, se compara.

## 4. Embudo (etapas)

La **planificación no es una etapa**: es la agenda diaria de actividades.

```
1 Captación ─▶ 2 Recaptación ─▶ 3 Seguimiento ─▶ 4 Cliente interesado ─▶ 5 Venta
      │               │                │                    │
      └───────────────┴────────────────┴────────────────────┴──▶ 6 Sin interés
```

| # | Etapa | Definición | ❓ Por confirmar |
|---|---|---|---|
| 1 | Captación | Se registran los datos del posible cliente (persona). | — |
| 2 | Recaptación | Sin definir; supuesto: volver a captar un prospecto ya registrado o frío. | **Qué es (nadie lo sabe todavía)** |
| 3 | Seguimiento | Contactos siguientes, con resultado y próximo contacto. | **Quién lo hace (por verse)** |
| 4 | Cliente interesado | Interés confirmado. | — |
| 5 | Venta | Compró. Solo se marca que compró; no se registran unidades, monto ni comprobante. | — |
| 6 | Sin interés | Cierre negativo con motivo. | Lista de motivos |

Los números 50 · 100 · 200 · 80 de la nota: sin explicación (nadie sabe qué son).

## 5. Alcance

### MVP (v1)
1. **Login, roles y permisos** por acción (RLS); alta y baja rápida de usuarios temporales.
2. **Modo registro de campo**: Registrar → Guardar → Registrar; solo crear; offline; conteo propio del día.
3. **Formulario de captación (solo personas)**: nombre, teléfono, producto de interés, canal, nivel de interés.
   Automáticos: sucursal, quién lo registró, fecha y hora, turno. **Sin GPS.**
4. **Teléfono duplicado: se bloquea** (ver la nota técnica abajo).
5. **Módulo de gestión**: listado, búsqueda, edición; seguimiento y cambio de etapa con historial; marcar venta.
6. **Agenda diaria (planificación)** por sucursal y turno: actividad, hora, responsables, meta, lugares, resultado.
7. **Metas mensuales** por sucursal × línea, cargadas en esta app.
8. **Reporte = exportar Excel** con la estructura de `Unificado.xlsx` (CLIENTES, INFORMES, AGENDA, GERENCIA…).
9. PWA instalable, sync en segundo plano, indicador de pendientes por subir.

### Fuera del MVP (v2+)
- Instituciones / convenios / venta grupal (B2B).
- Dashboards dentro de la app (en v1 el reporte es el Excel exportado).
- Integración con riber-bulma; GPS y mapa; notificaciones push; comisiones de volanteros.

### Nota técnica: duplicado bloqueado + offline
Sin señal no se puede consultar el servidor. Propuesta para el plan:
- Con señal: verificar el teléfono antes de guardar y bloquear en el momento.
- Sin señal: guardar en la cola; al sincronizar, el servidor rechaza el duplicado (índice único sobre el teléfono normalizado),
  la captación queda como **"duplicado rechazado"** para el encargado y el de campo ve un aviso "teléfono ya registrado".
- El bloqueo es **global, en las 10 sucursales** (confirmado 2026-10-27).

## 6. Requisitos no funcionales

- Funciona en Android de gama baja, Chrome; responsive hasta escritorio para supervisión.
- Las escrituras de campo funcionan 100% sin conexión; la sync es idempotente.
- Rendimiento: ver la constitución (≤170 KB de JS inicial, ≤3 s en 3G).
- Seguridad: RLS por rol y sucursal; datos personales protegidos.
- BD y despliegue separados de riber-bulma.

## 7. Stack decidido (2026-10-27)

| Capa | Elección | Por qué |
|---|---|---|
| UI | Vite + React 18 + TypeScript | SPA liviana, mismo conocimiento de React del equipo |
| PWA / offline | vite-plugin-pwa (Workbox) + Dexie (IndexedDB) | Se instala en el celular; cola de sync local |
| Estado servidor | TanStack Query | Caché, reintentos, funciona bien con lo offline |
| Routing | TanStack Router o React Router (se decide en el plan) | Rutas con lazy loading |
| UI kit | Se decide en el plan (candidatos: Tailwind + componentes propios / shadcn) | MUI pesa demasiado para el objetivo de bundle |
| Backend | Supabase (proyecto nuevo): Postgres, Auth, RLS, RPC | SQL para los reportes del embudo; ya lo conocen |
| Hosting | Vercel o Cloudflare Pages | Estático, previews por rama |
| Tests | Vitest + Playwright | Lógica + flujo offline end-to-end |

## 8. Preguntas abiertas

Respondidas el 2026-10-27; las decisiones están en las secciones 3–5. Quedan:

1. **Seguimiento**: ¿quién lo hace? Por verse. Supuesto para la spec: encargados (y gerente) desde el módulo de gestión.
2. **Recaptación**: ¿qué es? No se sabe. Supuesto: volver a contactar un prospecto ya registrado (frío o sin respuesta).
3. Números 50 / 100 / 200 / 80 de la nota: sin explicar.
4. Lista de motivos de "sin interés" y de canales/productos definitivos: se sacan del Excel actual (pedido).
5. Volumen: ¿cuántas captaciones por persona y por turno, más o menos?
