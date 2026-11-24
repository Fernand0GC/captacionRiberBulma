# Feature Specification: Recontacto visible para jefas — agenda por persona, primer contacto vs. recontacto y «Contar por» en Seguimientos

**Feature Branch**: `023-recontacto-visible`

**Created**: 2026-11-23

**Status**: En producción. Migración `migraciones-023-produccion.sql` aplicada y app en `main` (`74f149c`, 2026-11-23). Tutorial en video terminado (2026-11-23): `tutoriales/videos/captacion/recontacto-encargada/` (1:36, encargada, escritorio), con ficha para Drive y subtítulos.

**Input**: User description: "La jefa de ventas no ve el seguimiento de los clientes ya asignados. Ejemplo: Maico tiene 175 clientes asignados en el mes; a varios los llamó una vez y tiene que volver a llamarlos (recaptación). Esa segunda llamada no la ven las jefas: en «Del día» no les aparece nada de los ya asignados, en «Actividad» solo aparece lo nuevo y Seguimientos cuenta por fecha de registro. Armar la spec con tres puntos: 1) agenda de recontacto por persona en «Del día» (le tocaba hoy / llamó / pendientes / atrasados); 2) en Actividad separar «Primer contacto» de «Recontacto»; 3) en Seguimientos un selector «Contar por» (registro, asignación, último contacto, próximo contacto)."

**Amplía**: «Del día» (spec 009), Actividad (specs 002, 012, 020, 021) y Seguimientos (specs 002, 015). Usa las mismas reglas de «Para hoy» y «Atrasados» de «Mis contactos» (spec 022).

## Contexto

El sistema ya guarda cada llamada y ya agenda solo la siguiente: si el cliente no contesta, pasa a «Recaptación» y
queda para volver a llamar al día siguiente a las 9:00 (al tercer intento sin respuesta pasa a «Sin interés»); si
pide que lo llamen después o queda en visitar la tienda, queda agendado para esa fecha. El auxiliar ve esa agenda en
«Mis contactos → Para hoy / Atrasados».

La jefa de ventas, en cambio, no tiene dónde verla:

- **Del día** muestra lo que se hizo (registros nuevos y clientes contactados), nunca lo que tocaba hacer. Si Maico no
  vuelve a llamar a sus pendientes, no aparece nada y nadie se entera.
- **Actividad** cuenta como «asignado» solo la primera asignación del período y como «contactado» a quien se llamó al
  menos una vez; la segunda y la tercera llamada se suman al total, pero no se distinguen de la primera.
- **Seguimientos** filtra por la fecha en que se registró el cliente: un cliente registrado en octubre al que se
  vuelve a llamar en noviembre no aparece en «Este mes».

No hace falta que el auxiliar marque nada nuevo (descartada la idea de un botón «reasignado» o «volver a llamar»): la
información ya existe, solo falta mostrarla.

## Clarifications

### Session 2026-11-23

Respondido por la jefa nacional de ventas (Isa Vega) en la consulta a jefas del 2026-11-23. También aprobó las tres mejoras (US1, US2 y US3).

- Q: ¿La agenda de recontacto («Le tocaba») se ve solo para hoy o también para días pasados (Ayer, 7 días, rango)? → A: **Solo «Hoy»**. La agenda lee lo agendado tal como está ahora; lo que se arrastra de días anteriores se ve en «Atrasados». Revisar días pasados queda fuera de esta spec.
- Q: ¿Qué es un «recontacto»? → A: **Un contacto a un cliente que ya tenía un contacto anterior de cualquier persona** (mide la 2.ª llamada al cliente). Si a Maico le pasan un cliente que ya llamó otra persona, su primera llamada a ese cliente cuenta como «Recontacto».

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agenda de recontacto por persona en «Del día» (Priority: P1)

La jefa de ventas abre «Del día» y, además de lo que ya ve, encuentra una sección «Agenda de recontacto» con una fila
por persona: **Le tocaba hoy** (clientes que esa persona debía contactar hoy: agendados para hoy y asignados sin
contactar), **Contactó** (de esos, cuántos contactó hoy), **Pendientes** (los que todavía no contactó) y
**Atrasados** (los que le tocaban en días anteriores y siguen sin contacto). Al tocar una persona ve la lista de esos
clientes con su etapa, intentos («1/3»), fecha agendada, último contacto y última nota.

**Why this priority**: Es exactamente la queja: «le pone Del día y no le aparece nada». Sin esto, lo que el auxiliar
deja de hacer es invisible.

**Independent Test**: Con Maico con 3 clientes en «Recaptación» agendados para hoy y 2 agendados para ayer sin
contacto, al contactar a 1 de los de hoy la fila de Maico dice Le tocaba hoy 3 · Contactó 1 · Pendientes 2 ·
Atrasados 2.

