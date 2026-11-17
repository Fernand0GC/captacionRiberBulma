# Feature Specification: Organización comercial por sucursal

**Feature Branch**: `003-organizacion-comercial`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Planilla del área de ventas «ORGANIZACION DISTRIBUCIÓN SUCURSALES RB.xlsx» (hoja Listas + 8 hojas de sucursal). Resumen del contenido en [insumos-excel.md](./insumos-excel.md)."

## Contexto

El área de ventas organiza hoy el trabajo diario de cada sucursal en una planilla Excel: una fila por asignación
(quién, en qué turno y horario, con qué estrategia, canal y subcanal, dónde, con qué meta y qué resultado tuvo).
La app ya tiene una **Planificación** diaria por sucursal (spec 001, historia US4) que cubre parte de esto:
fecha, sucursal, turno, hora de inicio y fin, canal, lugar, meta numérica y resultado. Esta feature **amplía esa
Planificación** hasta reemplazar la planilla Excel; no crea un módulo paralelo.

Lo que la Planificación actual no tiene y la planilla pide:

- Catálogo en tres niveles: Estrategia → Canal → Subcanal.
- Horario sugerido de mañana y de tarde para cada subcanal.
- Personal elegido de una lista de personas, no escrito como texto libre.
- Gerente a cargo de la sucursal visible en cada fila.
- Vista de tabla con filtros por cualquier columna y totales que cambian según el filtro.
- Exportación de la planilla a Excel.

## Clarifications

### Session 2026-11-17

- Q: ¿Con qué rol de la app entran los subgerentes? → A: Los subgerentes son los encargados de sucursal; no se crea un rol nuevo.
- Q: ¿Con qué rol de la app entran los 4 gerentes de la planilla? → A: Con el rol de jefe de ventas; cada uno ve y gestiona solo las sucursales que tiene a cargo.
- Q: ¿Las asignaciones nuevas reemplazan a las actividades actuales de la Planificación o conviven? → A: Las reemplazan; las actividades anteriores quedan visibles como historial y no se crean más.
- Q: ¿Se puede cambiar la meta de una asignación una vez que empieza su día? → A: El encargado la cambia hasta el día anterior; desde el día de la asignación solo el gerente a cargo, el gerente general o el administrador, y queda registrado.
- Q: ¿Qué ve el personal de campo de la organización de su sucursal? → A: El supervisor ve toda la sucursal, porque a veces reemplaza al encargado; el auxiliar ve solo sus propias asignaciones; la volantera no ve la organización, solo registra números.
- Q: Cuando el supervisor reemplaza al encargado, ¿puede cargar y corregir la organización? → A: Sí; el supervisor carga y corrige en su sucursal con los mismos permisos y límites que el encargado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cargar la organización del día con el catálogo de tres niveles (Priority: P1)

El encargado de una sucursal (o el gerente a cargo de ella) arma la organización de un día. Por cada asignación
elige el turno, la persona, la estrategia (Calle o Tienda), el canal y el subcanal, escribe la ubicación o lugar
y pone la meta. Al elegir la estrategia, la lista de canales muestra solo los de esa estrategia; al elegir el canal,
la lista de subcanales muestra solo los de ese canal. Al elegir subcanal y turno, la hora de inicio y la hora de fin
se llenan solas con el horario sugerido de ese subcanal, y se pueden cambiar.

**Why this priority**: Es el reemplazo directo de la planilla Excel. Sin esto, ventas sigue trabajando en Excel
y el resto de la feature no tiene datos sobre los que operar.

**Independent Test**: Con un encargado, cargar 5 asignaciones para mañana en su sucursal, usando al menos dos
estrategias y tres canales distintos, y comprobar que cada una queda guardada con su persona, turno, horario,
estrategia, canal, subcanal, lugar y meta, y que las listas nunca ofrecen una combinación que no existe en el catálogo.

**Acceptance Scenarios**:

1. **Given** un encargado en la organización de un día, **When** elige la estrategia Calle, **Then** la lista de canales muestra solo Negociación, Activación y Volantes.
2. **Given** una asignación con canal Llamadas, **When** abre la lista de subcanales, **Then** ve solo los subcanales de Llamadas.
3. **Given** una asignación con subcanal y turno elegidos, **When** el subcanal tiene horario sugerido para ese turno, **Then** la hora de inicio y la de fin se llenan con ese horario y el usuario puede cambiarlas antes de guardar.
4. **Given** un subcanal sin horario sugerido para el turno elegido, **When** se selecciona, **Then** las horas quedan vacías y el usuario las escribe.
5. **Given** una asignación guardada, **When** cualquier persona con acceso a esa sucursal abre la organización de ese día, **Then** ve la fila con el gerente a cargo de la sucursal, sin que nadie lo haya escrito.
6. **Given** un encargado, **When** intenta cargar una asignación en una sucursal que no es la suya, **Then** el sistema no se lo permite.
7. **Given** un auxiliar con dos asignaciones hoy, **When** abre la organización, **Then** ve solo esas dos y ninguna de sus compañeros.
8. **Given** un supervisor de campo, **When** abre la organización de su sucursal, **Then** ve todas las asignaciones y puede cargarlas y corregirlas igual que el encargado, y cada cambio queda registrado a su nombre.
9. **Given** una volantera, **When** entra a la app, **Then** no encuentra la organización en su menú ni puede abrirla por otra vía.
10. **Given** una asignación con canal elegido, **When** el usuario cambia la estrategia, **Then** el canal y el subcanal se vacían para que no quede una combinación inválida.

---

### User Story 2 - Registrar el resultado y las observaciones de cada asignación (Priority: P1)

Al terminar el turno, el encargado o el gerente registra en cada asignación el resultado alcanzado y, si hace falta,
una observación (por ejemplo, «5 ventas concretadas»). La fila muestra la meta al lado del resultado y el
cumplimiento.

**Why this priority**: La planilla existe para contrastar la meta contra el resultado. Una organización sin
resultado solo sirve como horario.

**Independent Test**: Sobre 3 asignaciones cargadas, registrar resultado en 2 y observación en 1, y comprobar que
las filas muestran meta, resultado y cumplimiento, y que la tercera sigue como pendiente.

**Acceptance Scenarios**:

1. **Given** una asignación con meta 30, **When** se registra resultado 15, **Then** la fila muestra 15 de 30 y 50 % de cumplimiento.
2. **Given** una asignación sin resultado, **When** se consulta la organización, **Then** la fila aparece como pendiente y no cuenta como resultado cero.
3. **Given** una asignación con resultado registrado, **When** el encargado lo corrige el mismo día, **Then** queda el valor nuevo y se sabe quién lo cambió y cuándo.
4. **Given** una observación de más de 300 caracteres, **When** se intenta guardar, **Then** el sistema avisa del límite y no pierde lo escrito.

---

### User Story 3 - Ver, filtrar y totalizar la organización (Priority: P2)

El gerente abre la organización como una tabla, elige un rango de fechas y una o varias de sus sucursales, y filtra
por cualquier columna: fecha, gerente, sucursal, turno, personal, estrategia, canal, subcanal. Arriba de la tabla ve
el total de meta, el total de resultado y el número de asignaciones, y esos totales cambian con cada filtro.

**Why this priority**: Es lo que hoy hacen los filtros y los subtotales del Excel, y es como gerencia compara
sucursales, canales y personas. Depende de que existan asignaciones cargadas (historias 1 y 2).

**Independent Test**: Con 20 asignaciones repartidas en 2 sucursales y 3 días, filtrar por una sucursal y un canal y
comprobar que los totales coinciden con la suma hecha a mano de las filas visibles.

**Acceptance Scenarios**:

1. **Given** asignaciones de varias sucursales, **When** el gerente filtra por canal Activación, **Then** la tabla muestra solo esas filas y los totales corresponden solo a ellas.
2. **Given** dos filtros activos, **When** quita uno, **Then** la tabla y los totales se actualizan con el filtro que queda.
3. **Given** un gerente a cargo de Trinidad y San Ignacio, **When** abre la tabla, **Then** puede ver las dos sucursales juntas y no ve las de otros gerentes.
4. **Given** el gerente general, **When** abre la tabla, **Then** puede ver todas las sucursales y filtrar por gerente.
5. **Given** un filtro que no deja ninguna fila, **When** se aplica, **Then** la tabla muestra un mensaje de «sin resultados» y los totales quedan en cero.

---

### User Story 4 - Mantener el catálogo y los horarios sin pedir un cambio al sistema (Priority: P2)

El administrador mantiene las estrategias, los canales y los subcanales, y el horario sugerido de mañana y de tarde
de cada subcanal. Puede agregar, renombrar, reordenar y desactivar. Ventas marcó su lista como provisional, así que
va a cambiar.

**Why this priority**: El catálogo inicial se carga una vez, pero ventas ya avisó que canales y subcanales son
provisionales. Sin esta pantalla, cada cambio obliga a pedirlo al equipo de sistemas.

**Independent Test**: Agregar un subcanal nuevo con su horario, comprobar que aparece al cargar una asignación,
desactivarlo y comprobar que ya no se ofrece pero las asignaciones viejas lo siguen mostrando.

