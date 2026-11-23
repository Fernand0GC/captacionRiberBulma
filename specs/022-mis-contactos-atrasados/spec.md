# Feature Specification: Mis contactos — atrasados, resumen del día y lista liviana

**Feature Branch**: `022-mis-contactos-atrasados`

**Created**: 2026-11-23

**Status**: Implemented (falta correr el e2e, tu prueba manual, commit y producción)

**Input**: User description: "En «Mis contactos» de la auxiliar: 1) my_contacts devuelve la fecha en que se le asignó cada cliente; 2) un cliente sin contactar asignado antes de hoy muestra «Atrasado · asignado hace N días» (no «Nuevo · contactar hoy»); 3) la columna «Captado» pasa a «Asignado» (fecha y quién lo asignó); 4) arriba, un resumen con 3 tarjetas que filtran: Para hoy, Atrasados, Contactados hoy; 5) la lista no dibuja cientos de filas de golpe (celulares de gama baja); 6) el contador de la pestaña no repite el número («290 ⚠290»). Con tests Vitest, pgTAP y Playwright, escritos primero (TDD: verlos fallar y después pasar)."

**Amplía**: «Mis contactos» (specs 001, 016 y 020). Sale del análisis de la spec 021 (`docs/plan-018-021.md`).

## Contexto

La auxiliar trabaja su día desde «Mis contactos». Hoy, un cliente que nunca contactó dice siempre «Nuevo · contactar
hoy», aunque se lo hayan asignado hace tres días: lo que se le acumuló de días anteriores se ve igual que lo que le
llegó esta mañana y nada le avisa que se está atrasando. La columna «Captado» muestra cuándo el volantero registró al
cliente, no cuándo se lo pasaron a ella, que es lo que importa para su trabajo. Con cientos de asignados (por ejemplo,
los 400 clientes de prueba «Vol 021»), la pantalla dibuja todas las filas de golpe y en un celular de gama baja se
traba; y la pestaña muestra «Captados 290 ⚠290», el mismo número dos veces.

## Clarifications

### Session 2026-11-23

- Q: ¿Qué va primero en «Mis contactos»: los atrasados o los asignados hoy? → A: Los asignados hoy primero (lo que acaba de llegar arriba; los atrasados debajo, del más reciente al más viejo).
- Q: Con cientos de contactos, ¿«Ver más» o agrupar por día de asignación? → A: Agrupar por día de asignación (secciones plegables «Hoy», «Ayer», «Sáb 21»…).
- Q: ¿Desde cuándo un cliente es «Atrasado · asignado hace N días»? → A: Asignado antes de hoy (día calendario de La Paz) y nunca contactado; lo agendado vencido sigue con su regla actual.
- Q: Si el encargado pasa a otra auxiliar los clientes que la primera no llamó, ¿cómo los ve la nueva? → A: Como «Nuevo · contactar hoy» (se los dieron hoy; no es su atraso), con la marca «Reasignado de <persona> · sin contactar desde el dd/mm», y van primero dentro de su día. Reasignar a la misma persona que ya lo tiene no cambia la fecha (no se registra una asignación nueva).
- Q: ¿«Ver más» o paginación? → A: Paginación (pedido del usuario al ver la pantalla): «Filas por página» 10 / 25 / 50 / 100, 25 de entrada, recordado en cada dispositivo; paginador con primera / anterior / números / siguiente / última en computadora y «‹ 2 de 4 ›» en celular.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver qué se me atrasó (Priority: P1)

La auxiliar abre «Mis contactos». Los clientes que le asignaron antes de hoy y que todavía no contactó dicen
«Atrasado · asignado hace N días» con el color de atrasado; los que le asignaron hoy siguen diciendo «Nuevo ·
contactar hoy». En la columna «Asignado» ve la fecha y hora en que se lo asignaron y quién.

**Why this priority**: Es el problema de fondo: sin esta distinción, el atraso es invisible para la auxiliar y para
el contador del menú.

**Independent Test**: Con un cliente asignado ayer y otro hoy, ambos sin contactar, el primero muestra «Atrasado ·
asignado hace 1 día» y el segundo «Nuevo · contactar hoy»; la columna «Asignado» muestra la fecha de cada asignación.