**Acceptance Scenarios**:

1. **Given** un cliente asignado a Maico en «Recaptación» agendado para hoy a las 9:00, **When** la jefa abre «Del día» con «Hoy», **Then** la fila de Maico lo cuenta en «Le tocaba hoy» y en «Pendientes».
2. **Given** el mismo cliente, **When** Maico registra un contacto (con cualquier resultado, también «no contestó»), **Then** al refrescar pasa de «Pendientes» a «Contactó» y sigue contando en «Le tocaba hoy».
3. **Given** un cliente agendado para ayer que Maico no contactó, **When** la jefa abre «Del día», **Then** cuenta en «Atrasados» de Maico, no en «Le tocaba hoy».
4. **Given** un cliente asignado a Maico hoy y nunca contactado, **When** la jefa abre «Del día», **Then** cuenta en «Le tocaba hoy»; si se lo asignaron antes de hoy y nunca lo contactó, cuenta en «Atrasados» (misma regla que «Mis contactos», spec 022).
5. **Given** un cliente agendado para mañana, o en «Venta» o «Sin interés», **When** la jefa abre «Del día», **Then** no cuenta en ninguna columna.
6. **Given** la fila de Maico, **When** la jefa la toca, **Then** ve la lista de sus clientes de la agenda, separados en Pendientes, Contactados hoy y Atrasados, con nombre, celular, etapa, intentos, fecha agendada, último contacto y última nota.
7. **Given** que Maico ve en «Mis contactos» 5 «Para hoy» y 2 «Atrasados», **When** la jefa mira su fila al mismo tiempo, **Then** los números coinciden (Pendientes + Contactó = Le tocaba hoy, con los mismos 2 atrasados).
8. **Given** una persona sin nada en la agenda, **When** la jefa abre la sección, **Then** la persona aparece con ceros si es auxiliar, supervisor o encargado activo de la sucursal (mismo criterio que Actividad).

---

### User Story 2 - «Primer contacto» y «Recontacto» en Actividad (Priority: P2)

En Actividad, por persona y por sucursal, los contactos se separan en **Primer contacto** (la primera vez que se
llama al cliente) y **Recontacto** (2.ª llamada o más). Así se ve, por ejemplo: «Maico · 175 asignados · 120 primer
contacto · 60 recontactos».

**Why this priority**: Hace visible el trabajo de recaptación en el resumen que la gerencia ya usa, pero la US1 es la
que permite actuar en el día.

**Independent Test**: Un cliente con 3 contactos en el período (el primero dentro del período) suma 1 en «Primer
contacto» y 2 en «Recontacto»; la suma de ambas columnas es igual al total de contactos.

**Acceptance Scenarios**:

1. **Given** un cliente al que Maico llama por primera vez hoy, **When** la jefa abre Actividad con «Hoy», **Then** suma 1 en «Primer contacto» de Maico.
2. **Given** un cliente que Maico llamó ayer y vuelve a llamar hoy, **When** la jefa abre Actividad con «Hoy», **Then** suma 1 en «Recontacto», aunque el cliente se haya registrado o asignado otro mes.
3. **Given** cualquier período, **When** la jefa mira una fila, **Then** «Primer contacto» + «Recontacto» = total de contactos de esa fila.
4. **Given** la tabla por sucursal («todas las sucursales»), **When** la jefa la mira, **Then** también muestra las dos columnas.
5. **Given** el Excel de Actividad, **When** se exporta, **Then** incluye las dos columnas.
6. **Given** un cliente que Ana llamó el lunes y que el martes se reasigna a Maico, **When** Maico lo llama el martes, **Then** esa llamada suma 1 en «Recontacto» de Maico (el cliente ya había sido contactado).
7. **Given** los números actuales de Actividad (asignados, contactados de los asignados, ocultos de la spec 021), **When** se agrega esta separación, **Then** no cambian.

---

### User Story 3 - «Contar por» en Seguimientos (Priority: P3)

En Seguimientos, junto al período, un selector **Contar por** con cuatro opciones: **Registro** (como hoy),
**Asignación**, **Último contacto** y **Próximo contacto**. El texto bajo el total cambia según la opción («clientes ·
asignados del … al …», «… contactados por última vez del … al …», «… agendados del … al …»).

**Why this priority**: Permite armar listas de trabajo (por ejemplo, «Próximo contacto + Hoy» = la cola de toda la
sucursal; «Asignación + Este mes» = los 175 de Maico), pero la US1 ya cubre la necesidad principal.