**Acceptance Scenarios**:

1. **Given** el administrador, **When** agrega un subcanal a un canal con su horario de mañana y de tarde, **Then** el subcanal aparece en la lista al cargar una asignación con ese canal.
2. **Given** un subcanal usado en asignaciones pasadas, **When** se desactiva, **Then** deja de ofrecerse para asignaciones nuevas y las pasadas lo siguen mostrando con su nombre.
3. **Given** un subcanal, **When** el administrador cambia su horario sugerido, **Then** las asignaciones nuevas usan el horario nuevo y las ya guardadas conservan el suyo.
4. **Given** un nombre de subcanal que ya existe en el mismo canal, **When** se intenta agregar otro igual, **Then** el sistema lo rechaza con un mensaje claro.
5. **Given** un usuario que no es administrador, **When** intenta cambiar el catálogo, **Then** el sistema no se lo permite.

---

### User Story 5 - Exportar la organización a Excel (Priority: P3)

El gerente o el encargado exporta lo que está viendo en la tabla (con sus filtros) a un archivo Excel con las mismas
columnas y el mismo orden que la planilla de ventas.

**Why this priority**: Permite seguir compartiendo la información como hasta ahora mientras el equipo se acostumbra
a la app. No bloquea el trabajo diario.

**Independent Test**: Filtrar una sucursal y una semana, exportar, y comprobar que el archivo tiene las mismas filas
que la tabla y las 14 columnas de la planilla en su orden.

**Acceptance Scenarios**:

1. **Given** una tabla filtrada con 12 filas, **When** se exporta, **Then** el archivo tiene esas 12 filas y las columnas Fecha, Gerente, Sucursal, Turno, Hora inicio, Hora fin, Personal, Estrategia, Canal, Subcanal, Ubicación/Lugar, Meta, Resultado y Observaciones.
2. **Given** una tabla sin filas, **When** se intenta exportar, **Then** el sistema avisa que no hay datos y no genera un archivo vacío.

---

### Edge Cases

- La misma persona queda asignada dos veces en el mismo turno con horarios que se cruzan: el sistema avisa del cruce, pero deja guardar (una persona puede cubrir dos tareas cortas seguidas, como en el ejemplo de Verdolago).
- La hora de fin es anterior o igual a la de inicio: no se puede guardar.
- La meta o el resultado no son números: no se pueden guardar (la planilla marcaba en rojo el texto en esas columnas).
- Una sucursal no tiene gerente asignado: la fila se guarda y la columna Gerente queda vacía.
- Cambia el gerente a cargo de una sucursal: las asignaciones pasadas conservan el gerente que tenían ese día.
- Una persona deja de estar activa: no se ofrece para asignaciones nuevas, pero sigue apareciendo en las pasadas.
- Se copia la organización de un día a otro: se copian las asignaciones sin resultado ni observaciones.
- Un subcanal no tiene horario en ningún turno (por ejemplo, Volantes fechas festivas): se puede elegir y las horas se escriben a mano.
- Asignación de hoy o de una fecha pasada: el encargado registra resultado y observación, pero no cambia la meta ni el resto; eso lo hace el gerente a cargo (FR-029).
- El encargado necesita agregar una asignación el mismo día (por ejemplo, alguien cubre una ausencia): puede crearla, y a partir de ahí su meta queda sujeta a FR-029.

## Requirements *(mandatory)*

### Functional Requirements

**Catálogo**

- **FR-001**: El sistema MUST mantener un catálogo de tres niveles donde cada canal pertenece a una sola estrategia y cada subcanal a un solo canal.
- **FR-002**: El sistema MUST iniciar con el catálogo de la hoja Listas de la planilla: 2 estrategias, 10 canales y 34 subcanales, detallados en [insumos-excel.md](./insumos-excel.md).
- **FR-003**: Cada subcanal MUST poder tener un horario sugerido de mañana (inicio y fin) y uno de tarde (inicio y fin); cualquiera de los dos puede estar vacío.
- **FR-004**: El administrador MUST poder agregar, renombrar, reordenar y desactivar estrategias, canales y subcanales, y editar los horarios sugeridos.
- **FR-005**: Un elemento desactivado MUST dejar de ofrecerse en asignaciones nuevas y seguir mostrándose en las existentes.
- **FR-006**: El catálogo de esta feature MUST ser independiente del catálogo de canales con el que hoy se registran las captaciones; el registro de captaciones y sus reportes MUST seguir funcionando sin cambios.

**Asignaciones**