**Acceptance Scenarios**:

1. **Given** un cliente asignado a la auxiliar hace 3 días (hora de La Paz) y nunca contactado, **When** abre «Mis contactos», **Then** la fila dice «Atrasado · asignado hace 3 días» con el estilo de atrasado.
2. **Given** un cliente asignado ayer y nunca contactado, **When** abre la lista, **Then** dice «Atrasado · asignado hace 1 día».
3. **Given** un cliente asignado hoy (aunque sea a las 00:05 de La Paz) y nunca contactado, **When** abre la lista, **Then** dice «Nuevo · contactar hoy».
4. **Given** un cliente con un contacto agendado vencido, **When** abre la lista, **Then** conserva su etiqueta actual («Atrasado N días · tocaba el dd/mm» o «Visita era … · ¿vino?»); la regla nueva solo aplica a los nunca contactados.
5. **Given** la pestaña «Captados», **When** mira la tabla, **Then** la columna se llama «Asignado» y muestra la fecha y hora de la asignación y «por <quien se lo asignó>» (o «tomado por ti» si se lo asignó ella misma).
6. **Given** un cliente que se reasignó de otra persona a la auxiliar, **When** lo ve, **Then** la fecha es la de la asignación a ella, no la de la primera asignación ni la de la captación.
7. **Given** la vista de celular (tarjetas), **When** mira un cliente, **Then** también ve la fecha de asignación y quién se lo asignó.
8. **Given** un cliente asignado el lunes a la Aux A, que no lo llamó, y que el martes el encargado pasa a la Aux B, **When** la Aux B abre «Mis contactos» el martes, **Then** lo ve como «Nuevo · contactar hoy» en el grupo «Hoy», con la marca «Reasignado de Aux A · sin contactar desde el <lunes dd/mm>», y antes que los clientes nuevos de ese día.
9. **Given** el mismo caso, **When** la Aux A abre «Mis contactos», **Then** ya no lo ve (su falta queda en Actividad como «Reasignado a Aux B», spec 020).

---

### User Story 2 - Resumen del día con tarjetas que filtran (Priority: P2)

Arriba de la lista, tres tarjetas: «Para hoy», «Atrasados» y «Contactados hoy», cada una con su número. Al tocar una,
la lista muestra solo esos clientes; al tocarla otra vez (o «Ver todos») vuelve a la lista completa.

**Why this priority**: Le da a la auxiliar el panorama del día en un vistazo y un atajo para trabajar primero lo
atrasado, pero la US1 ya sirve sin ella.

**Independent Test**: Con 2 atrasados, 1 para hoy y 1 contactado hoy, las tarjetas muestran 1 / 2 / 1; tocar
«Atrasados» deja solo los 2 atrasados.

**Acceptance Scenarios**:

1. **Given** contactos en distintos estados, **When** abre «Mis contactos», **Then** ve tres tarjetas con los conteos de «Para hoy», «Atrasados» y «Contactados hoy» sobre todos sus contactos abiertos (ambas pestañas).
2. **Given** las tarjetas, **When** toca «Atrasados», **Then** la tarjeta queda marcada como activa, la lista y los contadores de las pestañas muestran solo los atrasados.
3. **Given** una tarjeta activa, **When** la toca de nuevo, **Then** se quita el filtro y vuelve la lista completa.
4. **Given** una tarjeta activa y un texto en la lupa, **When** se combinan, **Then** la lista muestra los que cumplen ambos.
5. **Given** que registra un contacto a un atrasado, **When** se guarda, **Then** los números de las tarjetas se actualizan (sale de «Atrasados» y entra en «Contactados hoy», salvo que haya quedado para más tarde hoy).
6. **Given** una tarjeta con 0, **When** la mira, **Then** se ve en tono apagado y no se puede tocar.

---

### User Story 3 - Captados agrupados por día de asignación, liviano en gama baja (Priority: P2)

En «Captados», los clientes se agrupan por el día en que se los asignaron: «Hoy» arriba, después «Ayer», «Sáb 21»…
(del más reciente al más viejo). Cada grupo tiene un encabezado con el día y cuántos clientes tiene; solo el primero
está abierto y los demás se abren al tocarlos. Cada grupo abierto se pagina (25 filas de entrada; se puede elegir 10, 25,
50 o 100 por página). La lupa y las tarjetas siguen buscando y contando sobre todos.

