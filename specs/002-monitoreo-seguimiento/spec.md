# Feature Specification: Monitoreo de seguimiento y actividad del personal

**Feature Branch**: `002-monitoreo-seguimiento`

**Created**: 2026-11-13

**Status**: Draft

## Clarifications

### Session 2026-11-13

- Q: ¿Qué cuenta como "intentos"? → A: Dos columnas: "No contestó" seguidos (contador actual, 0–3) y contactos totales.
- Q: ¿Por qué fecha filtra el período en Seguimientos? → A: Fecha de registro del cliente, igual que Captaciones.
- Q: ¿Quién aparece como fila en Actividad? → A: Auxiliares y supervisores activos siempre (aunque en cero) + cualquier otro con contactos en el período.

**Input**: User description: "En Captaciones (/gestion), para encargado, jefe de ventas, gerente y Sistemas: una vista Seguimientos (un cliente por fila, en qué punto del seguimiento está, última observación, intentos, tabs por estado, filtros de interés, etc.) y una vista Actividad (una fila por personal, cuántas veces llamó, escribió, etc., solo números). Al entrar al cliente, el detalle de sus contactos por personal."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver en qué punto está el seguimiento de cada cliente (Priority: P1)

El encargado (o jefe de ventas, gerente, Sistemas) entra a Captaciones y elige la vista **Seguimientos**. Ve un cliente por fila con su responsable, etapa, nivel de interés, cuántas veces se intentó contactarlo, cuándo y cómo fue el último contacto, la última observación que dejó el responsable, cuándo toca volver a contactarlo y cuántos días lleva sin contacto. Cambia entre pestañas por estado (Sin contactar, Seguimiento/Recaptación, Cliente potencial, Venta, Sin interés, Todos), cada una con su cantidad, y filtra para encontrar lo que está abandonado o atrasado.

**Why this priority**: hoy el encargado solo ve qué entró y a quién se asignó; no sabe si el responsable realmente lo está trabajando. Es el hueco principal que motivó el pedido.

**Independent Test**: con clientes de prueba en distintas etapas y con contactos registrados, entrar como encargado a la vista Seguimientos y comprobar que cada fila muestra la última observación, los intentos y el estado correctos, y que las pestañas y filtros cuentan y filtran bien.

**Acceptance Scenarios**:

1. **Given** un cliente con 3 contactos registrados, **When** el encargado abre Seguimientos, **Then** la fila muestra la observación, fecha, forma y resultado del contacto más reciente.
2. **Given** clientes en todas las etapas, **When** el encargado cambia de pestaña, **Then** solo ve los de esa etapa y el número de cada pestaña coincide con las filas que muestra; la suma de las pestañas de estado es igual a "Todos".
3. **Given** un cliente cuya fecha de volver a contactar ya pasó, **When** el encargado activa el filtro "Vencidos", **Then** el cliente aparece, y en el orden por defecto aparece antes que los no vencidos.
4. **Given** clientes con interés Alto, Medio, Bajo y sin dato, **When** el encargado filtra por "Alto", **Then** solo ve los de interés Alto.
5. **Given** un cliente al que nadie contactó todavía, **When** aparece en la lista, **Then** muestra 0 intentos, sin último contacto y sin observación, sin romper la fila.
6. **Given** un encargado de la sucursal A, **When** intenta ver clientes de la sucursal B (por ejemplo, cambiando la dirección de la página), **Then** no ve ningún cliente de B.

---

### User Story 2 - Ver cuánto trabaja cada persona (Priority: P1)

El encargado elige la vista **Actividad**. Ve una fila por persona del equipo y columnas solo con números para el período elegido: llamadas por WhatsApp, mensajes, atenciones en tienda, contactos efectivos, "no contestó", visitas pactadas, ventas y clientes distintos contactados, con una fila de totales al final.

**Why this priority**: es la otra mitad del pedido: medir el esfuerzo del personal, no solo el estado de los clientes.

**Independent Test**: registrar contactos de prueba de dos personas en el día y comprobar que cada número de la tabla coincide con lo registrado y que los totales suman.

**Acceptance Scenarios**:

1. **Given** que Ana registró hoy 5 llamadas por WhatsApp y 2 mensajes, **When** el encargado abre Actividad con período "Hoy", **Then** la fila de Ana muestra 5 y 2 en esas columnas.
2. **Given** varias personas con contactos, **When** se muestra la tabla, **Then** la fila de totales es la suma de cada columna.
3. **Given** que un cliente fue reasignado de Ana a Luis después de que Ana lo llamó, **When** se ve Actividad, **Then** esa llamada sigue contando para Ana.
4. **Given** una persona sin ningún contacto en el período, **When** se ve Actividad, **Then** si es auxiliar o supervisor activo aparece con todo en cero (para ver quién no trabajó); si es encargado o gerencia, no aparece.

---

### User Story 3 - Bajar del número al detalle (Priority: P2)

Desde Actividad, el encargado toca la fila de una persona (o un número concreto, por ejemplo sus "Ventas") y ve la lista de esos contactos: cliente, fecha y hora, forma, resultado y observación. Desde ahí toca un cliente y entra a su detalle.

**Why this priority**: los números solos generan preguntas ("¿a quién le vendió?"); el detalle las responde sin salir de la pantalla. Depende de la US2.

**Independent Test**: tocar el número de "Ventas" de una persona y comprobar que la lista tiene exactamente esa cantidad de contactos y todos con resultado "Compró".

**Acceptance Scenarios**:

1. **Given** que Ana tiene 3 en "Visitas pactadas", **When** el encargado toca ese 3, **Then** ve una lista de 3 contactos de Ana con resultado "Visitará la tienda".
2. **Given** la lista de contactos de Ana, **When** toca un cliente, **Then** se abre el detalle de ese cliente.
3. **Given** el detalle abierto, **When** lo cierra, **Then** vuelve a la lista o tabla donde estaba, con los mismos filtros.

---

### User Story 4 - Ver en el cliente quién lo contactó y cuántas veces (Priority: P2)

Al abrir el detalle de un cliente (desde cualquier vista), arriba del historial se ve un resumen por persona: cuántos contactos hizo cada una y de qué forma (por ejemplo "Ana: 3 llamadas por WhatsApp, 1 mensaje · Luis: 1 en tienda"). Debajo sigue el historial completo como hoy.

**Why this priority**: completa el monitoreo a nivel de cliente; el historial ya existe, solo falta el resumen.

**Independent Test**: abrir un cliente con contactos de dos personas y comprobar que el resumen por persona coincide con el historial.

**Acceptance Scenarios**:

1. **Given** un cliente contactado por Ana (3 veces) y Luis (1 vez), **When** se abre su detalle, **Then** el resumen muestra a Ana con 3 y a Luis con 1, desglosado por forma de contacto.
2. **Given** un cliente sin contactos, **When** se abre su detalle, **Then** el resumen no aparece o indica "Sin contactos todavía".

---

### User Story 5 - Llevarse los datos a Excel (Priority: P3)

En Seguimientos y en Actividad, el encargado exporta a Excel lo que está viendo, con los mismos filtros.

**Why this priority**: útil para reuniones y reportes, pero no bloquea el monitoreo en pantalla.

**Independent Test**: aplicar filtros, exportar y comprobar que el archivo tiene las mismas filas y columnas que la pantalla.

**Acceptance Scenarios**:

1. **Given** Seguimientos filtrado por pestaña "Cliente potencial" e interés "Alto", **When** exporta, **Then** el archivo contiene solo esos clientes, con la observación completa (sin truncar).
2. **Given** Actividad con período "Este mes", **When** exporta, **Then** el archivo tiene una fila por persona, las mismas columnas y la fila de totales.

---

### Edge Cases

- Cliente sin ningún contacto: 0 intentos; último contacto, observación y próximo contacto vacíos; "días sin contacto" se cuenta desde que se registró.
- Observación larga (hasta 500 caracteres): se recorta en la fila y se lee completa en el detalle o en el Excel.
- Último contacto sin observación: la columna muestra el resultado del contacto, no queda en blanco engañoso.
- Cliente reasignado: Seguimientos muestra al responsable actual; Actividad cuenta cada contacto a quien lo hizo.
- Persona desactivada: sus contactos pasados siguen contando en Actividad del período en que los hizo, y se ve marcada como inactiva.
- Clientes anulados o rechazados por duplicado: no aparecen en ninguna vista ni conteo.
- Contactos registrados sin señal que llegan horas después: cuentan en el día y hora en que se hicieron, no en el que llegaron.
- Cortes de día (Hoy, Ayer) en hora de Bolivia, también para contactos cerca de la medianoche.
- Sin resultados para los filtros: mensaje claro según el caso (por ejemplo "No hay clientes vencidos" o "Nadie registró contactos en este período"), nunca una tabla vacía sin explicación.
- Muchos clientes (miles en "Todos"): la lista se pagina y la pantalla sigue respondiendo.
- Contactos antiguos con la forma "llamada telefónica" (que ya no se ofrece): se cuentan junto a las llamadas por WhatsApp como "Llamadas".

