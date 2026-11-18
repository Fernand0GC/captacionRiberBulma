# Feature Specification: Observaciones del grupo «OBSERVACIONES APP DE CAPTACIONES»

**Feature Branch**: `006-ajustes-ventas-2`

**Created**: 2026-11-18

**Status**: Draft

**Input**: Chat de WhatsApp «OBSERVACIONES APP DE CAPTACIONES» (2026-11-18), con las observaciones de ventas sobre la
Planificación después de la 004: horario para creación de contenido, caja de observaciones al crear, seguimiento de
contactos de la app, dos tipos de compartidas (WhatsApp y redes sociales), organizar por personal, atención en tienda
y venta, verificación de compartidas por el área de Cobros, preguntar si se llevan volanteras a negociación o
activación, y «Plaza». Además, un error visible en la foto del Excel (los totales salen como fecha y hora).

## Contexto

La 004 (en producción desde el 2026-11-18) ya resolvió: selección múltiple, meta de captación, metas de compartidas,
compartidas en Barrio chino y WhatsApp, y «+ Agregar otro…». Esta spec cubre el resto.

## Clarifications

### Session 2026-11-18

Decididas por recomendación (el usuario pidió avanzar sin frenar; **por confirmar con ventas**):

- Q: «No hay seguimiento / verificación de la app» → A: Falta un canal para planificar el tiempo de seguimiento a los contactos captados por la app: canal «Seguimiento de contactos de la app» en Tienda.
- Q: «Plaza» → A: Subcanal «Activaciones en plazas» en Calle → Activación, con el horario de las activaciones en barrios.
- Q: ¿Qué pregunta la asignación sobre volanteras? → A: Elegir qué volanteras de la sucursal acompañan (opcional), en los canales que lo piden (Negociación y Activación).
- Q: ¿Cómo verifica Cobros las compartidas? → A: Un usuario con rol nuevo «Cobros» ve las asignaciones con compartidas de sus sucursales y anota cuántas verificó y un comentario. La Planificación muestra reportado y verificado.
- Q: Dos tipos de compartidas → A: Subcanales «Compartidas WhatsApp» y «Compartidas redes sociales» en «Compartidas y estados», solo con meta de compartidas; el subcanal genérico «Compartidas y estados» se desactiva (las asignaciones viejas lo conservan).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Arreglos de la Planificación (Priority: P1)

Quien planifica escribe observaciones al crear la asignación, ve la organización agrupada por persona y exporta un
Excel con los totales bien mostrados. Un subcanal agregado con «+ Agregar otro…» pide las metas que corresponden a su canal.

**Independent Test**: Crear una asignación con observación, exportar el Excel y ver los totales como números; agregar
un subcanal en «Compartidas y estados» y ver que pide meta de compartidas.

**Acceptance Scenarios**:

1. **Given** el formulario «Nueva asignación», **When** se escribe una observación y se guarda, **Then** queda en la asignación y se ve en la tabla, sin pasar por «Resultado».
2. **Given** una carga con varios subcanales, **When** se escribe la observación, **Then** todas las asignaciones de la carga la llevan.
3. **Given** la organización de un día, **When** se muestra, **Then** las filas van ordenadas por persona y luego por hora, y cada persona se distingue como grupo.
4. **Given** la exportación a Excel, **When** se abre, **Then** los totales del resumen se ven como números y las filas siguen el mismo orden por persona.
5. **Given** «+ Agregar otro…» en un canal, **When** se crea el subcanal, **Then** usa las mismas marcas de meta que su canal.

---

### User Story 2 - Catálogo con lo que falta (Priority: P1)

Quien planifica encuentra en la lista: Creación de contenido, Atención en tienda y venta, Seguimiento de contactos de la
app, Compartidas WhatsApp, Compartidas redes sociales y Activaciones en plazas.

**Independent Test**: Abrir «Nueva asignación» en Tienda y Calle y encontrar cada opción con las metas que corresponden.

**Acceptance Scenarios**:

1. **Given** Tienda, **When** se abre la lista de canales, **Then** aparecen «Creación de contenido», «Atención en tienda y venta» y «Seguimiento de contactos de la app», sin metas.
2. **Given** «Compartidas y estados», **When** se abren sus subcanales, **Then** aparecen «Compartidas WhatsApp» y «Compartidas redes sociales», solo con meta de compartidas, y ya no se ofrece el genérico.
3. **Given** Calle → Activación, **When** se abren los subcanales, **Then** aparece «Activaciones en plazas» con horario sugerido.

---

### User Story 3 - Volanteras que acompañan (Priority: P2)

En una asignación de Negociación o Activación, quien planifica marca qué volanteras de la sucursal van.

**Independent Test**: Crear una Activación con dos volanteras y verlas en la tabla y en el Excel.

**Acceptance Scenarios**:

1. **Given** un canal que pide volanteras, **When** se abre el formulario, **Then** aparece «Volanteras que van» con las volanteras activas de la sucursal, para marcar ninguna, una o varias.
2. **Given** un canal que no las pide, **When** se guarda, **Then** no se guardan volanteras aunque lleguen.
3. **Given** «Copiar del día anterior», **When** se copia, **Then** se copian las volanteras que siguen activas.

