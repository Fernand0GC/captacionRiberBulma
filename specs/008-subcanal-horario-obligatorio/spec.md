# Feature Specification: Subcanal y horario obligatorios en la asignación

**Feature Branch**: `008-subcanal-horario-obligatorio`

**Created**: 2026-11-19

**Status**: Implementada en local (2026-11-19); pendiente de publicar

**Input**: Captura de gerencia (2026-11-19): en «Nueva asignación», Tienda → Kardex, sin marcar «Envío de Kardex» y sin
horas, el formulario deja guardar. «Ni un subcanal está y le permite guardar. ¿Qué debería haber ahí?»

## Contexto

Desde la 004 el subcanal es opcional («uno o varios, opcional») y las horas también. Eso permite asignaciones como
«Kardex › —» sin horario, que no sirven para planificar y en las que el aviso de cruce no funciona. Además, si nadie
marca el subcanal, no se propone el horario sugerido (lo pone el subcanal).

## Clarifications

### Session 2026-11-19

Decididas por el usuario (gerencia):

- Q: ¿Qué debería pasar? → A: Tres reglas juntas: subcanal obligatorio si el canal tiene subcanales; si tiene uno solo, se marca solo con su horario; hora de inicio y fin obligatorias.

Decididas por recomendación (**por confirmar con ventas**):

- Q: ¿Y las asignaciones ya guardadas sin subcanal o sin horas? → A: No se tocan; al editarlas se pide completar lo que falta. «Resultado» se sigue pudiendo registrar sin completar.
- Q: ¿Copiar día copia las incompletas? → A: Sí, como hoy (la copia no pasa por el formulario); quien planifica las completa al editarlas.
- Q: ¿Qué cuenta como «tiene subcanales»? → A: Que tenga al menos un subcanal **activo**. Los canales sin subcanales (p. ej. «Seguimiento de contactos de la app») se guardan sin subcanal, como hoy.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Subcanal obligatorio y marcado solo cuando es único (Priority: P1)

Quien planifica no puede guardar una asignación de un canal con subcanales sin elegir al menos uno; si el canal tiene
uno solo, ya viene marcado con su horario.

**Independent Test**: Elegir Tienda → Kardex en la tarde y ver «Envío de Kardex» marcado y 19:00–19:30; elegir
Llamadas, no marcar nada y ver «Elige al menos un subcanal» al guardar.

**Acceptance Scenarios**:

1. **Given** un canal con un solo subcanal activo, **When** se elige el canal, **Then** ese subcanal queda marcado y se propone su horario del turno.
2. **Given** un canal con varios subcanales activos, **When** se guarda sin marcar ninguno, **Then** no se guarda, aparece «Elige al menos un subcanal.» junto a los botones y la vista va a la lista.
3. **Given** un canal sin subcanales activos, **When** se guarda, **Then** se guarda sin subcanal (como hoy).
4. **Given** la edición de una asignación vieja sin subcanal de un canal que tiene subcanales, **When** se guarda, **Then** pide elegir el subcanal.
5. **Given** cualquier vía de guardado (también una versión vieja de la app), **When** llega sin subcanal y el canal tiene subcanales, **Then** la base lo rechaza.

### User Story 2 - Horario obligatorio (Priority: P1)

Toda asignación nueva o editada tiene hora de inicio y de fin.

**Independent Test**: Borrar la hora de fin y guardar: aparece «Escribe la hora de inicio y la de fin.» y la vista va a las horas.

**Acceptance Scenarios**:

1. **Given** una hora vacía, **When** se guarda, **Then** no se guarda y aparece el aviso junto a los botones, con la vista en las horas.
2. **Given** las dos horas, con la de fin antes que la de inicio, **When** se guarda, **Then** sigue el aviso de hoy.
3. **Given** cualquier vía de guardado, **When** llega sin alguna hora, **Then** la base lo rechaza.
4. **Given** una asignación vieja sin horas, **When** se registra el «Resultado», **Then** se puede (no pasa por esta regla).

### Edge Cases

- Al cambiar el turno con el subcanal único ya marcado, se propone el horario del otro turno (como hoy).
- Subcanal único sin horario sugerido (p. ej. «Volantes fechas festivas» si quedara solo): se marca, las horas quedan vacías y hay que escribirlas.
- Si la persona desmarca el subcanal único, no se vuelve a marcar solo; al guardar se pide elegir.
- «+ Agregar otro…» en un canal sin subcanales: el nuevo queda marcado (como hoy) y desde ahí el canal tiene subcanales.

## Requirements *(mandatory)*

- **FR-001**: Si el canal elegido tiene al menos un subcanal activo, la asignación MUST tener subcanal (al crear: al menos uno marcado; al editar: uno elegido).
- **FR-002**: Al elegir un canal con exactamente un subcanal activo, el formulario de creación MUST marcarlo y proponer su horario del turno.
- **FR-003**: Toda asignación creada o editada MUST tener hora de inicio y de fin (fin después de inicio, como hoy).
- **FR-004**: Los avisos de FR-001 y FR-003 MUST verse junto a los botones y llevar la vista al campo (como la 007).
- **FR-005**: La base MUST rechazar con `invalid_input` (detalle `subchannel` o `time`) lo que no cumpla FR-001 o FR-003.
- **FR-006**: Los títulos MUST indicar que son obligatorios («Subcanales *» si el canal tiene subcanales; «Hora inicio *», «Hora fin *»).
- **FR-007**: Las asignaciones guardadas antes MUST NOT cambiar; «Resultado» y «Copiar día» siguen como hoy.

## Success Criteria *(mandatory)*

- **SC-001**: 0 asignaciones nuevas sin horario o sin subcanal (en canales con subcanales) desde la publicación.
- **SC-002**: En canales de un solo subcanal (Kardex, Freelancers, Referidos, Captación de contactos), cargar una asignación no requiere marcar el subcanal a mano.

## Assumptions

- La regla se aplica en la base (constitución IV) y en el formulario (mensajes claros).
- Despliegue: el SQL va antes que la app; la app 007 publicada ya manda subcanal y horas en el caso normal, así que el SQL primero solo endurece lo que el formulario 008 también pide.