- **FR-007**: Quien gestiona una sucursal MUST poder crear, editar y eliminar asignaciones de esa sucursal para una fecha.
- **FR-008**: Cada asignación MUST registrar: fecha, sucursal, turno, hora de inicio, hora de fin, persona, estrategia, canal, subcanal, ubicación o lugar, meta, resultado y observaciones.
- **FR-009**: Para guardar una asignación MUST ser obligatorios: fecha, sucursal, turno, persona, estrategia y canal. El resto es opcional.
- **FR-010**: El sistema MUST ofrecer solo los canales de la estrategia elegida y solo los subcanales del canal elegido, y MUST rechazar combinaciones que no existan en el catálogo.
- **FR-011**: Al elegir subcanal y turno, el sistema MUST proponer la hora de inicio y la de fin del horario sugerido, y el usuario MUST poder cambiarlas.
- **FR-012**: La persona de una asignación MUST elegirse de la lista de usuarios activos de la app que pertenecen a esa sucursal; no se puede escribir un nombre a mano.
- **FR-013**: El sistema MUST mostrar en cada asignación el gerente a cargo de la sucursal, tomado de la relación gerente–sucursal y no escrito a mano.
- **FR-014**: La meta y el resultado MUST ser números enteros de 0 a 9999 que se escriben a mano. La meta la ingresan los gerentes y los encargados de sucursal (a quienes ventas llama también subgerentes); el resultado lo ingresan las mismas personas. El sistema no calcula ninguno de los dos.
- **FR-029**: El encargado y el supervisor de campo MUST poder cambiar la meta, la persona, el horario y el catálogo de una asignación solo hasta el día anterior a su fecha. Desde la fecha de la asignación, esos cambios MUST quedar reservados al gerente a cargo, al gerente general y al administrador. El resultado y las observaciones no tienen esa restricción (FR-018).
- **FR-015**: El sistema MUST avisar cuando una persona tiene dos asignaciones con horarios que se cruzan el mismo día, sin impedir que se guarden.
- **FR-016**: El sistema MUST permitir copiar la organización de un día a otro de la misma sucursal, sin resultados ni observaciones.
- **FR-017**: La Planificación MUST trabajar solo con asignaciones. Las actividades cargadas antes del cambio MUST seguir visibles como historial, de solo lectura, y no MUST poder crearse actividades nuevas del formato anterior.

**Resultados**

- **FR-018**: Quien gestiona una sucursal MUST poder registrar y corregir el resultado y las observaciones de cada asignación.
- **FR-019**: El sistema MUST mostrar el cumplimiento (resultado ÷ meta) cuando la asignación tiene meta y resultado, y MUST distinguir «sin resultado» de «resultado cero».
- **FR-020**: Cada creación, edición y eliminación de una asignación MUST dejar registrado quién la hizo y cuándo.

**Consulta, filtros y exportación**

- **FR-021**: El sistema MUST mostrar las asignaciones en una tabla con las 14 columnas de la planilla, para un rango de fechas y una o varias sucursales.
- **FR-022**: Los usuarios MUST poder filtrar la tabla por fecha, gerente, sucursal, turno, persona, estrategia, canal y subcanal, y combinar varios filtros.
- **FR-023**: El sistema MUST mostrar el total de meta, el total de resultado y el número de asignaciones de las filas visibles, y actualizarlos con cada filtro.
- **FR-024**: Los usuarios MUST poder exportar a Excel las filas visibles, con las columnas y el orden de la planilla.

**Permisos**

- **FR-025**: El encargado y el supervisor de campo (que lo reemplaza cuando hace falta) MUST ver y gestionar solo su sucursal; el gerente a cargo de varias sucursales, solo las suyas; el gerente general y el administrador, todas.
- **FR-026**: El auxiliar MUST ver solo sus propias asignaciones (turno, horario, estrategia, canal, subcanal, lugar y meta). La volantera MUST NOT tener acceso a la organización.
- **FR-027**: Solo el administrador MUST poder cambiar el catálogo, los horarios sugeridos y la relación gerente–sucursal.
- **FR-028**: Los permisos MUST aplicarse en el servidor en cada operación, no solo en la pantalla.

### Key Entities *(include if feature involves data)*