---

### User Story 4 - Cobros verifica las compartidas (Priority: P2)

Una persona de Cobros entra a la app, ve las asignaciones con compartidas de sus sucursales y anota cuántas verificó.

**Independent Test**: Con un usuario Cobros, verificar 12 de 15 compartidas reportadas y ver en la Planificación «15 · verificadas 12».

**Acceptance Scenarios**:

1. **Given** un usuario Cobros, **When** entra, **Then** va directo a «Verificar compartidas» y no ve el resto de la app.
2. **Given** un rango de fechas, **When** se lista, **Then** aparecen las asignaciones con meta o resultado de compartidas de sus sucursales, con persona, subcanal, meta y reportado.
3. **Given** una asignación, **When** anota la cantidad verificada y un comentario, **Then** queda guardado con quién y cuándo, y se puede corregir.
4. **Given** la Planificación, **When** una asignación tiene verificación, **Then** se ve junto al resultado de compartidas.
5. **Given** un usuario que no es Cobros (ni gerencia ni Sistemas), **When** intenta verificar, **Then** la base lo rechaza.

---

### Edge Cases

- Una asignación verificada cambia su resultado de compartidas: la verificación se mantiene; se ve la diferencia.
- Un usuario Cobros sin sucursales asignadas: no ve nada y se le avisa.
- Una volantera se da de baja: sigue figurando en las asignaciones viejas.
- El subcanal genérico desactivado sigue en las asignaciones anteriores y en filtros.

## Requirements *(mandatory)*

### Planificación

- **FR-001**: El Excel MUST mostrar los totales del resumen como números enteros, sin tomar el formato de la columna.
- **FR-002**: El formulario de asignación (nueva y edición) MUST tener «Observaciones» (hasta 300 caracteres). En una carga múltiple se guarda en todas. «Resultado» la sigue pudiendo cambiar.
- **FR-003**: La tabla, las tarjetas y el Excel MUST ordenar por fecha, sucursal, persona y hora, y la tabla MUST marcar el inicio de cada persona.
- **FR-004**: Un subcanal agregado desde el formulario MUST tomar las marcas de meta de su canal (reemplaza FR-015 de la 004 en ese punto).

### Catálogo (migración)

- **FR-005**: Tienda MUST tener los canales «Creación de contenido», «Atención en tienda y venta» y «Seguimiento de contactos de la app», sin metas.
- **FR-006**: «Compartidas y estados» MUST tener los subcanales «Compartidas WhatsApp» y «Compartidas redes sociales» (solo compartidas, horario del genérico) y el genérico MUST quedar desactivado.
- **FR-007**: Calle → Activación MUST tener «Activaciones en plazas» con horario 10:00–12:00 y 16:30–18:30.

### Volanteras

- **FR-008**: Cada canal MUST indicar si pide volanteras (Negociación y Activación sí). El administrador lo cambia desde Catálogo.
- **FR-009**: La asignación MUST poder guardar cero o más volanteras activas de su sucursal; la base MUST rechazar personas que no sean volanteras de esa sucursal y vaciar el dato si el canal no las pide.
- **FR-010**: La tabla, las tarjetas y el Excel MUST mostrar las volanteras; copiar día MUST copiar las que siguen activas.

### Verificación de compartidas

- **FR-011**: El sistema MUST tener el rol «Cobros», con sucursales asignadas como el jefe de ventas; el administrador lo crea desde Usuarios.
- **FR-012**: Cobros MUST ver solo la pantalla «Verificar compartidas»: asignaciones de sus sucursales en un rango de hasta 31 días con meta o resultado de compartidas.
- **FR-013**: Cobros, el gerente general y el administrador MUST poder guardar por asignación la cantidad verificada (0–9999 o vacía) y un comentario (hasta 300), con quién y cuándo.
- **FR-014**: La Planificación MUST mostrar la cantidad verificada junto al resultado de compartidas; ventas no la puede cambiar.
- **FR-015**: Los permisos MUST aplicarse en la base.

### Key Entities

- **Asignación** (cambia): observación al crear; volanteras; verificación de compartidas (cantidad, comentario, quién, cuándo).
- **Canal** (cambia): marca «pide volanteras».
- **Rol Cobros** (nuevo): verifica compartidas en sus sucursales.

## Success Criteria *(mandatory)*

- **SC-001**: El Excel exportado muestra los 5 totales como números en el 100 % de las pruebas.
- **SC-002**: Ventas encuentra en la lista las 6 opciones nuevas sin pedirlas a Sistemas.
- **SC-003**: Cobros verifica las compartidas de un día de una sucursal en menos de 5 minutos.
- **SC-004**: Ninguna observación del grupo del 2026-11-18 queda sin respuesta (resuelta o justificada).

## Assumptions

- Las decisiones de Clarifications se toman por recomendación y se confirman con ventas después de publicar.
- Cobros entra con su propio usuario de la app (o por la cuenta única). Su rol no da acceso a datos de clientes.
- La volantera no ve la organización (FR-026 de la 003 no cambia).
- Fuera de alcance: verificación automática con datos de la app, lista de lugares para «Ubicación».
