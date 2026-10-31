# Feature Specification: MVP de captación de clientes

**Feature Branch**: `001-captacion-mvp`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "MVP de captación según docs/proyecto.md (borrador v2) y docs/insumos-2026-10-27.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar una captación en campo (Priority: P1)

Un volantero, auxiliar, supervisor o encargado entra con su usuario y ve una sola acción: **Registrar**.
Al empezar la jornada elige **una vez** el canal por el que está captando (por ejemplo, Activación). Toca Registrar,
escribe nombre y celular (lo único obligatorio; producto, interés, actividad y dirección son opcionales),
guarda y la pantalla vuelve a **Registrar**, lista para la siguiente persona. El canal de la jornada se aplica solo. No puede ver, editar ni eliminar
lo que registró; solo ve cuántas captaciones lleva hoy. Funciona igual con señal mala o sin señal.

**Why this priority**: Es el corazón de la app y la razón de existir: que cada dato de campo quede guardado,
atribuido a quien lo captó, sin depender de la señal.

**Independent Test**: Con un usuario de campo, registrar 10 captaciones (5 en modo avión) y verificar que, al
recuperar señal, las 10 aparecen en el sistema con la sucursal, el autor, la fecha y el turno correctos, y que el usuario de campo no puede abrirlas.

**Acceptance Scenarios**:

1. **Given** un usuario de campo con sesión iniciada, **When** completa los campos obligatorios y toca Guardar, **Then** ve la confirmación, el formulario vuelve vacío a Registrar y su contador del día sube en 1.
2. **Given** el celular sin señal, **When** guarda una captación, **Then** se confirma igual, queda marcada como "pendiente de subir" y se envía sola cuando vuelve la conexión, sin que el usuario haga nada.
3. **Given** un teléfono que ya existe en cualquiera de las 10 sucursales, **When** el usuario con señal intenta guardarlo, **Then** el sistema bloquea el registro con el aviso "teléfono ya registrado", sin mostrar los datos de la ficha existente.
4. **Given** una captación guardada sin señal cuyo teléfono ya existía, **When** se sincroniza, **Then** no se crea un prospecto duplicado, el registro queda como "duplicado rechazado" visible para el encargado, y el usuario de campo ve un aviso de que ese teléfono ya estaba registrado.
5. **Given** un usuario de campo, **When** intenta acceder a cualquier listado o ficha de captaciones (incluidas las suyas), **Then** el sistema lo impide.
6. **Given** falta un campo obligatorio o el teléfono es inválido, **When** toca Guardar, **Then** el sistema indica qué corregir y no guarda.

---

### User Story 2 - Gestionar captaciones desde el módulo completo (Priority: P1)

El encargado (de su sucursal), el gerente (de todas) y el administrador abren el módulo de gestión: ven el listado
de captaciones, buscan por nombre o teléfono, filtran por sucursal, fecha, autor, canal y etapa, abren una ficha,
la editan y también pueden registrar captaciones desde ahí. Solo el administrador puede anular (eliminar) una captación, con un motivo.

**Why this priority**: Sin esto los datos de campo no se pueden revisar ni corregir; es la contraparte necesaria del registro.

**Independent Test**: Con datos cargados, un encargado ve solo su sucursal, edita una ficha y queda el registro del cambio; un gerente ve todas; un encargado no puede anular; un administrador anula con motivo y la ficha sale de los listados normales pero se conserva.

**Acceptance Scenarios**:

1. **Given** un encargado de VERDOLAGO, **When** abre el listado, **Then** ve solo las captaciones de VERDOLAGO.
2. **Given** un gerente, **When** abre el listado, **Then** ve las captaciones de las 10 sucursales.
3. **Given** un encargado editando una ficha, **When** guarda, **Then** el cambio queda registrado con quién, cuándo y qué cambió.
4. **Given** un administrador, **When** anula una captación con un motivo, **Then** deja de aparecer en los listados y reportes normales y se conserva en el historial.
5. **Given** un encargado o gerente, **When** intenta anular, **Then** el sistema no lo permite.
6. **Given** una edición que deja un teléfono igual al de otra captación existente, **When** se guarda, **Then** el sistema la bloquea.

---

### User Story 3 - Seguimiento y avance por etapas (Priority: P2)

