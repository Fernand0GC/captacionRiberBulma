# Feature Specification: Seguimiento de referidos por origen

**Feature Branch**: `005-referidos`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Planilla de Isa Vega (sucursal Guayaramerín) con el seguimiento de sus contactos referidos: filas por origen (Colegas, App, Contacto Fernanda, Contacto René, Dicky, María, Freelance Walker, Freelance Tamara, Freelance otros, Recompra, Nuevos) con meta mensual, y debajo los contactos referidos con nombre, celular y producto de interés, coloreados según quién los refirió (por ejemplo, verde = contactos de Fernanda, rojo = de freelancers). Una columna por día marca cuándo un contacto compró. De todos los referidos, casi ninguno terminó en venta. Los referidores no reciben nada a cambio."

## Contexto

Isa lleva en Excel un **mini seguimiento de referidos**: anota cada contacto que le pasan, marca con color de quién
vino y pone un 1 el día que compra. La planilla tiene metas mensuales por origen, pero no tiene totales ni cumplimiento,
y las fechas se cargan a mano (en la captura hay años mal arrastrados: 2027, 2028…). Lo que muestra es que **de muchos
referidos, solo uno o pocos compran**, y eso no se ve en ningún lado de la app.

La app ya tiene casi todo lo que Isa hace a mano: cada contacto es una captación con nombre, celular, producto,
responsable, seguimientos y etapa hasta la venta (spec 001). **Lo que falta es saber de quién vino el contacto.**
Gerencia desactivó el 2026-11-03 los canales «Referencia del personal» y «Referencia de clientes» al dejar la lista
definitiva de canales, así que hoy no hay forma de registrarlo, salvo el texto libre «descripción del canal», que no se
puede sumar.

Por el principio III de la constitución, el resultado no se anota a mano: se **calcula** de las captaciones y de sus
cambios de etapa.

## Clarifications

### Session 2026-11-18

- Q: ¿La planilla es de captación o de seguimiento? → A: De seguimiento de contactos referidos; muestra que de todos los referidos casi ninguno terminó en venta.
- Q: ¿Qué significan los colores? → A: Agrupan los contactos según quién los refirió (verde, contactos de Fernanda; rojo, de freelancers; etc.), para que Isa lleve una lista por origen.
- Q: ¿Los referidores reciben algo a cambio? → A: No. No se registran pagos ni premios.
- Q: ¿Qué cuenta la meta mensual de cada origen? → A: Contactos referidos que llegan en el mes. La venta se mide como conversión, sin meta propia.
- Q: ¿Qué son «Recompra» y «Nuevos»? → A: Tipo de cliente: Recompra = ya compró antes; Nuevos = primera compra. **Se deja para una próxima spec (006)** junto con contar los referidos que el sistema rechaza por celular repetido (decisión del usuario, 2026-11-18). La 005 empieza con lo que pidió Isa: origen, metas de contactos y reporte.
- Q: ¿Quién marca de quién vino el contacto? → A: Quien registra la captación; la encargada o el responsable lo pueden corregir.
- Q: ¿Quién puede ver el reporte de referidos? → A: Solo los jefes, por permiso: el jefe de ventas ve las sucursales que tiene a cargo; gerencia y administración, todas. El encargado y el personal de campo no lo ven.
- Q: ¿Qué quiere ver Isa en el reporte? → A: Todo: llegados, compraron y porcentaje; meta y cumplimiento; la lista de contactos por origen; y el avance por día.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar de quién viene un contacto (Priority: P1)

Al registrar una captación, quien la carga indica que es un referido y elige de quién vino (por ejemplo, «Contacto
Fernanda» o «Freelance Walker») de la lista de su sucursal.

**Why this priority**: Sin este dato no se puede medir nada de lo demás. Es lo único que la app no guarda hoy.

**Independent Test**: Registrar a «Yesenia Fernández» como referida por «Contacto Fernanda» y verla en su ficha con ese origen.

**Acceptance Scenarios**:

1. **Given** una captación nueva, **When** quien la registra marca «Es referido», **Then** debe elegir el origen de una lista de referidores activos de la sucursal.
2. **Given** una captación que no es referida, **When** se guarda, **Then** queda sin origen, como hoy.
3. **Given** una captación ya registrada, **When** el encargado o el jefe de ventas corrige el origen, **Then** el cambio queda registrado con quién y cuándo.
4. **Given** el registro sin señal en campo, **When** se elige el origen, **Then** se guarda en el dispositivo y se sincroniza después, como el resto de la captación (principio I).

---

### User Story 2 - Ver cuántos referidos compran, por origen (Priority: P1)

Isa abre un reporte de referidos del mes y ve, por cada origen: cuántos contactos llegaron, cuántos están en
seguimiento, cuántos compraron, la meta mensual y el cumplimiento. Puede abrir un origen y ver la lista de sus contactos
con su etapa.

**Why this priority**: Es la pregunta que Isa quiere responder con su Excel (de todos los referidos, ¿cuántos compran y
de quién vienen?) y hoy no tiene respuesta.

**Independent Test**: Con 10 referidos de «Contacto Fernanda» y 1 vendido, el reporte muestra 10 llegados, 1 venta,
10 % de conversión y el avance contra su meta, sin que nadie escriba esos números.

**Acceptance Scenarios**:

1. **Given** referidos registrados en el mes, **When** se abre el reporte, **Then** se ve una fila por origen con llegados, en seguimiento, ventas, sin interés, meta mensual y cumplimiento.
2. **Given** un origen, **When** se abre, **Then** se ve la lista de sus contactos con nombre, producto, responsable, etapa y fecha de venta si la hubo.
3. **Given** un contacto referido que pasa a venta, **When** se registra la venta, **Then** el reporte la cuenta ese día sin carga adicional.
4. **Given** el reporte, **When** se elige otra sucursal o mes (según permisos), **Then** los números se recalculan.
5. **Given** el reporte, **When** se exporta, **Then** se obtiene un Excel con las mismas filas y columnas.

---

### User Story 3 - Mantener la lista de referidores y sus metas (Priority: P2)

La jefa de ventas agrega, renombra o desactiva referidores de sus sucursales (Colegas, App, Contacto Fernanda, Freelance
Walker…), los agrupa por tipo y les pone una meta mensual.

**Why this priority**: La lista cambia (entran y salen freelancers, se suman contactos del personal) y no puede depender de sistemas.

**Independent Test**: Agregar «Freelance Tamara» con meta 5 en el mes, registrar un referido suyo y verlo en el reporte.

**Acceptance Scenarios**:

1. **Given** la pantalla de referidores, **When** la jefa de ventas agrega uno con nombre, tipo y meta mensual, **Then** aparece al registrar captaciones de su sucursal.
2. **Given** un referidor con contactos, **When** se desactiva, **Then** deja de ofrecerse al registrar y sus contactos siguen en el reporte.
3. **Given** un mes nuevo, **When** no se cambió la meta, **Then** se usa la del mes anterior.

---

### Edge Cases

- Un contacto llega referido por dos personas: se guarda un solo origen, el primero; el otro se anota en observaciones.
- Un contacto referido ya existe en la app (mismo celular): la regla de duplicados de la spec 001 no cambia y ese registro no cuenta en el reporte (queda para la spec 006).
- Un referidor se renombra: el reporte muestra el nombre nuevo para todo su historial.
- Un mes sin meta para un origen: se muestran los números sin cumplimiento.
- Una captación anulada (por Sistemas) deja de contar en el reporte.

## Requirements *(mandatory)*

### Registro

- **FR-001**: Al registrar una captación, quien la registra MUST poder marcarla como referida y elegir su origen de la lista de referidores activos de la sucursal. Quienes hoy pueden editar los datos del contacto (encargado, jefe de ventas y gerencia) MUST poder corregirlo después.
- **FR-002**: El origen MUST ser opcional para captaciones no referidas y obligatorio cuando se marca «Es referido».
- **FR-003**: Cambiar el origen de una captación MUST quedar registrado con quién, cuándo, el valor anterior y el nuevo.
- **FR-004**: El origen MUST funcionar sin conexión en el registro de campo, igual que el resto de la captación.

### Referidores