**Why this priority**: Sin esto la pantalla se traba en los celulares de la fuerza de ventas (constitución II), justo
cuando más clientes hay; agrupar por día además deja ver de un vistazo de cuándo viene el atraso.

**Independent Test**: Con 120 clientes asignados hoy y 30 ayer, la pestaña «Captados» muestra el grupo «Hoy · 120»
abierto con 25 filas y «1–25 de 120», y el grupo «Ayer · 30» cerrado; al elegir 50 por página se ven 50 y «1–50 de 120».

**Acceptance Scenarios**:

1. **Given** clientes asignados hoy, ayer y el sábado, **When** abre «Captados», **Then** ve los grupos «Hoy», «Ayer» y «Sáb 21» en ese orden, cada uno con su cantidad, y solo «Hoy» abierto.
2. **Given** que no tiene asignados hoy, **When** abre «Captados», **Then** el primer grupo (el día más reciente) es el que está abierto.
3. **Given** un grupo cerrado, **When** toca su encabezado, **Then** se abre y muestra sus filas; al tocarlo de nuevo se cierra.
4. **Given** un grupo abierto con más de 25 clientes, **When** se abre, **Then** se dibujan 25, se ve «1–25 de N» y el paginador; «Siguiente» muestra las 25 siguientes (no se suman: nunca hay más filas dibujadas que el tamaño de página).
4b. **Given** la página 3 con 25 por página (filas 51–75), **When** elige 50 por página, **Then** queda en la página que contiene la fila 51 (51–100), y al volver a entrar otro día sigue con 50.
4c. **Given** el paginador de abajo, **When** cambia de página, **Then** la pantalla vuelve al inicio del grupo.
5. **Given** un cliente en un grupo cerrado, **When** se escribe su nombre en la lupa, **Then** aparece: con texto en la lupa todos los grupos con coincidencias se abren.
6. **Given** el encabezado de un grupo de días anteriores, **When** se mira, **Then** indica que son atrasados (por ejemplo «Ayer · 30 atrasados»).
7. **Given** las pestañas «Seguimiento» y «No contestó», **When** se abren, **Then** siguen como lista única ordenada por estado (lo vencido y lo de hoy arriba), con el mismo paginador y tamaño.

---

### User Story 4 - Contador de pestaña sin números repetidos (Priority: P3)

La pestaña «Captados» (y las demás) muestra el total y, aparte, cuántos piden atención, pero nunca el mismo número dos
veces.

**Why this priority**: Es un detalle visual que confunde, pero no impide trabajar.

**Independent Test**: Con 290 captados que piden atención todos, la pestaña dice «Captados 290 ⚠» (un solo número y
el aviso sin repetirlo); con 290 y 40 que piden atención, «Captados 290 ⚠ 40».

**Acceptance Scenarios**:

1. **Given** que todos los clientes de una pestaña piden atención, **When** se mira la pestaña, **Then** se ve el total y el aviso ⚠ sin número (se lee «todos por atender»).
2. **Given** que solo algunos piden atención, **When** se mira la pestaña, **Then** se ven el total y, aparte, el número con ⚠.
3. **Given** que ninguno pide atención, **When** se mira la pestaña, **Then** se ve solo el total.

---

### Edge Cases