> **Definición del negocio (encargado de ventas, 2026-10-28):** por la mañana se volantea (captación); por la tarde se
> reparten los números a las auxiliares, que llaman, escriben o atienden en tienda (recaptación = volver a tener contacto).
> Seguimiento = se sabe qué busca, quiere visitar la tienda o hay que retomar en X días (p. ej. viajó). Cliente potencial = muy
> interesado, probable venta. Sin interés = no quiere nada o cortó la comunicación.
>
> **Insumo 2026-10-28:** la planilla en papel de llamadas (auxiliar Paula: cliente, teléfono, producto, resultado,
> ¿pasará?, fecha, hora, observación). Los clientes que se llaman son las **captaciones de los volanteros**; quien llama es
> **auxiliar**; **3 intentos** sin respuesta cierran el prospecto.

El encargado asigna cada prospecto de su sucursal a una persona responsable del seguimiento. Esa persona ve **solo
los prospectos que tiene asignados**, en una bandeja con los contactos pendientes para hoy y los vencidos. Registra cada gestión
(canal, resultado, observación, próxima acción y fecha) y mueve al prospecto por las etapas:
Captación → Seguimiento → Cliente interesado → Venta, o a Sin interés (con motivo).
Marcar **Venta** significa solo que compró.

**Why this priority**: Es lo que convierte datos en ventas y alimenta el reporte de gestiones; depende de que existan captaciones (US1/US2).

**Independent Test**: El encargado asigna un prospecto a un auxiliar; el auxiliar lo ve en su bandeja (y no ve los no asignados), registra 3 gestiones, lo pasa a Cliente interesado y luego a Venta; se verifica el historial completo y que la bandeja muestre los vencidos.

**Acceptance Scenarios**:

1. **Given** un prospecto asignado con próxima fecha de contacto vencida, **When** el responsable abre su bandeja, **Then** el prospecto aparece marcado como vencido.
2. **Given** un responsable de seguimiento, **When** abre su bandeja, **Then** ve solo los prospectos que tiene asignados, nunca los de otros ni los no asignados.
3. **Given** un encargado, **When** reasigna un prospecto a otra persona, **Then** el anterior responsable deja de verlo y el nuevo lo ve con todo su historial.
4. **Given** un prospecto, **When** se registra una gestión, **Then** queda en su historial con fecha, autor, canal, resultado y próxima acción.
5. **Given** un prospecto, **When** se cambia de etapa, **Then** el cambio queda como evento inmutable (quién, cuándo, de qué etapa a cuál, motivo si corresponde).
6. **Given** pasar a Sin interés, **When** no se elige un motivo, **Then** el sistema no permite el cambio.
7. **Given** un responsable de seguimiento, **When** intenta editar los datos de la captación (nombre, teléfono, etc.) o anularla, **Then** el sistema no lo permite.
8. **Given** un prospecto en Venta o Sin interés, **When** alguien intenta cambiarle la etapa, **Then** el sistema no lo permite en la v1 (la reactivación llega con la etapa Recaptación, en la v2).

---

### User Story 4 - Agenda diaria de actividades (Priority: P2)

El encargado arma la agenda de su sucursal por fecha y turno (mañana o tarde): cada actividad tiene hora de inicio y fin,
estrategia/área (marketing, mensajería, negociación, activación, llamadas, atención en tienda, contenido, en vivo, kardex, otra),
descripción, responsables, meta (cantidad y unidad, o texto) y lugares. Al cerrar la actividad se registra el resultado
alcanzado y su estado (pendiente, en curso, completada, bloqueada, cancelada).

**Why this priority**: Reemplaza la planilla de organización diaria y permite contrastar la meta contra el resultado; no bloquea el registro de captaciones.

**Independent Test**: Un encargado crea la agenda de mañana con 6 actividades, la copia para el día siguiente, cierra 2 con resultado y las ve en la exportación.

**Acceptance Scenarios**:

1. **Given** un encargado, **When** crea una actividad, **Then** queda asociada a su sucursal, fecha y turno.
2. **Given** una agenda existente, **When** el encargado la copia a otra fecha, **Then** se crean las mismas actividades en estado pendiente y sin resultados.
3. **Given** una actividad con meta numérica, **When** se registra el resultado, **Then** se muestra el cumplimiento (resultado ÷ meta).
4. **Given** un gerente, **When** consulta la agenda, **Then** puede ver la de cualquier sucursal.

---

### User Story 5 - Metas diarias y mensuales (Priority: P3)

