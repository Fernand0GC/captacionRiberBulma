# Feature Specification: Seguimientos accionable (lo útil de Captaciones en Seguimientos)

**Feature Branch**: `015-seguimientos-accionable`

**Created**: 2026-11-21

**Status**: Implementada en local (2026-11-21); pendiente de publicar

**Input**: Pedido del usuario (2026-11-21) con capturas de Captaciones y Seguimientos: «qué se debería copiar de
captación que le falta a seguimiento… análisis profundo como senior». Se aprobó el análisis y se pidió «desarrollalo
todo lo recomendado con sdd y en loop».

## Contexto

Captaciones responde «¿qué entró y de dónde?»; Seguimientos responde «¿en qué punto está cada cliente y quién se
atrasa?». Seguimientos muestra el problema pero no deja resolverlo:

- Con «Hoy» por defecto, el período filtra por **fecha de registro**: solo salen clientes que entraron hoy, que casi
  nunca tienen contactos («Nunca», «0/3», «Sin contacto: Hoy»). La vista por defecto no sirve para hacer seguimiento.
- Se ven 33 «Sin contactar» casi todos «Sin asignar», pero para asignarlos hay que ir a Captaciones y repetir filtros.
- No se puede registrar un contacto desde la fila (Captaciones tiene el botón «Seguimiento»).
- Falta contexto que la base ya envía y la pantalla no muestra: celular, fecha y autor del registro, canal, referido.
- «Referido por» solo permite «Solo referidos», no un referidor; no hay producto (ni dato ni filtro).

## Clarifications

### Session 2026-11-21

Decididas por recomendación (**por confirmar con ventas**, regla de trabajo en loop):

- Q: ¿Con qué período abre Seguimientos? → A: **Este mes** cuando la URL no trae período (Captaciones sigue con Hoy).
  Elegir «Hoy» lo deja explícito en la URL. Un texto bajo el total aclara que el período es la fecha de registro.
- Q: ¿La selección es igual a la de Captaciones? → A: Sí, la misma barra y la misma operación (`assign_prospects`):
  asignar, repartir entre auxiliares, quitar responsable, confirmar al reasignar, «Seleccionar las N del filtro» y
  exige elegir una sucursal. Se extrae a un componente compartido para que las dos vistas no se separen.
- Q: ¿Botón «Seguimiento» en qué filas? → A: Igual que Captaciones: sin responsable y que no sea Venta ni Sin interés.
  Abre el mismo registro de contacto; quien lo registra queda como responsable.
- Q: ¿Columnas nuevas? → A: No. Se apila: bajo el nombre, celular y «registró Fulano · 21/11»; la columna Etapa pasa
  a «Canal · Etapa» con canal y detalle del canal y «Ref. X»; la columna Interés pasa a «Producto» con el interés
  debajo (como Captaciones).
- Q: ¿«Referido por» como en Captaciones? → A: Sí: el selector «Origen» pasa a «Referido por» (Solo referidos o un
  referidor de la sucursal elegida), el mismo de la barra de Captaciones.
- Q: ¿Filtros en los títulos de la tabla como Captaciones? → A: **Fuera de alcance** (siguiente spec si ventas lo pide).
  La barra de filtros arriba sigue siendo la única en Seguimientos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir Seguimientos con algo que seguir (Priority: P1)

**Independent Test**: Un cliente registrado el día 3 del mes sin contactos aparece al abrir Seguimientos sin tocar filtros.

**Acceptance Scenarios**:

1. **Given** /gestion?ver=seguimiento sin período, **When** se abre, **Then** está marcado «Este mes» y la lista cuenta los registrados desde el día 1.
2. **Given** Seguimientos, **When** se elige «Hoy», **Then** queda `periodo=hoy` en la URL y solo salen los de hoy.
3. **Given** Captaciones sin período, **When** se abre, **Then** sigue siendo «Hoy».

### User Story 2 - Asignar desde Seguimientos (Priority: P1)

El jefe filtra «Sin contactar» + «Responsable: Sin asignar», toca «Seleccionar», marca o elige «Seleccionar las N del
filtro» y asigna (o reparte entre auxiliares).

**Acceptance Scenarios**:

1. **Given** una sucursal elegida y 3 clientes sin responsable, **When** se seleccionan y se asignan a una auxiliar, **Then** la lista se actualiza con su nombre y el aviso dice «✓ 3 asignadas».
2. **Given** clientes de otra persona en la selección, **When** se asigna, **Then** pide confirmar «¿Reasignar?» con a quién se le quitan.
3. **Given** «Todas las sucursales», **When** se selecciona, **Then** la barra pide elegir una sucursal para asignar.
4. **Given** una selección, **When** se cambia un filtro, **Then** la selección se limpia.

### User Story 3 - Registrar un contacto desde la fila (Priority: P2)

**Acceptance Scenarios**:

1. **Given** un cliente sin responsable en etapa Captación, **When** se toca «Seguimiento», **Then** se abre el registro de contacto y, al guardar, la fila muestra el contacto y el responsable.
2. **Given** un cliente con responsable o en Venta/Sin interés, **Then** no hay botón (el nombre lleva a la ficha).

### User Story 4 - Contexto de cada cliente sin salir de la lista (Priority: P2)

**Acceptance Scenarios**:

1. **Given** la tabla, **Then** cada fila muestra celular, quién registró (con su cargo) y la fecha de registro bajo el nombre; canal, detalle del canal y «Ref. X» junto a la etapa; producto con el interés.
2. **Given** «Referido por: Jesús Cortez» con una sucursal elegida, **Then** solo salen sus referidos y el Excel también.
3. **Given** el Excel, **Then** trae además Producto, Detalle del canal y Referido por.

### User Story 5 - Filtrar por producto (Priority: P3)

**Acceptance Scenarios**:

1. **Given** «Producto: Laptops», **Then** pestañas, total, lista y Excel cuentan solo clientes con ese producto.

### Edge Cases

- Cliente sin canal, sin producto o sin referido: se muestra «—» o se omite la línea, nunca «null».
- Selección sobre «Seleccionar las N del filtro» con más de 200: se traen por páginas (como el Excel).
- Al registrar un contacto o asignar, la lista de Seguimientos y Captaciones se refresca.
- La app publicada anterior no manda `product_id` y no lee los campos nuevos: la base responde igual (aditivo).

## Requirements *(mandatory)*

- **FR-001**: Seguimientos MUST abrir con el período «Este mes» si la URL no trae `periodo`; las demás vistas no cambian.
- **FR-002**: Seguimientos MUST indicar que el período filtra por fecha de registro.
- **FR-003**: Seguimientos MUST tener modo «Seleccionar» con la misma barra y reglas de asignación que Captaciones (FR-035/FR-039b de specs anteriores), compartiendo el componente.
- **FR-004**: Asignar MUST refrescar Captaciones y Seguimientos.
- **FR-005**: Seguimientos MUST mostrar «Seguimiento» en filas sin responsable que no estén en Venta ni Sin interés, con el mismo registro de contacto que Captaciones.
- **FR-006**: Cada fila MUST mostrar celular, autor del registro con cargo, fecha de registro, canal con detalle, referidor y producto, sin columnas nuevas.
- **FR-007**: El filtro «Referido por» MUST permitir un referidor de la sucursal elegida, además de «Solo referidos».
- **FR-008**: `list_followup_status` MUST aceptar `f.product_id` y devolver `product_name`, `channel_detail` y `created_by_role`, de forma aditiva.
- **FR-009**: El Excel de Seguimientos MUST respetar el filtro de producto y traer Producto, Detalle del canal y Referido por.
- **FR-010**: El celular y la búsqueda siguen fuera de la URL (constitución IV).

## Success Criteria *(mandatory)*

- **SC-001**: Asignar los «Sin asignar» de una sucursal desde Seguimientos toma ≤ 4 toques, sin cambiar de vista.
- **SC-002**: Al abrir Seguimientos sin filtros, se ven los clientes del mes (no solo los de hoy).
- **SC-003**: La tabla no suma columnas (sigue en 11 con sucursal) y se lee sin desplazamiento extra en 1280 px.
- **SC-004**: La app anterior sigue funcionando con la migración aplicada (pgTAP del contrato anterior en verde).

## Assumptions

- Quien ve Seguimientos (gestores) es quien ya puede asignar en Captaciones; los permisos los verifica `assign_prospects`.
- El «detalle del canal» es `prospects.channel_detail` (lo que Captaciones muestra bajo el canal).
