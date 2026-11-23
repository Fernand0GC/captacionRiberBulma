# Feature Specification: Depurar «Clientes asignados» (ocultar los ya contactados)

**Feature Branch**: `021-asignados-depurar`

**Created**: 2026-11-23

**Status**: Implemented

**Input**: User description: "Depurar el modal \"Clientes asignados\" de Actividad (/gestion): al abrirlo, si hay asignados ya contactados, un aviso pregunta si ocultarlos o mantenerlos. Ocultar es reversible (interruptor \"Ver ocultos\"), no borra nada (tabla de ocultos) y no cambia los números de Actividad. Solo lo puede hacer gestión; el servidor verifica el rol. Con tests Vitest, pgTAP y Playwright, escritos primero (TDD: verlos fallar y después pasar)."

**Amplía**: el modal «Clientes asignados» (pestaña «Asignados» del detalle de Actividad, spec 012) tal como lo dejó la
spec 020 (lupa, selección y reasignación). No cambia la reasignación ni «Mis contactos».

## Contexto

Al revisar a una persona en Actividad, gestión abre «Clientes asignados» y ve todos los clientes que se le asignaron
en el período. Con rangos largos la lista se llena de clientes que ya fueron contactados y ya no piden atención: lo que
interesa revisar son los pendientes. Hoy no hay forma de sacarlos de la vista sin perder información. Esta feature
permite **ocultarlos** de esa vista (marcarlos, sin borrar ni cambiar nada del cliente ni del historial), con un aviso
que lo propone al abrir el modal y un interruptor para volver a verlos.

## Clarifications

### Session 2026-11-23

- Q: ¿Quién puede ocultar y mostrar («gerencia de ventas»)? → A: Encargado de sucursal, jefe de ventas y gerente (más el administrador, que tiene todo): los mismos que hoy abren el modal. Cada uno solo sobre clientes de sus sucursales (la encargada, la suya; el jefe, las suyas; gerente y admin, todas). Lo verifica el servidor en cada cliente.
- Q: ¿Lo oculto desaparece de «Mis contactos» de la auxiliar? → A: No. Solo deja de verse en «Clientes asignados» de Actividad; la auxiliar sigue viendo y trabajando a sus clientes.
- Q: Si elige «Mantener», ¿vuelve a preguntar? → A: Una vez por día, por quien mira y por persona del modal: si eligió «Mantener» en el modal de una persona, no le vuelve a preguntar por esa persona hasta el día siguiente (se recuerda en ese navegador).
- Q: ¿Se pueden ocultar clientes no contactados que «ya no sirven»? → A: Sí, a mano uno por uno desde su fila. El aviso automático solo propone los contactados.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Aviso al abrir: ocultar los ya contactados (Priority: P1)

Gestión (encargada, jefe de ventas o gerente) abre «Clientes asignados» de una persona. Si en el período hay clientes ya contactados que no
están ocultos, aparece un aviso: «N clientes ya fueron contactados. ¿Ocultarlos de esta lista?» con dos botones,
«Ocultar» y «Mantener». Con «Ocultar», esos clientes salen de la lista y el modal muestra cuántos hay ocultos.

**Why this priority**: Es el pedido central: limpiar la lista para enfocarse en lo pendiente, en un solo toque.

**Independent Test**: Con una persona que tiene 2 clientes contactados y 1 sin contactar en el período, gestión abre
el modal, ve el aviso con «2», toca «Ocultar» y la lista queda con 1 cliente; los números de la fila de Actividad no
cambian.

**Acceptance Scenarios**:

1. **Given** una persona con clientes contactados no ocultos en el período, **When** gestión abre su modal, **Then** aparece el aviso con la cantidad de contactados no ocultos y los botones «Ocultar» y «Mantener».
2. **Given** el aviso abierto, **When** toca «Ocultar», **Then** esos clientes dejan de verse en la lista, aparece «N ocultos» junto al interruptor «Ver ocultos» y se ve el aviso «✓ N ocultos».
3. **Given** el aviso abierto, **When** toca «Mantener», **Then** la lista queda igual y el aviso no vuelve a aparecer para esa persona según la regla de repetición (ver FR-006).
4. **Given** una persona sin contactados, o con todos sus contactados ya ocultos, **When** gestión abre el modal, **Then** no aparece el aviso.
5. **Given** que se ocultaron clientes, **When** se mira la tabla de Actividad, **Then** «Asignados» y «Contactados» de esa persona (y los totales) no cambian.
6. **Given** un usuario sin rol de gestión (auxiliar, supervisor, volantera, Cobros), **When** intenta ocultar o mostrar por cualquier vía, **Then** el servidor lo rechaza.
7. **Given** una encargada y un cliente de otra sucursal, **When** intenta ocultarlo manipulando la pantalla, **Then** el servidor lo rechaza.
8. **Given** que se ocultó un cliente, **When** la auxiliar abre «Mis contactos», **Then** lo sigue viendo como antes.

