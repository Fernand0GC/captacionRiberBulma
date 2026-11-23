# Feature Specification: Buscar y reasignar en «Clientes asignados» (y buscar en Mis contactos)

**Feature Branch**: `020-asignados-buscar-reasignar`

**Created**: 2026-11-23

**Status**: Implemented

**Input**: User description: "En el modal \"Clientes asignados\" de Actividad (/gestion): 1) lupa para buscar por nombre o celular; 2) seleccionar los clientes sin contactar y reasignarlos a otra persona de la sucursal, reutilizando src/features/prospects/AssignSelection.tsx y assign_prospects (no crear una función paralela). La misma lupa en \"Mis contactos\" (src/features/followup/InboxPage.tsx). list_agent_assigned debe devolver celular y sucursal del cliente. Con tests Vitest, pgTAP y Playwright, escritos primero (TDD: verlos fallar y después pasar)."

**Amplía**: la pestaña «Asignados» del detalle de Actividad (spec 012, sin carpeta propia; vista de Actividad de `specs/002-monitoreo-seguimiento/`) y
«Mis contactos» (spec 001/016). Reutiliza la selección y asignación de Captaciones/Seguimientos (spec 015).

## Contexto

En Actividad, al tocar a una persona se abre su detalle con la pestaña «Asignados»: los clientes que se le asignaron
en el período, si los contactó y a qué proceso pasaron. Hoy la lista no se puede buscar, y cuando gerencia ve que
una auxiliar dejó clientes sin contactar no puede pasarlos a otra persona desde ahí: tiene que ir a Captaciones o
Seguimientos, volver a encontrarlos uno por uno y asignarlos. La auxiliar, en «Mis contactos», tampoco puede buscar a
un cliente concreto cuando la llama o le escribe.

## Clarifications

### Session 2026-11-23

- Q: ¿Quién puede reasignar clientes sin contactar desde el modal «Clientes asignados»? → A: Los mismos que asignan en Captaciones: encargado (su sucursal), jefe de ventas (sus sucursales), gerente general y administrador. La regla la aplica el servidor, igual que hoy.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reasignar los sin contactar desde el modal (Priority: P1)

Gerencia abre «Clientes asignados» de una auxiliar, toca «Seleccionar», marca los clientes que sigue sin contactar
(o «Sin contactar» y todos los de la lista), elige a otra persona de la sucursal y confirma. Los clientes pasan a
esa persona y la lista del modal muestra «Reasignado a …» en cada uno.

**Why this priority**: Es el valor principal: cerrar el hueco entre ver el problema (clientes sin contactar) y
corregirlo (pasarlos a quien sí los va a contactar) sin salir de Actividad.

**Independent Test**: Con dos clientes asignados hoy a una auxiliar, sin contactar, se reasignan desde el modal a otra
auxiliar de la misma sucursal; ambos quedan a cargo de la nueva y el modal los marca «Reasignado a …».

**Acceptance Scenarios**:

1. **Given** el modal de una persona con clientes sin contactar que siguen a su cargo, **When** toca «Seleccionar», **Then** aparece una casilla solo en esos clientes y la barra «Asignar» abajo.
2. **Given** dos clientes marcados, **When** elige a otra persona de la sucursal y confirma «Reasignar», **Then** ambos pasan a esa persona, se ve el aviso «✓ 2 reasignados» y cada fila muestra «Reasignado a <persona>».
3. **Given** la barra abierta, **When** abre «Asignar a…», **Then** solo aparecen personas activas de la sucursal de esos clientes (las mismas opciones que en Captaciones, con «Repartir entre las N auxiliares» cuando la sucursal tiene más de una).
4. **Given** un cliente ya contactado o que ya no está a cargo de la persona, **When** está en modo selección, **Then** no tiene casilla y no se puede reasignar desde el modal.
5. **Given** una reasignación hecha, **When** se mira la fila de Actividad de la persona original, **Then** sus números de «Asignados» del período no cambian (el historial de asignación se respeta).

---

### User Story 2 - Buscar en «Clientes asignados» (Priority: P2)

Gerencia escribe parte del nombre o del celular en la lupa del modal y la lista se reduce a los clientes que
coinciden, sin perder los otros filtros (Contacto, De dónde vienen, A qué proceso pasaron).

**Why this priority**: Facilita encontrar un cliente puntual en listas largas (rangos de varios días), pero el modal
ya sirve sin ella.