## Requirements *(mandatory)*

### Functional Requirements

**Acceso**

- **FR-001**: Las vistas Seguimientos y Actividad MUST estar disponibles solo para encargado, jefe de ventas, gerente y Sistemas, dentro de la sección Captaciones, junto a las vistas actuales (Captaciones y Visitas pactadas).
- **FR-002**: Cada rol MUST ver solo su alcance: encargado, su sucursal; jefe de ventas, las sucursales que gestiona; gerente y Sistemas, todas (con selector de sucursal). La restricción MUST cumplirse en el servidor, no solo en la pantalla.
- **FR-003**: Las vistas MUST ser de solo lectura: no cambian etapa, responsable ni datos del cliente. Desde el detalle del cliente se mantienen las acciones que ya existen hoy para cada rol.

**Vista Seguimientos**

- **FR-010**: MUST mostrar un cliente por fila con: nombre, responsable actual (o "Sin asignar"), etapa, nivel de interés, intentos (No contestó seguidos y Contactos totales, FR-011), último contacto (fecha, forma y resultado), última observación, próximo contacto (fecha de volver a contactar o de visita pactada) y días sin contacto.
- **FR-011**: Los intentos MUST mostrarse en dos columnas: **No contestó seguidos** (el contador actual, que se reinicia con un contacto efectivo y cierra al tercero, 0–3) y **Contactos totales** (todos los contactos registrados al cliente). El filtro de intentos (FR-013) aplica a No contestó seguidos.
- **FR-012**: MUST ofrecer pestañas por estado, cada una con su cantidad según los filtros activos: **Sin contactar** (captación), **Seguimiento / Recaptación** (seguimiento + recaptación), **Cliente potencial**, **Venta**, **Sin interés** y **Todos**.
- **FR-013**: MUST ofrecer los filtros actuales de Captaciones (período, sucursal, responsable incluido "Sin asignar", canal, registrado por, búsqueda por nombre o celular) y además: nivel de interés (Alto, Medio, Bajo, Sin dato), intentos (0, 1–2, 3 o más), solo vencidos (la fecha de volver a contactar o de visita ya pasó), sin contacto hace más de N días (opciones fijas: 3, 7, 15, 30) y, en la pestaña Sin interés, motivo de pérdida.
- **FR-014**: El período MUST filtrar por la fecha en que se registró el cliente (igual que en Captaciones), en hora de Bolivia.
- **FR-015**: El orden por defecto MUST ser: primero los vencidos (el más atrasado arriba), luego por más días sin contacto.
- **FR-016**: La última observación MUST mostrarse recortada en la fila y completa en el detalle del cliente.
- **FR-017**: Tocar una fila MUST abrir el detalle del cliente (el mismo que hoy se usa para el seguimiento).
- **FR-018**: La lista MUST paginarse de a 50 clientes, manteniendo filtros y pestaña al cambiar de página.

**Vista Actividad**

- **FR-020**: MUST mostrar una fila por persona y columnas numéricas para el período elegido: **Llamadas** (por WhatsApp; incluye las telefónicas antiguas), **Mensajes**, **En tienda**, **Efectivos** (contactos marcados como efectivos), **No contestó**, **Visitas pactadas**, **Ventas** (resultado "Compró"), **Clientes contactados** (clientes distintos) y **Total de contactos**.
- **FR-021**: Cada contacto MUST contarse para la persona que lo hizo, aunque el cliente luego se reasigne.
- **FR-022**: Las personas listadas MUST ser, dentro del alcance de sucursales del rol que mira: todos los auxiliares y supervisores activos (aunque estén en cero) y, además, cualquier otra persona (encargado, jefe de ventas, gerencia, Sistemas, o personal ya inactivo) que tenga al menos un contacto en el período.
- **FR-023**: MUST mostrar una fila de totales con la suma de cada columna.
- **FR-024**: MUST permitir ordenar por cualquier columna.
- **FR-025**: Tocar el nombre de una persona MUST mostrar todos sus contactos del período; tocar un número MUST mostrar solo los contactos que forman ese número. Cada contacto muestra cliente, fecha y hora, forma, resultado y observación, y al tocarlo abre el detalle del cliente.
- **FR-026**: El período de Actividad MUST filtrar por la fecha y hora en que se hizo el contacto, en hora de Bolivia.