- Cliente asignado antes de la existencia del registro de asignaciones (sin evento de asignación): se toma como fecha la de captación, para no dejarlo sin fecha.
- Base de datos sin la migración de la 022 (la app nueva contra un servidor viejo): sin fecha de asignación, la fila se comporta como hoy («Nuevo · contactar hoy») y la columna muestra la captación; nada se rompe.
- Asignado ayer a las 23:50 de La Paz y abierto hoy a las 00:10: ya es «Atrasado · asignado hace 1 día» (cuenta por día calendario de La Paz, no por 24 horas).
- La pantalla queda abierta pasada la medianoche: al recalcular (cada minuto) lo asignado ayer pasa a atrasado sin recargar.
- Reasignado de A a B y después devuelto a A: para A cuenta la última asignación (hoy), con «Reasignado de B».
- Reasignado a otra persona después de que A lo contactó: «Reasignado de A», sin «sin contactar desde» (va a Recaptados por sus contactos).
- Cliente contactado una vez y sin nada agendado: sigue con «Por contactar» (no es atrasado por la regla nueva).
- Un atrasado que se contacta hoy sale de «Atrasados» y entra en «Contactados hoy».
- Un grupo grande del mismo día (por ejemplo 200 asignados el sábado): se abre con 25 y el paginador (8 páginas, con «…»).
- Con una tarjeta activa, los grupos muestran solo los clientes de esa tarjeta; los grupos que quedan vacíos no se muestran.
- La lupa con un texto que no coincide con nada estando en una tarjeta activa: mensaje «Ningún contacto coincide…», como hoy.
- El contador del menú y los avisos del portal usan la misma regla: los atrasados nuevos pasan a contar como «atrasados» en lugar de «para hoy».

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La lista de «Mis contactos» del servidor MUST devolver, para cada cliente, la fecha y hora en que se le asignó a la persona que consulta (su asignación vigente), conservando todos los datos que devuelve hoy (incluidos referido por y quién lo asignó).
- **FR-002**: Si un cliente no tiene registro de asignación, la fecha de asignación MUST ser su fecha de captación.
- **FR-003**: Un cliente nunca contactado y sin nada agendado, asignado antes de hoy (día calendario de La Paz), MUST mostrarse como atrasado con la etiqueta «Atrasado · asignado hace N días» («hace 1 día» en singular), donde N son los días calendario de La Paz entre la asignación y hoy.
- **FR-004**: Un cliente nunca contactado asignado hoy MUST seguir mostrándose «Nuevo · contactar hoy».
- **FR-005**: Los clientes con contactos o con algo agendado MUST conservar las reglas de estado actuales.
- **FR-006**: Si el dato de fecha de asignación no llega, el estado MUST comportarse como antes de esta spec.
- **FR-007**: En la pestaña «Captados», la columna «Captado» MUST pasar a llamarse «Asignado» y mostrar fecha y hora de asignación y quién lo asignó («por <nombre>», o «tomado por ti» si no lo asignó otra persona); las tarjetas de celular MUST mostrar el mismo dato.
- **FR-008**: En «Captados», los asignados hoy MUST ir primero y los atrasados debajo, del día de asignación más reciente al más viejo; dentro de un mismo día se mantiene el orden actual (estado, interés) y después va primero lo asignado más recientemente. En «Recaptados» el orden no cambia, salvo que donde hoy se usa la fecha de captación se usa la de asignación.
- **FR-009**: Arriba de la lista MUST haber tres tarjetas con su número: «Para hoy» (toca hoy o visita de mañana por confirmar), «Atrasados» y «Contactados hoy» (resueltos hoy), contadas sobre todos los contactos abiertos que pasan la lupa. Los tres grupos no se superponen.
- **FR-010**: Tocar una tarjeta MUST filtrar la lista y los contadores de las pestañas a ese grupo; tocarla otra vez MUST quitar el filtro. Una tarjeta en 0 MUST estar deshabilitada.
- **FR-011**: En «Captados», la lista MUST agruparse por día de asignación (La Paz) en secciones plegables con encabezado «Hoy», «Ayer» o «<día abreviado> <número>» y la cantidad de clientes (y que son atrasados, si el día es anterior a hoy). Solo el primer grupo MUST estar abierto al entrar; con texto en la lupa, MUST abrirse todo grupo con coincidencias.
- **FR-011b**: Cada lista (grupo abierto de «Captados», «Seguimiento», «No contestó») MUST paginarse: «Filas por página» 10 / 25 / 50 / 100 (25 de entrada), un solo tamaño para toda la pantalla, recordado en el dispositivo; rango «desde–hasta de total»; primera / anterior / números con «…» / siguiente / última en computadora y «‹ N de M ›» en celular; arriba (en la franja del grupo) y abajo (vuelve al inicio del grupo). Cambiar el tamaño MUST conservar la primera fila visible. Los grupos cerrados no dibujan filas. Con 10 filas o menos no se muestran paginador ni selector.
- **FR-012**: La lupa, las tarjetas y los contadores MUST trabajar sobre todos los contactos, no solo sobre los dibujados.
- **FR-013**: Al cambiar de pestaña, de tarjeta o el texto de la lupa, cada lista MUST volver a su primera página (el tamaño elegido se mantiene).
- **FR-014**: El contador de una pestaña MUST mostrar siempre el total primero; el aviso ⚠ va sin número cuando todos piden atención, con el número cuando solo algunos, y no aparece cuando ninguno. Nunca se repite el mismo número.
- **FR-015**: Atrasado por asignación MUST definirse como: asignado antes de hoy (día calendario de La Paz) y nunca contactado; lo agendado vencido sigue con su regla actual.
- **FR-016**: El contador del menú y los avisos del portal MUST usar la misma regla de estado (los nuevos atrasados cuentan como atrasados).
- **FR-017**: La lupa de la spec 020 (nombre o celular) MUST seguir funcionando igual.
- **FR-019**: Para cada cliente, la lista del servidor MUST devolver además quién lo tenía antes de la asignación vigente (si vino de otra persona) y, si nunca fue contactado, desde cuándo espera sin contacto (su primera asignación; sin registro, la captación).
- **FR-020**: Un cliente que llegó por reasignación de otra persona MUST mostrar «Reasignado de <persona>» y, si nunca fue contactado, «· sin contactar desde el dd/mm». Dentro de su grupo de día, los reasignados nunca contactados MUST ir primero, del que más espera al que menos.
- **FR-018**: Los permisos no cambian: cada persona solo ve sus propios asignados (constitución IV).

