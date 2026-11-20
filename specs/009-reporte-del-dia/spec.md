# Feature Specification: Reporte del día (registros nuevos y clientes con seguimiento)

**Feature Branch**: `009-reporte-del-dia`

**Created**: 2026-11-19

**Status**: Implementada en local (2026-11-19); pendiente de publicar

**Input**: Pedido de gerencia (2026-11-19), puntos de la APP CAPTACIÓN: «1. Que se pueda generar a) Promedio y/o
cantidad de Nuevos Registros Ingresados del día. b) Cantidad de clientes a los cuales se les ha realizado seguimiento
durante el día. 3. Que se puedan registrar a la APP CAPTACIÓN los datos de la estrategia REFERENCIADOS y que se pueda
generar a) Cantidad y Lista de Nuevos Registros Ingresados del día. b) Cantidad y lista de clientes a los cuales se
les ha realizado seguimiento durante el día.» El punto 2 (web Riber Bulma) queda fuera de esta spec.
Maqueta aprobada para avanzar: https://claude.ai/artifact/1WieXaii28hoXYdbHzZcR4

## Contexto

- Ya existe: el Panel cuenta «Captaciones» del período (registros nuevos) y «Contactos» (cada llamada o mensaje, no
  clientes); Captaciones lista los registros por fecha; Actividad cuenta contactos por persona; los referidos se
  registran con su referidor desde la 005.
- Falta: el promedio de registros; la cantidad y la lista de **clientes distintos** con seguimiento en un día; las dos
  listas del día filtradas por referidos.

## Clarifications

### Session 2026-11-19

Decididas por recomendación (**por confirmar con gerencia**):

- Q: «Promedio» → A: Dos números: por persona (registros nuevos ÷ personas que registraron ese día) y por día (registros de los últimos 7 días, terminando en el día elegido, ÷ 7).
- Q: ¿Qué es «seguimiento»? → A: Un contacto registrado (llamada, mensaje o atención en tienda), con cualquier resultado, también «no contestó». Se cuentan **clientes distintos**; los efectivos se muestran aparte.
- Q: ¿Qué es «Referenciados»? → A: Los **referidos** de la 005 (clientes con referidor). Se registran como hoy; el reporte filtra «Solo referidos» y, con una sucursal elegida, por referidor.
- Q: ¿En qué fecha cae un registro? → A: La de registro en el celular (`client_created_at`), en hora de Bolivia; un registro sin conexión que se sincroniza tarde cuenta en su día (el número de hoy puede subir).
- Q: ¿Recapturas y duplicados? → A: Una recaptura es un seguimiento de una ficha existente (no es registro nuevo). Los duplicados rechazados y los anulados no cuentan.
- Q: ¿Dónde se ve? → A: Vista nueva «Del día» en Captaciones (/gestion) y una tarjeta «Clientes con seguimiento» en el Panel.
- Q: ¿Quién lo ve? → A: Los mismos que ven Seguimientos y Actividad (encargado, jefe de ventas, gerencia, Sistemas), con el mismo alcance por sucursal.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Números del día (Priority: P1)

Quien gestiona elige un día y una sucursal y ve: registros nuevos, promedio por persona, promedio por día de la
semana, clientes con seguimiento y cuántos de ellos fueron efectivos.

**Independent Test**: Con 3 registros de 2 personas y un cliente llamado 3 veces en el día, ver «3», «1,5 por persona» y «1 cliente con seguimiento (3 contactos)».

**Acceptance Scenarios**:

1. **Given** registros del día de 2 personas, **When** se abre «Del día», **Then** muestra la cantidad y el promedio por persona.
2. **Given** un cliente con 3 contactos ese día, **When** se cuenta, **Then** suma 1 cliente con seguimiento y 3 contactos.
3. **Given** un cliente registrado otro día y contactado hoy, **When** se mira hoy, **Then** cuenta como seguimiento y no como registro nuevo.
4. **Given** un contacto a las 23:30 de Bolivia, **When** se mira ese día, **Then** cuenta en ese día (no en el siguiente).
5. **Given** una persona sin acceso a una sucursal, **When** pide otra, **Then** la base no le da datos de otra sucursal.

### User Story 2 - Listas del día (Priority: P1)