**Independent Test**: Un cliente registrado en octubre, asignado y llamado en noviembre y agendado para hoy no aparece
con «Registro + Este mes» y sí aparece con «Asignación + Este mes», «Último contacto + Este mes» y «Próximo contacto +
Hoy».

**Acceptance Scenarios**:

1. **Given** Seguimientos sin cambiar nada, **When** la jefa lo abre, **Then** cuenta por «Registro» y muestra lo mismo que hoy.
2. **Given** «Contar por: Asignación» y «Este mes», con «Responsable: Maico», **When** la jefa mira el total, **Then** ve los clientes asignados a Maico en el mes, sin importar cuándo se registraron.
3. **Given** «Contar por: Último contacto» y «Hoy», **When** la jefa mira la lista, **Then** ve los clientes cuyo último contacto fue hoy.
4. **Given** «Contar por: Próximo contacto» y «Hoy», **When** la jefa mira la lista, **Then** ve los clientes agendados para hoy, y con «Solo vencidos» los atrasados.
5. **Given** cualquier opción, **When** la jefa usa las pestañas de etapa (Todos, Sin contactar, Seguimiento / Recaptación…), los filtros, «Seleccionar/Asignar» o «Exportar Excel», **Then** todo respeta la opción elegida.
6. **Given** una opción elegida, **When** la jefa comparte o recarga el enlace, **Then** la opción se conserva (va en la URL como los demás filtros, spec 014).

---

### Edge Cases

- **Cliente reasignado durante el día**: la agenda lo cuenta para quien lo tiene asignado ahora; si la persona anterior lo contactó hoy antes de la reasignación, ese contacto sigue contando en Actividad para quien lo hizo.
- **Tercer «no contestó»**: el cliente pasa a «Sin interés»; el contacto cuenta en «Contactó» de hoy y desde mañana el cliente ya no está en la agenda.
- **Agendado para hoy a una hora que aún no llega** (por ejemplo, «llamar a las 17:00»): cuenta en «Le tocaba hoy» y en «Pendientes» hasta que se contacte; no es «Atrasado» hasta el día siguiente.
- **Contacto registrado sin conexión que se sincroniza tarde**: cuenta en el día en que se hizo (hora de Bolivia), como en el resto de los reportes.
- **Cliente sin responsable**: no aparece en la agenda por persona; sí en Seguimientos.
- **Cliente anulado o duplicado rechazado**: no cuenta en ninguna parte (igual que hoy).
- **Jefe de ventas con varias sucursales**: ve la agenda de las sucursales de su alcance, con el selector de sucursal que ya usa «Del día».
- **Muchas personas o muchos clientes** (por ejemplo, 400 de prueba «Vol 021»): la lista de clientes de una persona se pagina igual que «Mis contactos».

## Requirements *(mandatory)*

### Functional Requirements

**Agenda de recontacto (US1)**

- **FR-001**: «Del día» MUST mostrar una sección «Agenda de recontacto» con una fila por persona y las columnas Le tocaba hoy, Contactó, Pendientes y Atrasados.
- **FR-002**: «Le tocaba hoy» MUST contar los clientes abiertos (ni venta ni sin interés) asignados a la persona que están agendados para hoy o que le asignaron hoy y nunca se contactaron, con la misma regla que «Para hoy» en «Mis contactos» (spec 022).
- **FR-003**: «Contactó» MUST contar los clientes de la persona con al menos un contacto registrado hoy, con cualquier resultado, salvo los que quedaron para volver a contactar más tarde hoy (igual que «Contactados hoy» de «Mis contactos»; incluye también los que hoy pasaron a venta o sin interés). «Pendientes» MUST ser los que siguen para hoy sin resolver (igual que «Para hoy»), y «Le tocaba hoy» MUST ser Pendientes + Contactó.
- **FR-004**: «Atrasados» MUST contar los clientes abiertos de la persona agendados antes de hoy, o asignados antes de hoy y nunca contactados, que siguen sin contacto, con la misma regla que «Atrasados» en «Mis contactos».
- **FR-005**: Al tocar una persona, el sistema MUST mostrar sus clientes de la agenda separados en Pendientes, Contactados hoy y Atrasados, con nombre, celular, etapa, intentos, fecha agendada, último contacto y última nota, paginados.
- **FR-006**: La agenda MUST respetar el mismo acceso y alcance por sucursal que «Del día» (encargado, jefe de ventas, gerencia y Sistemas).
- **FR-007**: Las personas fijas de la sucursal (auxiliar, supervisor y encargado activos) MUST aparecer aunque estén en cero; las demás, solo si tienen algo en la agenda.
- **FR-008**: La agenda MUST incluirse en el Excel de «Del día».
- **FR-009**: La agenda MUST mostrarse solo para «Hoy». Con otro día elegido en «Del día», la sección MUST indicar que la agenda solo está disponible para hoy, sin mostrar números, y ofrecer volver a hoy.