### Key Entities

- **Contacto asignado**: cliente abierto a cargo de la persona; se le suma la **fecha de asignación** (la del último registro de asignación hacia esa persona, o la captación si no hay), **de quién venía** (si se lo pasaron desde otra persona) y **desde cuándo espera sin contacto** (solo si nunca fue contactado).
- **Estado del contacto**: atrasado, para hoy, visita por confirmar, más adelante o resuelto hoy; se calcula en la app a partir de las fechas, no se guarda.
- **Resumen del día**: conteos derivados de los estados (no se guardan).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los clientes nunca contactados asignados antes de hoy se ven como atrasados; ninguno asignado hoy se ve como atrasado.
- **SC-002**: Con 400 contactos asignados, «Mis contactos» queda usable (primer dibujo y respuesta a un toque) en un celular de gama baja en menos de 1 segundo tras cargar los datos, porque dibuja 25 filas de entrada (y nunca más que el tamaño de página elegido).
- **SC-003**: La auxiliar sabe cuántos atrasados, cuántos para hoy y cuántos contactó hoy sin desplazarse ni contar a mano.
- **SC-004**: Ninguna pestaña muestra el mismo número dos veces.
- **SC-005**: Encontrar un cliente con la lupa funciona igual con 400 contactos que con 10, sin cambiar de página.

## Assumptions

- «Contactados hoy» cuenta los contactos abiertos de la lista resueltos hoy (el mismo grupo que se ve al tocar la tarjeta). Los que se cerraron hoy (compró, no le interesa) salen de la lista como ya pasa hoy y se ven en «Ver cerrados anteriores».
- «Para hoy» incluye lo que toca hoy y las visitas de mañana por confirmar hoy (lo que hoy pide atención y no está atrasado).
- El tamaño de página elegido se guarda solo en ese navegador (comodidad por dispositivo, sin datos de clientes); si el navegador no deja guardar, se usa 25.
- El agrupado por día es solo para «Captados» (nunca contactados): en «Recaptados» lo urgente es la fecha agendada, y agrupar por asignación escondería un llamado de hoy dentro de un grupo viejo cerrado.
- Qué grupos están abiertos vive solo en la pantalla; al volver a entrar se abre de nuevo solo el primero.
- El filtro de tarjeta vive solo en la pantalla (como la lupa); no se guarda ni va en la URL.
- No se agregan dependencias: la lista liviana se resuelve sin librerías de virtualización.
- La fecha de asignación es la del último registro de asignación hacia la persona que consulta (si se lo quitaron y se lo devolvieron, cuenta la última).