> **Redefinida 2026-10-28 (encargado de ventas):** las metas del trabajo diario son **por día y por sucursal en cada etapa
> del embudo**. Ej.: los volanteros consiguen 50 captaciones; de esas 50 se necesitan hoy 20 clientes potenciales, y se
> recaptan las 50 para lograrlo. Hoy se usa en captación; probablemente se sumen ventas después.

El encargado (su sucursal), el gerente y Sistemas (todas) cargan una **meta base diaria** por sucursal para captaciones,
contactos de recaptación, clientes potenciales y ventas (cada una opcional), y **ajustan días puntuales** (feria, campaña).
El Panel muestra **"Metas de hoy"** con lo logrado contra la meta. Además, gerencia mantiene la **meta mensual de ventas por
línea** (CELULARES/ELECTROS) con avance, saldo y objetivo diario.

**Acceptance Scenarios**:

1. **Given** base de 50 captaciones y 20 potenciales, **When** se consulta hoy, **Then** la meta es 50/20 y lo logrado cuenta las captaciones registradas hoy y los pasos a cliente potencial de hoy.
2. **Given** un ajuste de 80 para hoy, **When** se consulta hoy, **Then** la meta es 80; mañana vuelve a 50.
3. **Given** una meta mensual de 230 celulares, **When** se marcan ventas de productos de la línea CELULARES, **Then** el avance, el saldo y el objetivo diario se recalculan.
4. **Given** un encargado, **When** intenta poner metas de otra sucursal, **Then** el sistema no lo permite.

### User Story 6 - Reporte en Excel (Priority: P2)

Encargados (su sucursal), gerentes y administradores exportan un Excel con la estructura del modelo `Unificado.xlsx`:
hojas de clientes captados, gestiones (seguimientos), agenda, y metas y avance, para un rango de fechas y sucursales. Ese Excel es el reporte oficial de la v1.

**Why this priority**: Es el único reporte de la v1; gerencia lo necesita apenas haya datos.

**Independent Test**: Exportar una semana de una sucursal y verificar que cada hoja tenga las columnas del modelo y que los totales coincidan con lo registrado.

**Acceptance Scenarios**:

1. **Given** un encargado, **When** exporta, **Then** el archivo contiene solo datos de su sucursal.
2. **Given** un rango de fechas, **When** se exporta, **Then** las captaciones, gestiones y actividades fuera del rango no aparecen.
3. **Given** captaciones anuladas, **When** se exporta, **Then** no aparecen.

---

### User Story 7 - Usuarios y accesos (Priority: P2)

El administrador da de alta usuarios con nombre, rol (volantero, auxiliar, supervisor, encargado, gerente, administrador) y sucursal, y los desactiva cuando dejan la empresa (los volanteros son temporales). Al desactivar, el usuario ya no puede entrar y todo lo que registró se conserva con su autoría.

**Why this priority**: Necesario para operar, pero en el arranque se puede cargar la primera tanda de usuarios a mano.

**Independent Test**: Crear un volantero, registrar con él, desactivarlo y verificar que no puede entrar y que sus captaciones siguen atribuidas a él.

**Acceptance Scenarios**:

1. **Given** un administrador, **When** crea un usuario de campo para TRINIDAD, **Then** ese usuario entra y solo ve el modo registro.
2. **Given** un usuario desactivado, **When** intenta entrar, **Then** se le niega el acceso, incluidas las sesiones abiertas en su celular.
3. **Given** un usuario desactivado con captaciones pendientes de subir en su celular, **When** el celular recupera señal, **Then** se aceptan las creadas antes de la desactivación y se rechazan las creadas después.

---

### Edge Cases

- Un usuario desactivado tiene captaciones guardadas sin señal que todavía no subieron: se aceptan si se crearon antes de la desactivación y se rechazan si se crearon después.
- Dos personas captan el mismo teléfono sin señal al mismo tiempo: al sincronizar gana la primera que llega al servidor; la segunda queda como "duplicado rechazado".
- El mismo teléfono escrito con espacios, guiones o prefijo de país (+591) cuenta como el mismo número.
- El celular se queda sin batería o se cierra la app con captaciones pendientes: siguen pendientes al reabrir y no se pierden.
- Un usuario cierra sesión con captaciones pendientes: el sistema avisa y no permite cerrar sesión hasta subirlas (o pide confirmar explícitamente que se descartan).
- Otro usuario inicia sesión en el mismo celular: nunca ve ni sube los pendientes del usuario anterior a nombre propio.
- Cambio de turno: el turno se asigna por la hora en que se registró, no por la hora en que se sincronizó.
- Un usuario de campo es trasladado de sucursal: las captaciones anteriores conservan la sucursal original.