**Primer contacto y recontacto (US2)**

- **FR-010**: Actividad MUST separar los contactos del período en «Primer contacto» y «Recontacto», por persona y por sucursal.
- **FR-011**: Un contacto MUST ser «Recontacto» si el cliente ya tenía un contacto anterior de cualquier persona, aunque ese contacto anterior sea de otro período; si no, es «Primer contacto».
- **FR-012**: Para cada fila, «Primer contacto» + «Recontacto» MUST ser igual al total de contactos de esa fila.
- **FR-013**: El Excel de Actividad MUST incluir las dos columnas.
- **FR-014**: Los demás números de Actividad (asignados, contactados de los asignados, ocultos) MUST quedar iguales.

**Contar por en Seguimientos (US3)**

- **FR-015**: Seguimientos MUST ofrecer «Contar por» con Registro, Asignación, Último contacto y Próximo contacto; «Registro» es la opción inicial.
- **FR-016**: Con «Asignación», el período MUST aplicarse a la fecha de la asignación vigente del cliente; con «Último contacto», a la fecha de su último contacto; con «Próximo contacto», a la fecha agendada.
- **FR-017**: El texto bajo el total MUST decir qué fecha se está contando.
- **FR-018**: Las pestañas de etapa, los filtros existentes, «Seleccionar/Asignar» y «Exportar Excel» MUST respetar la opción elegida.
- **FR-019**: La opción elegida MUST guardarse en la URL, como los demás filtros.

**Generales**

- **FR-020**: Todas las fechas MUST calcularse en hora de Bolivia (America/La_Paz).
- **FR-021**: El sistema MUST NOT pedirle al auxiliar ningún dato o marca nueva: todo sale de los contactos, asignaciones y fechas agendadas que ya se guardan.

### Key Entities

- **Contacto (seguimiento)**: cada llamada, mensaje o atención en tienda registrada sobre un cliente, con fecha, persona, método y resultado. Ya existe.
- **Cliente (prospecto)**: con etapa, responsable actual, intentos sin respuesta y próxima fecha de contacto agendada. Ya existe.
- **Asignación**: cada vez que un cliente se pasa a una persona, con fecha y quién lo asignó. Ya existe.
- **Agenda de recontacto (vista nueva)**: para una persona y un día, los clientes que le tocaba contactar, cuáles contactó, cuáles siguen pendientes y cuáles arrastra de días anteriores. Se calcula; no se guarda aparte.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La jefa de ventas puede responder «¿a cuántos de sus pendientes de hoy llamó Maico y cuántos se le atrasaron?» en menos de 30 segundos desde «Del día», sin pedirle el celular.
- **SC-002**: En el 100 % de los casos de prueba, los números de la agenda de una persona coinciden con «Para hoy» y «Atrasados» de su «Mis contactos» en el mismo momento.
- **SC-003**: En Actividad, «Primer contacto» + «Recontacto» = total de contactos en el 100 % de las filas y períodos probados.
- **SC-004**: Un cliente registrado en un mes y vuelto a llamar en otro aparece en Seguimientos con «Último contacto» o «Próximo contacto» en el período correcto en el 100 % de los casos de prueba.
- **SC-005**: Con «Contar por: Registro», Seguimientos muestra exactamente los mismos totales que antes del cambio.
- **SC-006**: «Del día» con la agenda sigue abriendo en menos de 3 segundos para una sucursal con 500 clientes abiertos.

## Assumptions

- «Jefa de ventas» incluye a todos los que hoy ven «Del día», Actividad y Seguimientos (encargado, jefe de ventas, gerencia y Sistemas), con el mismo alcance por sucursal.
- Las reglas de agenda (no contestó → mañana 9:00; buscando producto → en 2 días; llamar después o visita → la fecha elegida; 3 «no contestó» → sin interés) no cambian.
- La agenda cuenta para el responsable **actual** del cliente; Actividad sigue contando cada contacto para quien lo hizo.
- «Contactó» acepta cualquier resultado, incluido «no contestó», igual que «Clientes con seguimiento» de la spec 009.
- «Registro» sigue siendo la opción inicial de Seguimientos para no cambiarle la vista a quien ya la usa.
- No se agrega ningún botón ni marca nueva para el auxiliar: se descartó el botón «reasignado / volver a llamar» porque la información ya existe.
- Fuera de alcance: alertas o notificaciones automáticas a la jefa, metas de recontacto por persona y cambios a las reglas de 3 intentos.