---

### User Story 2 - «Ver ocultos» y volver a mostrar (Priority: P1)

Gestión activa el interruptor «Ver ocultos»: los clientes ocultos vuelven a la lista, marcados como «Oculto», cada
uno con la acción «Mostrar». Al tocar «Mostrar» el cliente deja de estar oculto para siempre (hasta que lo vuelvan a
ocultar).

**Why this priority**: Sin esto ocultar no sería reversible, y el pedido exige que lo sea.

**Independent Test**: Con un cliente oculto, activar «Ver ocultos» lo muestra marcado; «Mostrar» lo devuelve a la lista
normal y desactivar el interruptor no lo esconde.

**Acceptance Scenarios**:

1. **Given** una persona con clientes ocultos, **When** activa «Ver ocultos», **Then** la lista incluye los ocultos con la marca «Oculto» y la acción «Mostrar».
2. **Given** «Ver ocultos» activo, **When** toca «Mostrar» en un cliente, **Then** el cliente deja de estar oculto y el contador «N ocultos» baja en uno.
3. **Given** «Ver ocultos» desactivado (por defecto al abrir), **When** se usa la lupa o los filtros, **Then** los ocultos no aparecen en los resultados.
4. **Given** «Ver ocultos» activo, **When** se usa la lupa o los filtros, **Then** los ocultos aparecen si coinciden.

---

### User Story 3 - Ocultar uno por uno (Priority: P2)

Gestión oculta a mano un cliente concreto desde su fila (acción «Ocultar»), esté contactado o no (por ejemplo, un
sin contactar que «ya no sirve»).

**Why this priority**: Complementa al aviso para los casos puntuales; el modal ya sirve sin esto.

**Independent Test**: En un modal con un cliente sin contactar, tocar «Ocultar» en su fila lo saca de la lista y suma
uno a «N ocultos».

**Acceptance Scenarios**:

1. **Given** el modal abierto por gestión, **When** toca «Ocultar» en la fila de un cliente, **Then** el cliente sale de la lista y «N ocultos» sube en uno.
2. **Given** un cliente sin contactar oculto, **When** gestión lo busca con «Ver ocultos», **Then** aparece marcado y puede mostrarlo de nuevo.
3. **Given** el modo «Seleccionar» de la spec 020 activo, **When** se mira un cliente oculto con «Ver ocultos», **Then** no se ofrece para reasignar mientras esté oculto.

### Edge Cases