**Independent Test**: En un modal con varios clientes, escribir un fragmento de celular de uno solo deja solo esa fila.

**Acceptance Scenarios**:

1. **Given** el modal con varios clientes, **When** escribe «juan pe», **Then** ve solo los clientes cuyo nombre contiene ambas palabras, en cualquier orden y sin importar tildes ni mayúsculas.
2. **Given** el modal, **When** escribe 4 o más dígitos de un celular (con o sin espacios o guiones), **Then** ve los clientes cuyo celular los contiene.
3. **Given** una búsqueda sin resultados, **When** se aplica, **Then** la lista dice que ningún cliente coincide y el contador muestra «0 de N».
4. **Given** una búsqueda activa y el modo selección, **When** toca «Seleccionar los N del filtro», **Then** se marcan solo los clientes visibles que se pueden reasignar.

---

### User Story 3 - Buscar en «Mis contactos» (Priority: P2)

La auxiliar (o quien tenga contactos a su cargo) escribe nombre o celular en la lupa de «Mis contactos» y ve solo los
clientes que coinciden; los contadores de las pestañas muestran cuántos coinciden en cada una.

**Why this priority**: Ayuda en el día a día (el cliente devuelve la llamada y hay que encontrarlo rápido) y es
independiente del modal.

**Independent Test**: Con dos contactos a cargo, buscar el celular de uno deja solo ese en la lista.

**Acceptance Scenarios**:

1. **Given** «Mis contactos» con varios clientes, **When** escribe parte del nombre, **Then** la lista de la pestaña actual muestra solo los que coinciden.
2. **Given** una búsqueda activa, **When** mira las pestañas Captados / Recaptados, **Then** cada contador muestra cuántos coinciden en esa pestaña.
3. **Given** «Ver cerrados anteriores» abierto, **When** busca, **Then** esa lista también se filtra.
4. **Given** una búsqueda, **When** la borra, **Then** vuelve a ver todos sus contactos.

### Edge Cases

- **Clientes de varias sucursales en el modal** (gerencia viendo «todas las sucursales» y una persona con clientes de
  más de una): solo se asigna dentro de una sucursal; la barra lo dice y pide elegir una sucursal en el filtro de
  Actividad (el modal respeta ese filtro).
- **El cliente cambia mientras el modal está abierto** (otra persona lo contactó o lo reasignó): el servidor aplica la
  asignación igual que en Captaciones; al terminar, la lista se recarga con el estado real.
- **Elegir a la misma persona dueña del cliente**: no cuenta como cambio (igual que hoy en Captaciones).
- **«Quitar responsable»**: disponible como en Captaciones; la fila queda «Quedó sin responsable».
- **Más de 500 asignados en el período**: la búsqueda y la selección actúan sobre los que se muestran (hoy el modal ya
  avisa «se muestran los primeros 500 de N»).
- **Búsqueda con 1 carácter**: se aplica igual (es una lista ya cargada, no consulta al servidor).
- **Celular escrito con prefijo +591 o espacios**: se comparan solo los dígitos.
- **Sin conexión**: la búsqueda funciona sobre lo cargado; reasignar requiere conexión (es una pantalla de gestión,
  no de campo) y muestra el error si falla.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La pestaña «Asignados» del detalle de Actividad MUST tener una caja de búsqueda («lupa») que filtra la lista por nombre del cliente o por celular.