**Detalle del cliente**

- **FR-030**: El detalle del cliente MUST mostrar, arriba del historial, un resumen por persona con su cantidad de contactos desglosada por forma (llamada, mensaje, en tienda).

**Comunes**

- **FR-040**: Ambas vistas MUST poder exportarse a Excel con los filtros activos; en Seguimientos la observación va completa.
- **FR-041**: Los filtros, la pestaña y la página MUST quedar en la dirección de la página (para compartir o volver), salvo nombre y celular del cliente, que nunca van en la dirección.
- **FR-042**: En celular, Seguimientos MUST mostrar cada cliente como tarjeta (nombre, etapa, interés, intentos, última observación en dos líneas, próximo contacto); en escritorio, como tabla.
- **FR-043**: En celular, Actividad MUST mantener visible la columna de nombre al desplazar las columnas de números hacia el costado.
- **FR-044**: Cuando no hay resultados, MUST mostrarse un mensaje que diga por qué (según pestaña o filtro), no una tabla vacía.
- **FR-045**: Solo se consideran clientes vigentes: anulados y duplicados rechazados no aparecen ni cuentan.

### Key Entities

- **Cliente (prospecto)**: ya existe; se usan su etapa, interés, responsable, intentos, fecha de volver a contactar, visita pactada, motivo de pérdida, sucursal, canal y autor.
- **Contacto (gestión)**: ya existe; cada contacto con forma (llamada por WhatsApp, mensaje, en tienda), resultado, si fue efectivo, observación, quién lo hizo y cuándo. Es la base de la vista Actividad y de la "última observación".
- **Persona (usuario)**: ya existe; rol, sucursal, activo o inactivo.
- **Resumen de actividad**: no se guarda; se calcula de los contactos para cada persona y período (principio III: los reportes salen de los eventos).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un encargado identifica los clientes vencidos o abandonados de su sucursal en menos de 30 segundos desde que entra a Captaciones.
- **SC-002**: Un encargado responde "¿cuántas llamadas y ventas hizo cada persona hoy?" en menos de 15 segundos, sin abrir clientes uno por uno.
- **SC-003**: El 100% de los números de Actividad coinciden con los contactos registrados en el período (verificado contra el detalle al tocar cada número).
- **SC-004**: La suma de las pestañas de estado coincide siempre con "Todos", y los totales de Actividad con la suma de sus filas.
- **SC-005**: Ninguna persona ve clientes ni actividad fuera de su alcance de sucursales (0 fugas en pruebas por rol).
- **SC-006**: Cada vista muestra resultados en menos de 2 segundos en un celular de gama baja con 3G, con sucursales de varios miles de clientes.
- **SC-007**: El JS inicial de la app no crece (las vistas nuevas se cargan solo al entrar a ellas).

## Assumptions

- El Panel ya muestra una tabla resumida por persona (contactos, efectivos, visitas, ventas). Actividad la amplía con el desglose por forma y el detalle; el Panel no cambia.
- No hace falta guardar datos nuevos: todo sale de los clientes, contactos y eventos que ya se registran (FR-037 a FR-039 de la feature 001).
- "Seguimiento" y "Recaptación" van juntas en una pestaña, como pidió el usuario; la etapa exacta se ve en la columna Etapa.
- Se agrega la pestaña "Sin contactar" (etapa captación), que no estaba en el pedido, porque es lo primero que un encargado necesita vigilar.
- "Próximo contacto" es la fecha de volver a contactar o, si hay, la visita pactada, la que sea primero.
- "Efectivo" usa la misma definición que hoy aplica el registro de contactos (todo resultado distinto de "No contestó").
- Las llamadas telefónicas antiguas (forma que ya no se ofrece) se suman a "Llamadas".
- La búsqueda por nombre o celular sigue fuera de la dirección de la página (principio IV de la constitución).
- Sin dependencias nuevas; la exportación usa la misma de Captaciones.
- El jefe de ventas ya tiene definido en su perfil qué sucursales gestiona.