## Requirements *(mandatory)*

### Functional Requirements

**Acceso y roles**
- **FR-001**: El sistema MUST exigir inicio de sesión para todo uso.
- **FR-002**: El sistema MUST soportar los roles volantero, auxiliar, supervisor, encargado, gerente y administrador, cada usuario con una sucursal (excepto gerente y administrador, que ven todas).
- **FR-003**: Volantero, auxiliar y supervisor MUST tener los mismos permisos de captación: solo crear captaciones y ver su conteo propio. Además, auxiliar, supervisor y encargado pueden ser responsables de seguimiento y ver los prospectos que tienen asignados (FR-035).
- **FR-004**: El encargado MUST poder usar el modo registro y el módulo de gestión, limitado a su sucursal.
- **FR-005**: El gerente MUST poder usar el módulo de gestión sobre todas las sucursales.
- **FR-006**: Solo el administrador (en la app: **Sistemas**) MUST poder anular captaciones (con motivo obligatorio) y gestionar usuarios y catálogos.
- **FR-007**: Los permisos MUST aplicarse en el servidor, de modo que un usuario no pueda obtener ni modificar datos fuera de su permiso aunque manipule la aplicación.

**Registro de campo**
- **FR-010**: El modo registro MUST tener un único flujo: Registrar → formulario → Guardar → volver a Registrar.
- **FR-011**: El formulario MUST pedir como obligatorios solo nombre completo y teléfono; producto de interés, nivel de interés, actividad u oficio y dirección o referencia son opcionales (cambio pedido por el usuario el 2026-10-28).
- **FR-011c**: El producto de interés MUST elegirse por grupo: **Celulares** (una sola opción, sin marca ni modelo), **Electro mayor** o **Electro menor** (en estos dos, luego la categoría, sin marcas ni modelos); además MUST existir un buscador general de categorías en los 3 grupos. El catálogo inicial sale de riber-bulma (`docs/catalogo-productos.md`).
- **FR-011b**: El canal MUST elegirse una vez por jornada en el dispositivo (se pide antes del primer registro del día, se puede cambiar en cualquier momento) y aplicarse solo a cada captación; el formulario no lo pregunta.
- **FR-012**: El sistema MUST completar solo la sucursal, quién registró, la fecha y hora de registro y el turno.
- **FR-013**: El sistema MUST permitir guardar sin conexión y enviar las captaciones pendientes automáticamente cuando haya conexión, sin duplicarlas por reintentos.
- **FR-014**: El usuario de campo MUST ver su conteo del día y la cantidad de captaciones pendientes de subir, nunca los datos de las captaciones.
- **FR-015**: El sistema MUST no conservar los datos de clientes en el dispositivo una vez confirmados por el servidor.
- **FR-016**: El sistema MUST bloquear captaciones con un teléfono ya registrado en cualquier sucursal, comparando el número normalizado.
- **FR-017**: Las captaciones rechazadas por duplicado al sincronizar MUST quedar visibles para el encargado de la sucursal como "duplicado rechazado", y el autor MUST recibir un aviso.

**Gestión**
- **FR-020**: El módulo de gestión MUST permitir listar, buscar (nombre, teléfono) y filtrar (sucursal, rango de fechas, autor, canal, etapa, nivel de interés) captaciones.
- **FR-021**: El módulo de gestión MUST permitir registrar y editar captaciones; cada edición MUST quedar auditada (quién, cuándo, valores anteriores y nuevos).
- **FR-022**: Las captaciones anuladas MUST excluirse de listados, conteos y exportaciones, y conservarse para auditoría.