- **FR-002**: La búsqueda por nombre MUST exigir que todas las palabras escritas aparezcan, en cualquier orden, ignorando tildes y mayúsculas (mismo criterio que el buscador de productos).
- **FR-003**: La búsqueda por celular MUST comparar solo dígitos (ignora espacios, guiones y el prefijo +591) y encontrar el cliente si su celular contiene los dígitos escritos.
- **FR-004**: La búsqueda MUST combinarse con los filtros existentes del modal (Contacto, De dónde vienen, A qué proceso pasaron) y el contador «X de N» MUST reflejar el resultado combinado. Los indicadores de arriba (Asignados, Contactados, Sin contactar, De dónde vienen, A qué proceso pasaron) MUST seguir mostrando el total del período.
- **FR-005**: El texto buscado MUST quedar solo en la pantalla (no en la dirección de la página), porque nombre y celular son datos personales (constitución IV).
- **FR-006**: El modal MUST ofrecer «Seleccionar» a quien puede asignar en Captaciones (encargado de su sucursal, jefe de ventas de sus sucursales, gerente general y administrador); en modo selección, MUST mostrar casilla solo en los clientes **sin contactar** que **siguen a cargo** de la persona del modal.
- **FR-007**: La selección y asignación MUST usar exactamente las mismas reglas y la misma barra que Captaciones y Seguimientos: opciones de «Asignar a…» de la sucursal (incluido repartir entre auxiliares y quitar responsable), confirmación «¿Reasignar?» antes de quitarle clientes a alguien, avisos de éxito y error.
- **FR-008**: La reasignación MUST pasar por la misma operación del servidor que Captaciones, que verifica rol, sucursal y destino válido; no se crea una operación nueva ni paralela.
- **FR-009**: Las opciones de «Asignar a…» MUST ser las de la sucursal de los clientes. Si los clientes que se pueden reasignar en el modal son de más de una sucursal, la barra MUST avisarlo y pedir elegir una sucursal en el filtro de Actividad antes de asignar.
- **FR-010**: Después de reasignar, el modal MUST recargar la lista y cada cliente reasignado MUST mostrar «Reasignado a <persona>» (o «Quedó sin responsable»), y la tabla de Actividad MUST actualizarse.
- **FR-011**: Reasignar MUST NOT cambiar los números «Asignados» / «Contactados» del período de la persona original (se calculan del historial de asignaciones).
- **FR-012**: La lista de clientes asignados de una persona MUST incluir, por cliente, su celular y su sucursal, solo para quien ya puede ver esa lista (mismos permisos de hoy).
- **FR-013**: «Mis contactos» MUST tener la misma lupa (mismo criterio de FR-002 y FR-003) que filtra la pestaña visible y la lista «Ver cerrados anteriores».
- **FR-014**: Con una búsqueda activa, los contadores de las pestañas de «Mis contactos» (Captados, Recaptados, Seguimiento, No contestó) MUST mostrar cuántos coinciden; sin búsqueda, los de siempre.
- **FR-015**: Con una búsqueda sin resultados, «Mis contactos» MUST decir que ningún contacto coincide con la búsqueda (distinto del mensaje de lista vacía).
- **FR-016**: La lupa y la selección del modal MUST funcionar en celular (ancho de pantalla chico) igual que en escritorio.

### Key Entities *(include if feature involves data)*

- **Cliente asignado (fila del modal)**: cliente que pasó a cargo de una persona en el período. Se agregan su celular y
  su sucursal a lo que ya trae (nombre, cuándo y quién asignó, origen, contactos, proceso, si fue reasignado).
- **Asignación**: cambio de responsable de un cliente, con quién lo hizo y cuándo; queda en el historial de la ficha.
  Es la misma que generan Captaciones y Seguimientos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Gerencia reasigna los clientes sin contactar de una persona a otra en menos de 30 segundos y sin salir del modal (antes requería ir a otra vista y buscarlos uno por uno).
- **SC-002**: Escribir un fragmento de nombre o celular reduce la lista al instante (sin esperar al servidor), en el modal y en «Mis contactos».
- **SC-003**: El 100 % de las reasignaciones hechas desde el modal quedan en el historial de la ficha con quién y cuándo, igual que desde Captaciones.
- **SC-004**: Los números de Actividad del período no cambian después de reasignar (0 diferencias antes/después en «Asignados» de la persona original).
- **SC-005**: Ningún usuario sin permiso de asignar puede reasignar desde el modal, aunque manipule la pantalla (lo impide el servidor).

## Assumptions

- Quién reasigna desde el modal (confirmado en Clarifications): los mismos roles que hoy asignan en Captaciones
  (encargado de su sucursal, jefe de ventas de sus sucursales, gerente general y administrador).
- Solo se reasignan clientes **sin contactar** y **a cargo todavía** de la persona del modal, como pide el usuario.
  Los contactados se gestionan como hoy (Seguimientos); su depuración es la spec 021.
- La búsqueda es sobre la lista ya cargada (hasta 500 filas en el modal; todos los contactos a cargo en «Mis
  contactos»), sin consultas nuevas al servidor.
- La sucursal de un cliente es la del cliente (como en el resto de Actividad), no la de la persona.
- Reasignar requiere conexión; no entra en la cola sin conexión (es una tarea de gestión, no de campo).
- Fuera de alcance: ocultar asignados contactados, interruptor «Ver ocultos» y aviso automático (spec 021); buscar
  en las demás pestañas del detalle de Actividad (Contactos); cambiar cómo se calculan los números de Actividad.