Debajo de los números, dos pestañas con la lista de registros nuevos y la de clientes con seguimiento; cada fila abre
la ficha del cliente; se exporta a Excel.

**Independent Test**: La pestaña «Clientes con seguimiento» tiene tantas filas como dice el número de arriba, cada una con sus contactos del día, el último resultado y quién lo contactó.

**Acceptance Scenarios**:

1. **Given** el día, **When** se abre la pestaña de registros, **Then** cada fila muestra hora, cliente, celular, canal o referidor, quién registró, responsable y etapa.
2. **Given** la pestaña de seguimiento, **When** se abre, **Then** cada fila muestra el último contacto (hora y forma), contactos del día, último resultado (efectivo o no), quién contactó y cuándo se registró el cliente.
3. **Given** cualquier filtro, **When** se compara, **Then** el número de arriba es igual a la cantidad de filas de su lista.
4. **Given** «Exportar Excel», **When** se toca, **Then** descarga los números y las dos listas.

### User Story 3 - Referidos (Priority: P1)

El mismo reporte filtrado por clientes referidos y, con una sucursal elegida, por referidor.

**Independent Test**: Elegir «Solo referidos» y ver solo clientes con referidor en números y listas.

**Acceptance Scenarios**:

1. **Given** «Solo referidos», **When** se aplica, **Then** números y listas cuentan solo clientes con referidor.
2. **Given** una sucursal y un referidor, **When** se elige, **Then** solo cuenta los de ese referidor.
3. **Given** «Todas las sucursales», **When** se elige «Solo referidos», **Then** no se ofrece elegir referidor (son de cada sucursal).

### User Story 4 - Tarjeta en el Panel (Priority: P2)

El Panel suma «Clientes con seguimiento» (clientes distintos) al lado de «Contactos», para el período elegido.

**Acceptance Scenarios**:

1. **Given** un cliente con 3 contactos en el período, **When** se mira el Panel, **Then** «Contactos» suma 3 y «Clientes con seguimiento» suma 1.

### Edge Cases

- Día sin registros: los promedios muestran «—» (no 0 ÷ 0).
- Día futuro: no se puede elegir.
- Referidor dado de baja: sus clientes siguen contando y se puede elegir en el filtro mientras tenga datos (se lista con «(baja)»).
- Listas muy largas (todas las sucursales): hasta 2000 filas por lista; si hay más, se avisa y se sugiere elegir sucursal.

## Requirements *(mandatory)*

- **FR-001**: El sistema MUST calcular, para un día (hora de Bolivia) y un alcance de sucursal: registros nuevos, personas que registraron, registros de los 7 días que terminan ese día, clientes distintos con seguimiento, clientes con algún contacto efectivo y contactos totales.
- **FR-002**: El sistema MUST devolver, con los números, la lista de registros nuevos y la lista de clientes con seguimiento, calculadas con la misma regla.
- **FR-003**: Solo cuentan clientes activos (no anulados ni duplicados rechazados).
- **FR-004**: El filtro de origen MUST permitir «Todos» y «Solo referidos», y por referidor cuando hay una sucursal elegida.
- **FR-005**: El acceso MUST ser el de Seguimientos y Actividad, aplicado en la base.
- **FR-006**: La vista «Del día» MUST tener navegación por día (sin días futuros), sucursal (si la persona puede elegir), origen, dos pestañas y exportación a Excel; cada fila abre la ficha.
- **FR-007**: El Panel MUST mostrar «Clientes con seguimiento» del período junto a «Contactos».
- **FR-008**: La pantalla MUST aclarar cómo se calcula cada número y que el día puede crecer con registros sin conexión.

## Success Criteria *(mandatory)*

- **SC-001**: Gerencia obtiene los números y las listas de un día y una sucursal en menos de 10 segundos, sin Excel a mano.
- **SC-002**: En el 100 % de las pruebas, el número de cada tarjeta coincide con las filas de su lista.
- **SC-003**: Un cliente contactado varias veces en el día cuenta una sola vez en «Clientes con seguimiento».

## Assumptions

- Se usan datos que ya existen (registros, contactos y referidores); no hay tablas nuevas.
- Fuera de alcance: web Riber Bulma (punto 2 del pedido) y nuevos datos para «Referenciados» si gerencia aclara que no son los referidos de la 005.