**Seguimiento y etapas**
- **FR-030**: Cada prospecto MUST estar en una etapa: **1 Captación, 2 Recaptación, 3 Seguimiento, 4 Cliente potencial, 5 Venta, 6 Sin interés**. Venta y Sin interés son etapas finales en la v1. Las etapas positivas no retroceden por un resultado (p. ej. un Cliente potencial que "busca un producto" sigue siendo Cliente potencial).
- **FR-031**: Cada cambio de etapa MUST registrarse como evento inmutable con autor, fecha, etapa de origen y destino y motivo (obligatorio en Sin interés).
- **FR-032**: El sistema MUST permitir registrar gestiones (fecha, canal, resultado del contacto, contacto efectivo sí/no, observación, próxima acción, fecha de próximo contacto).
- **FR-033**: El sistema MUST ofrecer a cada responsable una bandeja con sus prospectos asignados de contacto pendiente para hoy y vencidos; encargado y gerente ven además la bandeja de toda su sucursal o de todas.
- **FR-035**: El encargado MUST poder asignar y reasignar cada prospecto de su sucursal a un responsable de seguimiento (auxiliar, supervisor o encargado activo de esa sucursal). El responsable MUST ver solo sus prospectos asignados, registrar gestiones y cambiar la etapa, sin poder editar los datos de la captación ni anularla.
- **FR-036**: Los prospectos sin responsable asignado MUST aparecer en una lista "sin asignar" para el encargado.
- **FR-037**: La bandeja del responsable (Mis contactos) MUST separar **No recaptados** (sin contactos) y **Recaptados** (subpestañas **Seguimiento**, con lo que se hizo, y **No contestó**, con sus strikes); en la misma tabla, marcar en verde lo resuelto hoy y en amarillo lo que toca contactar (llegó la fecha u hora de volver a llamar, o el cliente pasa hoy por la tienda); el celular se muestra solo como número y al tocarlo ofrece llamar o escribir por WhatsApp y registrar el contacto: **cómo** (llamada por WhatsApp, mensaje, en tienda; no se llama por teléfono), el **resultado** con botones y una observación opcional. Resultados: **No contestó**, **Busca un producto**, **Visitará la tienda**, **Volver a contactar el…**, **Muy interesado**, **Compró**, **No le interesa**, **Número equivocado**.
- **FR-038**: "Visitará la tienda" MUST exigir fecha y hora (aparece en **visitas pactadas**); "Volver a contactar el…" MUST exigir fecha (p. ej. viajó al monte) y el prospecto vuelve a la bandeja ese día; "Compró" MUST pedir el producto si el prospecto no lo tiene.
- **FR-039**: Etapa según el resultado: No contestó → Recaptación (suma un intento, vuelve mañana; al **tercero** → Sin interés "No contesta (3 intentos)"); Busca un producto, Visitará la tienda y Volver a contactar → Seguimiento; Muy interesado → Cliente potencial; Compró → Venta; No le interesa y Número equivocado → Sin interés. Todo contacto efectivo reinicia los intentos.
- **FR-039b**: El encargado MUST tener una pantalla **Repartir** (reparto de la tarde): ve cuántas captaciones del día (y opcionalmente de días anteriores) están sin asignar y de qué volantero vienen; ve a cada persona que puede recibir (auxiliares, supervisor, encargado) con sus pendientes; ajusta cuántas recibe cada una (por defecto partes iguales entre auxiliares, el resto a quien tiene menos pendientes) y confirma; el reparto se hace de una vez, intercalado por hora. Gerente y Sistemas eligen la sucursal.
- **FR-039c**: La app MUST ser una sola para todos los roles: barra lateral en escritorio y barra superior con menú en celular; cada rol ve solo sus secciones (Captaciones, Repartir, Mis contactos, Registrar, Usuarios).
- **FR-034**: Marcar Venta MUST registrar solo que el prospecto compró (sin unidades, monto ni comprobante). Si el prospecto no tiene producto de interés, MUST pedirse al marcar la Venta (la meta cuenta por línea, FR-052).

**Agenda**
- **FR-040**: El encargado MUST poder crear, editar y copiar a otra fecha la agenda de su sucursal por fecha y turno.
- **FR-041**: Cada actividad MUST tener hora de inicio y fin, estrategia/área, descripción, responsables, meta (cantidad + unidad, o texto), lugares, estado y resultado.

**Metas**
- **FR-050**: Encargado (su sucursal), gerente y Sistemas MUST poder cargar una meta base diaria por sucursal (captaciones, contactos, potenciales, ventas; cada una opcional) y ajustes por día; y metas mensuales de ventas por línea (CELULARES, ELECTROS).
- **FR-050b**: El Panel MUST mostrar "Metas de hoy" (logrado / meta y % por etapa con meta).
- **FR-051**: El sistema MUST calcular avance del mes, saldo y objetivo diario según saldo y días restantes.
- **FR-052**: Cada prospecto en Venta MUST contar como 1 unidad de la línea de su producto de interés, en la sucursal del prospecto y el mes de la venta; cada producto del catálogo MUST pertenecer a una línea.

**Exportación**
- **FR-060**: El sistema MUST exportar a Excel con la estructura del modelo `Unificado.xlsx` (clientes, gestiones, agenda, metas y avance) filtrado por rango de fechas y sucursal, respetando el alcance del rol.