- **FR-005**: Cada sucursal MUST tener su propia lista de referidores, con nombre, tipo (personal, freelance, cliente, canal u otro), orden y estado activo.
- **FR-006**: Solo el jefe de ventas a cargo, el gerente general y el administrador MUST poder agregar, renombrar, ordenar y desactivar referidores de las sucursales que gestionan.
- **FR-007**: Cada referidor MUST poder tener una meta mensual de **contactos referidos que llegan**. Si un mes no tiene meta cargada, MUST usarse la del mes anterior.
- **FR-008**: Un referidor desactivado MUST dejar de ofrecerse y conservar su historial.

### Reporte

- **FR-009**: El sistema MUST mostrar, por sucursal y mes, una fila por referidor con: contactos llegados, en seguimiento, ventas, sin interés, porcentaje de conversión (ventas ÷ llegados), meta mensual y cumplimiento (llegados ÷ meta).
- **FR-009b**: El reporte MUST poder mostrar el avance por día del mes: cuántos contactos llegaron y cuántos compraron cada día, por referidor, como las columnas diarias de la planilla.
- **FR-010**: Todos los números del reporte MUST calcularse de las captaciones y sus cambios de etapa; nadie los escribe a mano.
- **FR-011**: Desde cada fila MUST poder verse la lista de contactos de ese origen, con nombre, producto, responsable, etapa y fecha de venta.
- **FR-012**: El reporte MUST poder agruparse por tipo de referidor (como los colores de la planilla) y exportarse a Excel.
- **FR-013**: El reporte MUST contar solo los referidos registrados como contacto nuevo (no anulados). Los registros rechazados por celular repetido no cuentan en esta versión.

### Permisos

- **FR-014**: Solo los jefes MUST poder ver el reporte de referidos: el jefe de ventas, de las sucursales que tiene a cargo; el gerente general y el administrador, de todas. El encargado y el personal de campo MUST NOT verlo, ni en pantalla ni por exportación.
- **FR-014b**: El permiso MUST verificarse en el servidor en cada consulta (principio IV), no solo escondiendo el menú.
- **FR-015**: Los datos de los contactos (celular, nombre) MUST seguir las mismas reglas de acceso que hoy tienen las captaciones.

### Key Entities *(include if feature involves data)*

- **Referidor**: Origen de contactos referidos dentro de una sucursal (por ejemplo, «Contacto Fernanda», «Freelance Walker», «App»). Tiene nombre, tipo, orden y estado activo. No es necesariamente un usuario de la app.
- **Meta mensual de referidor**: Número de contactos esperados por referidor y mes.
- **Captación** (cambia): suma el referidor de origen, opcional.
- **Cambio de origen**: Registro de quién cambió el referidor de una captación, cuándo y de qué valor a cuál.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Isa obtiene, sin escribir ningún número, cuántos referidos llegaron y cuántos compraron por origen en el mes, en menos de 30 segundos.
- **SC-002**: Elegir el origen agrega menos de 5 segundos al registro de una captación.
- **SC-003**: Los totales del reporte coinciden con el conteo manual de captaciones y ventas en el 100 % de los casos probados.
- **SC-004**: A las 4 semanas de salir a producción, Guayaramerín deja de llevar la planilla de referidos en Excel.

## Assumptions

- Los referidores no reciben pago ni premio; el sistema no registra comisiones.
- Los colores de la planilla equivalen al tipo de referidor o al referidor mismo; en la app se reemplazan por agrupar y filtrar.
- Los contactos individuales de la planilla (Yesenia, Doña Susi, Marilyn…) se cargan como captaciones normales; no se importa la planilla.
- El «1» por día de la planilla es una venta; en la app sale de la fecha en que la captación pasa a venta.
- La feature sirve a todas las sucursales; cada una arma su propia lista. Empieza por Guayaramerín.
- Fuera de alcance: Recompra / Nuevos y conteo de referidos duplicados (spec 006), comisiones a referidores, mensajes automáticos a referidos, unificación con el catálogo de la Planificación (spec 003).
- Dependencia: gerencia desactivó los canales de referencia el 2026-11-03. Esta spec no los reactiva: el origen es un dato aparte del canal. *Se desarrolla sin esperar a gerencia (decisión del usuario, 2026-11-18); confirmar con gerencia antes de publicar en producción.*
