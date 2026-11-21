# Feature Specification: Seguimiento a referidores (pedir referidos y medir esos pedidos)

**Feature Branch**: `017-referidores-seguimiento`

**Created**: 2026-11-21

**Status**: Implementada en local (2026-11-21); pendiente de publicar

**Input**: Pedido del usuario (2026-11-21): «lo que falta en referidos: hacer un seguimiento a los referidores (freelancers o
compañeros de trabajo); se les llama o se les manda mensaje por WhatsApp; la supervisora nacional de ventas debe saber
cuántas veces les insistió». Maqueta aprobada tras tres vueltas (simplificada: un solo lugar):
https://claude.ai/artifact/Vot6EQUX9TpkFdKf4Z3Ctx — y «¿dónde meto a un nuevo que me va a referir?» → padrón con
celular y «Ya le pedí referidos hoy». «ok impleméntalo todo en loop con SDD».

## Contexto

Referidos (specs 005, 010, 014, 016) mide lo que **llega**: llegados, contactados, compras, metas. No registra el trabajo
de **pedir**: cuántas veces Jessica (jefe de ventas, `sales_lead` con varias sucursales) llamó o escribió a cada
referidor, qué respondió y cuándo volver a insistir. Los referidores tampoco tienen celular.

## Clarifications

### Session 2026-11-21

Decididas por recomendación (**por confirmar con ventas**, regla de trabajo en loop):

- Q: ¿Dónde vive? → A: **Una sola pestaña nueva «Seguimiento»** en `/referidos`, para pedir y medir. «Referidores y
  metas» sigue siendo el padrón (solo suma Celular) y «Reporte» no cambia. Nada se repite en dos pestañas.
- Q: ¿Qué se registra? → A: Un **pedido** por vez que alguien le pide referidos: medio (Llamada de WhatsApp, Mensaje,
  En persona — sin llamada telefónica, igual que con clientes), resultado (No contestó, Enviado sin respuesta,
  Prometió pasar, Pasó contactos, No tiene ahora, No quiere seguir), nota opcional (≤ 500) y «volver a pedir el»
  (propuesta según el resultado: +1, +2, +2, +7, +7 días; «No quiere seguir» no lleva fecha). No se edita ni borra.
- Q: ¿Varios a la vez? → A: «Pedir a varios» guarda un pedido igual para cada referidor elegido (hasta 50).
- Q: ¿Cargar cuenta? → A: Al guardar en «Cargar» (016) con al menos un aceptado, el servidor anota solo un registro
  «Pasó contactos» marcado **automático**. **No cuenta como pedido** (es la respuesta) pero reinicia el plazo: se vuelve
  a pedir 7 días después de esa carga.
- Q: ¿Quién puede? → A: Quien ve Referidos de esa sucursal (`can_see_referrals`): jefe de ventas en sus sucursales,
  gerencia y Sistemas.
- Q: ¿Cuándo «toca pedir»? → A: Referidor activo, no unido y que no dijo «No quiere seguir», si: nunca se le pidió;
  o llegó su fecha de volver a pedir; o no tiene fecha y pasaron 7 días desde el último pedido (o desde la última
  carga, si cargó después).
- Q: ¿«Canal o app»? → A: No es una persona: no aparece en Seguimiento (ni en Para hoy ni en la cobertura).
- Q: ¿Para hoy muy largo? → A: Muestra los 8 más urgentes y «Ver los N» para el resto.
- Q: ¿Promesa cumplida? → A: Un «Prometió pasar» se cumple si en los 7 días siguientes hay un «Pasó contactos»
  (a mano o automático) o llega un referido suyo. Vencida: pasaron 7 días sin eso.
- Q: ¿Referidor nuevo? → A: Se da de alta en «Referidores y metas › Nuevo referidor» (con celular y casilla «Ya le
  pedí referidos hoy», que abre la ventana del pedido). Sin pedidos y con menos de 30 días: «Nuevo · hacer el primer
  pedido» en Para hoy. Los otros caminos (Registrar, Cargar) siguen creando referidores como hoy.
- Q: ¿Celular del referidor? → A: Opcional, celular boliviano válido. Repetido en otro referidor de la sucursal → se
  rechaza nombrando al otro. Solo lo ven quienes ven Referidos (tabla aparte sin lectura directa).