- **Estrategia**: Primer nivel del catálogo (Calle, Tienda). Tiene nombre, orden y estado activo.
- **Canal**: Segundo nivel. Pertenece a una estrategia. Tiene nombre, orden y estado activo.
- **Subcanal**: Tercer nivel. Pertenece a un canal. Tiene nombre, orden, estado activo y dos horarios sugeridos opcionales (mañana y tarde), cada uno con inicio y fin.
- **Asignación**: Una fila de la organización. Une una fecha, una sucursal, un turno y una persona con una estrategia, un canal y un subcanal; lleva horario, lugar, meta, resultado y observaciones, y guarda el gerente a cargo de la sucursal en esa fecha.
- **Persona**: Integrante del personal de una sucursal que puede recibir asignaciones.
- **Gerente a cargo**: Persona responsable de una o varias sucursales. Cada sucursal tiene a lo sumo un gerente a cargo en una fecha.
- **Sucursal**: Las 10 existentes. Trinidad con San Ignacio, y Rurrenabaque con Reyes, se trabajan juntas porque comparten gerente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un encargado carga la organización de un día con 10 asignaciones en menos de 5 minutos.
- **SC-002**: El 100 % de las asignaciones guardadas tiene una combinación de estrategia, canal y subcanal que existe en el catálogo.
- **SC-003**: En al menos el 90 % de las asignaciones con subcanal, el usuario no necesita escribir las horas porque el horario sugerido le sirve.
- **SC-004**: Un gerente obtiene el total de meta y de resultado de sus sucursales para una semana, filtrado por canal, en menos de 30 segundos.
- **SC-005**: Los totales de la tabla coinciden con la suma manual de las filas visibles en el 100 % de los casos probados.
- **SC-006**: A las 4 semanas de salir a producción, las 10 sucursales cargan su organización diaria en la app y ventas deja de actualizar la planilla Excel.
- **SC-007**: Un cambio de catálogo pedido por ventas (un subcanal nuevo o un horario distinto) queda disponible para las sucursales el mismo día, sin intervención del equipo de sistemas.

## Assumptions

- La feature amplía la Planificación existente (spec 001, US4); no se crea una pantalla separada con datos duplicados.
- Confirmado: el «Gerente» de la planilla corresponde al rol existente de jefe de ventas con varias sucursales. Los 4 gerentes y sus sucursales se cargan como datos, según el detalle de [insumos-excel.md](./insumos-excel.md).
- Una asignación tiene una sola persona, igual que una fila de la planilla. Si varias personas hacen lo mismo, se carga una fila por persona.
- Los horarios por subcanal son sugerencias que se pueden cambiar en cada asignación, no restricciones.
- Decidido el 2026-11-17: meta y resultado se ingresan a mano; el catálogo nuevo queda separado del de captaciones por ahora; el personal son usuarios de la app.
- Como los catálogos quedan separados, el resultado no se cuenta desde las captaciones. Unificarlos queda para una feature posterior.
- Aceptado por el usuario el 2026-11-17: para lo que se planifique desde ahora se pierden el conteo automático de captaciones por actividad, el cierre automático por meta y el aviso de actividad en curso en la pantalla Registrar. Siguen en el historial; se recuperan en la feature que unifique los catálogos.
- La unidad de Meta y Resultado (ventas, captaciones u otra) no está definida por ventas; el sistema guarda el número sin unidad.
- «Subgerente» es otro nombre del encargado de sucursal; no es un rol aparte.
- El supervisor tiene siempre los permisos del encargado sobre la organización de su sucursal; el sistema no registra cuándo está reemplazándolo. El control es el registro de quién hizo cada cambio (FR-020).
- «Quien gestiona una sucursal» significa: su encargado, su supervisor de campo, el gerente a cargo, el gerente general y el administrador.
- Hoy todos los roles ven la Planificación de su sucursal; con este cambio el auxiliar pasa a ver solo lo suyo y la volantera deja de verla.
- Las personas de la planilla que todavía no tienen usuario se dan de alta antes de salir a producción.
- La lista «Estrategia / área» de la Planificación actual (Mensajería, Marketing, Kardex de ventas y otras) deja de usarse y se conserva solo en el historial. Las tareas que no son de captación (por ejemplo, Kardex de ventas o Distribuir tareas) dejan de planificarse en la app, salvo que ventas las agregue al catálogo.
- Los turnos son los dos existentes: mañana y tarde.
- «Santa Cruz Hipermaxi» de la planilla es la sucursal Santa Cruz que ya existe; solo cambia el nombre que se muestra.
- La carga y la consulta de la organización se hacen con conexión. El trabajo sin señal sigue siendo solo para el registro de captaciones en campo.
- La planilla dice que canales y subcanales son provisionales; se carga la lista actual y los cambios posteriores se hacen desde la pantalla de catálogo (historia 4).
- Fuera de alcance: metas mensuales y diarias por sucursal (ya existen), reparto de captaciones entre auxiliares (ya existe), control de asistencia y cálculo de comisiones.
- Dependencia: las funciones de monitoreo del último cambio en `main` no están en el repositorio. No bloquean esta feature, pero conviene resolverlo antes de salir a producción.