**Usuarios**
- **FR-070**: El administrador MUST poder crear, editar y desactivar usuarios; un usuario desactivado MUST perder el acceso de inmediato, y sus registros MUST conservar su autoría.

### Key Entities

- **Sucursal**: una de las 10 sucursales; agrupa usuarios, prospectos, agenda y metas.
- **Usuario**: persona con rol, sucursal, tipo de contrato (temporal o con contrato) y estado (activo o inactivo).
- **Prospecto (captación)**: persona captada; nombre, teléfono (único en todo el sistema), producto de interés, línea, canal, nivel de interés (Alto, Medio, Bajo), actividad, dirección, sucursal, autor, fecha y hora, turno, etapa actual, responsable de seguimiento asignado, estado (vigente, anulada o duplicado rechazado).
- **Asignación**: qué responsable tiene cada prospecto, y su historial de reasignaciones.
- **Evento de etapa**: cambio de etapa de un prospecto; inmutable.
- **Gestión**: cada contacto de seguimiento con un prospecto.
- **Actividad de agenda**: tarea planificada de una sucursal en una fecha y turno, con meta y resultado.
- **Meta mensual**: cantidad objetivo por sucursal, línea y mes.
- **Catálogos**: canales de captación (Volantes, Activación, Visitas de negociación, TikTok, Facebook, Messenger, Marketplace, E-commerce, Otro; Llamadas es recaptación, no captación), productos de interés (grupo → categoría; Celulares es una sola; cada uno cuenta para la línea CELULARES o ELECTROS de las metas), motivos de sin interés, estrategias de la agenda.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario de campo registra una captación (nombre y celular) en menos de 30 segundos.
- **SC-002**: El 100% de las captaciones guardadas sin señal llegan al sistema, sin pérdidas ni duplicados, cuando el dispositivo recupera conexión.
- **SC-003**: Las captaciones pendientes se sincronizan dentro de los 2 minutos de recuperar conexión, con la app abierta.
- **SC-004**: La pantalla Registrar está lista para usar en menos de 3 segundos al abrir la app en un celular de gama baja con red 3G, y de inmediato sin red una vez instalada.
- **SC-005**: Ningún usuario de campo puede ver datos de captaciones (verificado en pruebas de permisos que intentan acceder directamente).
- **SC-006**: Con 90 usuarios registrando en simultáneo, el 95% de las captaciones se confirman en el servidor en ≤2 segundos.
- **SC-007**: Un encargado exporta el reporte semanal de su sucursal en menos de 1 minuto, y los totales coinciden al 100% con lo registrado.
- **SC-008**: Ningún teléfono queda duplicado entre prospectos vigentes.
- **SC-009**: En el primer mes de uso, el 90% de los usuarios de campo registra sin necesitar ayuda después de una capacitación de 15 minutos.

## Assumptions

- Prospectos: solo personas en la v1. Instituciones, convenios y venta grupal quedan para la v2.
- No se registra ubicación GPS ni fotos.
- **Recaptación queda fuera de la v1** hasta que ventas la defina. Se agrega en la v2 como etapa entre Captación y Seguimiento sin rehacer lo existente; en la v1 las etapas finales (Venta, Sin interés) no se reabren.
- Los volanteros (temporales) solo capturan; no son responsables de seguimiento.
- El canal y los productos del formulario salen de catálogos que mantiene el administrador; la lista inicial sale de `Unificado.xlsx` y se ajusta cuando llegue el Excel actual de captaciones.
- Ventas que no vienen de una captación (de tienda) no cuentan para el avance de la meta en esta app.
- Nivel de interés: Alto, Medio y Bajo (los valores "COMPRA" y "Perdido" del modelo se representan con las etapas Venta y Sin interés).
- Los números 50/100/200/80 de la nota manuscrita no se usan en la v1 hasta que se expliquen.
- Turno: mañana hasta las 13:00, tarde desde las 13:00 (ajustable por el administrador).
- Los usuarios usan celulares Android con navegador moderno; la señal es media o mala (4G/3G) y a veces no hay.
- 10 sucursales, 9 personas por sucursal, unos 90 usuarios, 2 turnos por día.
- Sin integración con riber-bulma en la v1: base de datos y despliegue propios; las metas se cargan acá.
- Los datos personales de prospectos se retienen mientras la empresa los necesite; las anulaciones no borran físicamente.