- Q: ¿En qué quedó con cada referidor, sin abrir su ventana? (ajuste pedido por el usuario 2026-11-21) → A: En la tabla
  «Ver por Referidor», la columna «Último pedido» pasa a **«En qué quedó»**: chip del resultado del último pedido (con
  «✓ cumplió» o «venció» si fue una promesa), medio · cuándo · quién, y la observación en una línea (completa al pasar
  el mouse y en el historial). Sin pedidos: «Nunca se le pidió». `referrer_followup` suma `note` en `last_ask`
  (migración `20261121001000_referrer_last_ask_note.sql`, aditiva). El Excel «Por referidor» suma «En qué quedó» y
  «Última observación».
- Q: ¿Estados por referidor? → A: Rinde (≥ 1 referido por pedido), Regular (< 1), Insistes y no llega (≥ 3 pedidos y 0
  referidos), Sin pedir (0 pedidos), No quiere seguir.

## User Scenarios & Testing

### US1 — Pedir referidos y registrarlo (P1)

Jessica abre Referidos › Seguimiento y ve **Para hoy**: a quién pedirle hoy, con el motivo (promesa vencida, nuevo,
nunca se le pidió, atrasado, toca hoy, días sin pedir). Toca **Pedir**: abre WhatsApp si quiere, marca cómo le pidió y
qué respondió, ajusta la fecha y guarda. El referidor sale de Para hoy hasta su nueva fecha.

**Aceptación**: (1) guardar crea el pedido con quién lo hizo; (2) «No quiere seguir» lo saca de Para hoy; (3) «Pedir a
varios» crea uno por referidor; (4) un referidor de una sucursal ajena se rechaza.

### US2 — Medir (P1)

En la misma pestaña, con los filtros de sucursal y período de siempre: 4 tarjetas (Pedidos hechos vs. período
anterior, Cobertura, Promesas cumplidas, Llegados por pedido) y una tabla con **Ver por** Referidor (estado), Sucursal
(si hay varias) o Quién pide (con Referidores nuevos y «No registra pedidos»). Excel con las tres vistas y el detalle.

### US3 — Padrón con celular y referidor nuevo (P2)

En Referidores y metas: columna Celular editable; «Nuevo referidor» con Celular y «Ya le pedí referidos hoy».

### US4 — Historial en la ventana del referidor (P2)

Tocar el nombre (Seguimiento o Reporte) abre la ventana de la 016 con su historial de pedidos y el botón Pedir.

## Requirements

- **FR-001** Tabla `referrer_asks` (pedido o automático) y `referrer_phones` (celular, sin lectura directa).
- **FR-002** `referrer_ask_save`: 1–50 referidores de sucursales visibles, valida medio, resultado, nota y fecha
  (hoy … +90 días; nula si «No quiere seguir»).
- **FR-003** `referrer_followup`: datos de la pestaña (referidores con celular, último pedido y última carga; pedidos y
  llegadas del período y del anterior del mismo largo; quién puede pedir) para una sucursal o todas las del alcance.
- **FR-004** `referrer_history`: pedidos de un referidor (últimos 100) con quién los hizo.
- **FR-005** `referrer_save` acepta `phone` (vacío lo borra; inválido → `invalid_input/phone`; repetido →
  `invalid_input/phone_taken` con el nombre en el mensaje).
- **FR-006** `referral_batch_save` anota el registro automático.
- **FR-007** Pestaña «Seguimiento» (`seccion=seguimiento`, `ver=sucursal|quien`): Para hoy, tarjetas, tabla, Excel.
- **FR-008** Ventana «Pedir referidos» (uno o varios), con el diseño de «Registrar contacto».
- **FR-009** Padrón: Celular y «Ya le pedí referidos hoy». Ventana del referidor: historial y Pedir.
- **FR-010** Todo aditivo: la app publicada sigue funcionando con la base nueva.

## Success Criteria

- **SC-001** Registrar un pedido toma menos de 10 segundos desde Para hoy.
- **SC-002** La supervisora ve en una pantalla cuántas veces se pidió a cada referidor y si rindió.
