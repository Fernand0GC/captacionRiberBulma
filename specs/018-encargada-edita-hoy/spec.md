# Feature Specification: La encargada edita la planificación de hoy

**Feature Branch**: `018-encargada-edita-hoy`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "La encargada de sucursal (y el supervisor que la reemplaza) debe poder editar y quitar asignaciones de la planificación del día de hoy, no solo de días futuros. Hoy lo impide org_can_replan (spec 003). Días pasados siguen bloqueados para ella. Con tests pgTAP y Playwright."

**Cambia**: FR-029 de `specs/003-organizacion-comercial/spec.md` (límite por fecha).

## Contexto

En la Planificación (Organización comercial, spec 003) la encargada de sucursal ve sus asignaciones del día con los
botones «Resultado», pero no «Editar» ni «✕». La regla FR-029 reservaba los cambios del mismo día al gerente a cargo,
al gerente general y al administrador. En la práctica el día cambia sobre la marcha (alguien falta, se cubre una
tarea, se corrige un horario) y la encargada, que es quien está en la tienda, no puede corregirlo: tiene que pedírselo
a gerencia o dejar la planificación desactualizada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La encargada corrige una asignación de hoy (Priority: P1)

La encargada abre la Planificación de su sucursal en el día de hoy, toca «Editar» en una asignación y cambia la
persona, el horario, el canal o la meta. Al guardar, la tabla muestra el cambio.

**Why this priority**: Es el pedido concreto: la planificación del día tiene que poder ajustarse en la tienda.

**Independent Test**: Con una asignación de hoy en su sucursal, la encargada la edita y el cambio queda guardado.

**Acceptance Scenarios**:

1. **Given** una asignación de hoy en la sucursal de la encargada, **When** abre la Planificación de hoy, **Then** ve los botones «Editar» y «✕» en esa fila.
2. **Given** esa asignación, **When** cambia la meta y guarda, **Then** la tabla muestra la meta nueva.
3. **Given** esa asignación, **When** cambia la persona o el horario y guarda, **Then** la tabla muestra el cambio.

---

### User Story 2 - La encargada quita una asignación de hoy (Priority: P1)

La encargada quita con «✕» una asignación de hoy que ya no corresponde (por ejemplo, la persona faltó).

**Why this priority**: Sin esto, la planificación del día muestra tareas que nadie va a hacer y distorsiona el
seguimiento de metas.

**Independent Test**: La encargada quita una asignación de hoy y deja de verse en la tabla.

**Acceptance Scenarios**:

1. **Given** una asignación de hoy en su sucursal, **When** toca «✕» y confirma, **Then** la asignación deja de aparecer.

---

### User Story 3 - Los días pasados siguen protegidos (Priority: P2)

La encargada mira la Planificación de un día anterior: puede registrar resultados y observaciones, pero no editar ni
quitar asignaciones.

**Why this priority**: Lo cerrado no debe cambiar después: los reportes de metas de días pasados tienen que seguir
siendo confiables.

**Independent Test**: En un día anterior, la encargada no ve «Editar» ni «✕», y el servidor rechaza el cambio si se
intenta igual.

**Acceptance Scenarios**:

1. **Given** una asignación de ayer, **When** la encargada abre ese día, **Then** ve «Resultado» pero no «Editar» ni «✕».
2. **Given** una asignación de ayer, **When** se intenta cambiar o quitar desde fuera de la pantalla, **Then** el sistema lo rechaza.

---

### Edge Cases

- **Supervisor de campo**: tiene los mismos permisos que la encargada en la Planificación de su sucursal (FR-029 los
  trata igual), así que también edita y quita las de hoy.
- **Otra sucursal**: la encargada sigue sin poder editar asignaciones de otra sucursal, sea el día que sea.
- **Cambio de día**: el límite usa la fecha de Bolivia. Una asignación de «hoy» pasa a ser «pasada» a la medianoche
  de Bolivia.
- **Auxiliar y volantera**: no cambian (el auxiliar solo ve lo suyo sin escribir; la volantera no ve la Planificación).
- **Gerencia y Sistemas**: no cambian (siguen editando cualquier día).
- **Agregar el mismo día**: la encargada ya podía crear asignaciones de hoy; ahora además puede corregirlas después.
- **Asignación con resultado ya cargado**: se puede editar igual; el resultado se conserva.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La encargada y el supervisor de campo MUST poder cambiar la meta, la persona, el horario y el catálogo
  de una asignación de su sucursal cuya fecha sea hoy o posterior (fecha de Bolivia).
- **FR-002**: La encargada y el supervisor de campo MUST poder quitar una asignación de su sucursal cuya fecha sea hoy
  o posterior.
- **FR-003**: Para asignaciones de fechas anteriores a hoy, esos cambios y la eliminación MUST seguir reservados al
  gerente a cargo, al gerente general y al administrador.
- **FR-004**: El registro de resultado y observaciones MUST seguir sin restricción de fecha (FR-018 de la spec 003).
- **FR-005**: La pantalla MUST mostrar «Editar» y «✕» solo en las filas que el usuario puede cambiar, y el servidor
  MUST rechazar cualquier cambio fuera de esas reglas aunque llegue sin pasar por la pantalla (FR-028 de la spec 003).
- **FR-006**: La spec 003 MUST actualizarse: FR-029 y el caso borde «Asignación de hoy o de una fecha pasada» pasan a
  decir «hasta el mismo día» en lugar de «hasta el día anterior».

### Key Entities

- **Asignación**: una tarea de la planificación (persona, fecha, horario, estrategia → canal → subcanal, meta,
  resultado). Esta feature solo cambia quién puede modificarla según su fecha; no agrega datos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La encargada corrige una asignación de hoy en menos de 1 minuto, sin pedir ayuda a gerencia.
- **SC-002**: El 100 % de los intentos de la encargada de cambiar o quitar asignaciones de días pasados es rechazado.
- **SC-003**: Los permisos de gerencia, Sistemas, auxiliar y volantera quedan exactamente como estaban (ningún test
  existente de esos roles cambia de resultado).

## Assumptions

- «Encargada de sucursal» es el rol Encargado (`branch_manager`); el supervisor de campo la reemplaza y por eso recibe
  el mismo permiso, como ya ocurre en el resto de la Planificación.
- No se agrega historial de quién cambió una asignación: no lo pidieron y la spec 003 tampoco lo tiene.
- No hace falta migrar datos: solo cambia la regla de permisos.
- Se aplica a producción solo con autorización explícita del usuario (regla de `CLAUDE.md`).