- **Mismo cliente en el modal de dos personas** (se le asignó a una y después a otra): ocultarlo en el modal de una no lo oculta en el de la otra; lo oculto es «este cliente en la lista de esta persona».
- **Cliente oculto que vuelve a asignarse a la misma persona más tarde**: sigue oculto en su modal hasta que alguien lo muestre (se puede ver con «Ver ocultos»).
- **Dos gerentes ocultan o muestran a la vez**: ocultar algo ya oculto o mostrar algo ya visible no es error; gana el último cambio.
- **Contactado después de abrir el modal**: el aviso cuenta los contactados al momento de abrir; al recargar se cuentan de nuevo.
- **Más de 500 asignados en el período**: el aviso y «Ocultar» actúan sobre todos los contactados no ocultos del período, no solo los 500 mostrados (el servidor los calcula).
- **Sin conexión**: ocultar y mostrar requieren conexión (pantalla de gestión) y muestran el error si fallan; la lista no cambia.
- **Usuario sin permiso que manipula la pantalla**: el servidor rechaza ocultar o mostrar.
- **Cliente anulado**: ya no aparece en el modal (como hoy); su marca de oculto no molesta a nadie.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Al abrir «Clientes asignados» de una persona, si el usuario es gestión y en el período hay clientes contactados por esa persona que no están ocultos, el modal MUST mostrar un aviso con la cantidad y dos opciones: «Ocultar» y «Mantener».
- **FR-002**: «Ocultar» del aviso MUST ocultar todos los clientes contactados no ocultos del período de esa persona (incluidos los que no entran en las 500 filas mostradas) y confirmar con «✓ N ocultos».
- **FR-003**: Ocultar MUST NOT borrar ni modificar el cliente, sus contactos, su etapa, su responsable ni su historial de asignaciones; solo registra una marca de «oculto» con quién y cuándo lo ocultó.
- **FR-004**: Ocultar MUST NOT cambiar ningún número de Actividad («Asignados», «Contactados», porcentajes, totales) ni los indicadores de arriba del modal, que siguen contando todo el período.
- **FR-005**: El modal MUST tener el interruptor «Ver ocultos» (apagado al abrir) y mostrar «N ocultos»; con el interruptor encendido, los ocultos aparecen marcados «Oculto» con la acción «Mostrar».
- **FR-006**: Si gestión elige «Mantener», el aviso MUST NOT volver a aparecer ese mismo día para quien mira y esa persona del modal; al día siguiente (hora de Bolivia) puede volver a aparecer. Se recuerda en el navegador de quien mira (comodidad de pantalla, no dato del negocio).
- **FR-007**: «Mostrar» MUST quitar la marca de oculto de ese cliente en la lista de esa persona; el cliente vuelve a la lista normal.
- **FR-008**: Gestión MUST poder ocultar a mano un cliente desde su fila, esté contactado o no. El aviso automático (FR-001/FR-002) solo propone los contactados.
- **FR-009**: Ocultar y mostrar MUST estar permitidos solo a encargado de sucursal, jefe de ventas, gerente y administrador, cada uno sobre clientes de las sucursales que gestiona (encargado: la suya; jefe: las asignadas; gerente y admin: todas). El servidor MUST verificar rol, estado activo y sucursal de cada cliente en cada operación, aunque la pantalla se manipule.
- **FR-010**: Los demás roles (volantero, auxiliar, supervisor, Cobros) MUST NOT poder ocultar, mostrar ni leer la marca de oculto (hoy tampoco abren el modal).
- **FR-011**: La marca de oculto MUST aplicarse al par «cliente + persona del modal»: no afecta al mismo cliente en el modal de otra persona.
- **FR-012**: Lo oculto MUST afectar solo la vista «Clientes asignados» de Actividad: MUST NOT cambiar «Mis contactos» de la auxiliar, Captaciones, Seguimientos ni otra pantalla.
- **FR-013**: Con «Ver ocultos» apagado, la lupa, los filtros, el contador «X de N» y la selección para reasignar (spec 020) MUST actuar solo sobre los no ocultos; un cliente oculto MUST NOT ofrecerse para reasignar.
- **FR-014**: Ocultar o mostrar algo que ya está en ese estado MUST NOT dar error (operación repetible sin efecto).
- **FR-015**: El aviso, el interruptor y las acciones MUST funcionar en celular igual que en escritorio.

### Key Entities *(include if feature involves data)*

- **Cliente oculto**: marca que dice «este cliente no se muestra en la lista de asignados de esta persona». Guarda el
  cliente, la persona del modal, quién lo ocultó y cuándo. No toca al cliente ni a su historial. Mostrar quita la marca.
- **Cliente asignado (fila del modal)**: la misma de la spec 020, más si está oculto.
- **Decisión «Mantener»**: recuerdo de que gestión ya respondió el aviso para esa persona, para no repetirlo
  (una vez por día, por quien mira y por persona).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Gestión deja la lista de una persona solo con los pendientes en un toque (aviso → «Ocultar»), en menos de 5 segundos.
- **SC-002**: 0 diferencias en los números de Actividad antes y después de ocultar o mostrar.
- **SC-003**: El 100 % de lo ocultado se puede volver a ver y a mostrar; no se pierde ningún dato.
- **SC-004**: Ningún usuario sin rol de gestión, ni una encargada sobre clientes de otra sucursal, puede ocultar ni mostrar, aunque manipule la pantalla (lo impide el servidor).
- **SC-005**: Tras elegir «Mantener», el aviso no reaparece para esa persona dentro del plazo acordado.

## Assumptions

- «Contactado» es lo mismo que hoy en el modal: la persona registró al menos un contacto con el cliente después de
  que se le asignó (columna «Contacto»).
- Los indicadores de arriba del modal (Asignados, Contactados, De dónde vienen, A qué proceso pasaron) siguen
  contando todo el período, ocultos incluidos, para que coincidan con la tabla de Actividad.
- La marca de oculto es compartida: si un jefe de ventas oculta, el gerente también lo ve oculto (es una depuración
  de la vista de gestión, no una preferencia personal).
- Ocultar y mostrar requieren conexión; no entran en la cola sin conexión.
- Fuera de alcance: borrar o anular clientes, cambiar cómo se calculan los números de Actividad, ocultar en otras
  pestañas del detalle (Contactos) o en otras pantallas.
