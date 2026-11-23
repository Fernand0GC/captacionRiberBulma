# Feature Specification: «Acomodo de tienda» como canal propio de Tienda

**Feature Branch**: `019-acomodo-tienda-canal`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "«Acomodo de tienda» hoy es un subcanal creado a mano con «+ Agregar otro…» en producción. Debe ser un canal propio de la estrategia Tienda. Migrar todas las asignaciones existentes (con metas y resultados) al canal nuevo y desactivar el subcanal viejo, sin perder historial. La migración debe ser idempotente y no fallar donde el subcanal no exista. Empezar con una consulta de diagnóstico de solo lectura (que el usuario corre en producción) para saber bajo qué canal está y cuántas asignaciones tiene. Con tests pgTAP y Playwright."

## Contexto

En la Planificación (spec 003) cada asignación elige Estrategia → Canal → Subcanal. Desde la spec 004, quien
planifica puede crear un subcanal que falta con «+ Agregar otro…». Así nació «Acomodo de tienda» en producción:
como subcanal de algún canal (no sabemos cuál ni cuántas veces) y no como canal de Tienda. Ventas quiere verlo
al mismo nivel que «Atención en tienda y venta» o «Creación de contenido» y que sus números se lean por canal.

El subcanal no existe en la base local ni en las migraciones: solo en producción. Por eso el trabajo empieza con
un diagnóstico de solo lectura y la migración tiene que funcionar igual en una base que no lo tiene.

## Clarifications

### Session 2026-11-23

- Q: ¿La migración mueve solo «Acomodo de tienda» o también otros subcanales creados a mano (CONTEO, garantías…)? → A: Solo «Acomodo de tienda»; los demás se deciden después del diagnóstico, en otra spec.
- Q: ¿Qué metas pide el canal nuevo? → A: Copia las marcas del subcanal viejo (captación y compartidas), así las asignaciones viejas se editan sin error y conservan sus números visibles (FR-006).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Diagnóstico antes de migrar (Priority: P1)

El responsable técnico corre en producción una consulta que solo lee y que le dice: en qué estrategia y canal
está cada subcanal llamado «Acomodo de tienda» (con cualquier variante de mayúsculas, tildes o espacios), si está
activo, quién lo agregó y cuándo, cuántas asignaciones lo usan, en qué rango de fechas y sucursales, cuántas tienen
meta, resultado, compartidas o verificación de Cobros, y si ya existe un canal llamado así en Tienda.

**Why this priority**: Sin saber dónde está ni cuánto pesa, no se puede validar la migración ni comparar el
antes y el después. Es la condición para aplicar el resto en producción.

**Independent Test**: Correr la consulta en una base sin el subcanal (devuelve cero filas, sin error) y en una
base con datos de prueba que lo tienen en uno o dos canales (devuelve los conteos esperados). Confirmar que no
cambia nada.

**Acceptance Scenarios**:

1. **Given** una base donde «Acomodo de tienda» existe como subcanal de un canal, **When** se corre el
   diagnóstico, **Then** muestra estrategia, canal, estado activo, quién y cuándo lo agregó, y el total de
   asignaciones con sus metas, resultados y verificaciones.
2. **Given** una base donde se agregó dos veces bajo canales distintos (o con otra escritura, p. ej.
   «acomodo  de Tienda»), **When** se corre el diagnóstico, **Then** aparecen las dos filas por separado.
3. **Given** una base donde no existe, **When** se corre el diagnóstico, **Then** devuelve un resultado vacío
   sin error.
4. **Given** cualquier base, **When** se corre el diagnóstico, **Then** no se modifica ningún dato.

---

### User Story 2 - Canal nuevo con el historial movido (Priority: P1)

Al aplicar la migración, Tienda tiene un canal «Acomodo de tienda». Todas las asignaciones que usaban el
subcanal viejo (pasadas, de hoy y futuras) pasan a ese canal, conservando persona, sucursal, fecha, turno,
horario, lugar, observaciones, volanteras, meta, resultado, meta y resultado de compartidas, y la verificación de
Cobros. El subcanal viejo queda desactivado: ya no se ofrece para planificar, pero no se borra.

**Why this priority**: Es el pedido de ventas. Sin mover el historial, los números de «Acomodo de tienda»
quedarían partidos entre el subcanal viejo y el canal nuevo.

**Independent Test**: En una base de prueba con el subcanal y asignaciones con metas y resultados, aplicar la
migración y verificar que cada asignación quedó en Tienda → Acomodo de tienda con los mismos números, que el
subcanal está inactivo y que el total de asignaciones no cambió.

**Acceptance Scenarios**:

1. **Given** asignaciones con meta 10 y resultado 7 en el subcanal viejo, **When** se aplica la migración,
   **Then** están en Tienda → Acomodo de tienda (sin subcanal) con meta 10 y resultado 7.
2. **Given** una asignación con compartidas verificadas por Cobros, **When** se aplica la migración, **Then**
   conserva la cantidad verificada, el comentario, quién verificó y cuándo.
3. **Given** el subcanal viejo bajo un canal de la estrategia Calle, **When** se aplica la migración, **Then** sus
   asignaciones quedan con estrategia Tienda (el cambio de estrategia es consistente con el canal nuevo).
4. **Given** la migración aplicada, **When** se mira el subcanal viejo, **Then** existe y está inactivo.
5. **Given** la migración aplicada, **When** se revisa la auditoría de cambios, **Then** cada asignación movida
   tiene registrado su valor anterior (canal y subcanal viejos).

---

### User Story 3 - Planificar y ver con el canal nuevo (Priority: P2)

La encargada (o quien planifica) elige Tienda → «Acomodo de tienda» directamente como canal al crear una
asignación, sin tener que elegir subcanal, y lo ve con ese nombre en la tabla de la Planificación y en el
Catálogo. El subcanal viejo ya no aparece en la lista para elegir. Las asignaciones antiguas se ven bajo el canal
nuevo.

**Why this priority**: Es el uso diario, pero depende de que el canal exista (US2).

**Independent Test**: Con la migración aplicada en local, abrir la Planificación, crear una asignación con
Tienda → Acomodo de tienda, guardarla y verla en la tabla; abrir el Catálogo y ver el canal en Tienda.

**Acceptance Scenarios**:

1. **Given** el canal nuevo, **When** la encargada crea una asignación con Tienda → Acomodo de tienda, **Then**
   no se le pide subcanal y se guarda.
2. **Given** el canal nuevo, **When** la encargada abre la lista de subcanales del canal donde estaba el viejo,
   **Then** «Acomodo de tienda» no aparece.
3. **Given** el canal nuevo, **When** alguien intenta agregar «Acomodo de tienda» con «+ Agregar otro…» en el
   canal viejo, **Then** se le avisa que está inactivo (comportamiento actual de subcanales inactivos) y no se
   crea un duplicado.

---

### User Story 4 - Repetir la migración sin daño (Priority: P2)

La migración se puede correr más de una vez (por ejemplo, si se aplica en producción y luego alguien vuelve a
crear el subcanal antes de un segundo intento, o simplemente al aplicar otra vez el mismo script) sin crear un
segundo canal, sin duplicar asignaciones y sin fallar.

**Why this priority**: Es un requisito explícito del pedido y protege la producción, pero no agrega valor de
negocio por sí solo.

**Independent Test**: Aplicar el bloque de la migración dos veces seguidas sobre la misma base de prueba y
comparar: un solo canal, mismas asignaciones, mismos números.

**Acceptance Scenarios**:

1. **Given** la migración ya aplicada, **When** se vuelve a correr, **Then** termina sin error y no cambia nada.
2. **Given** una base sin el subcanal, **When** se corre la migración, **Then** crea el canal (si falta), no mueve
   nada y termina sin error.
3. **Given** que ya existe un canal «Acomodo de tienda» en Tienda (creado a mano en Catálogo), **When** se corre la
   migración, **Then** usa ese canal en vez de crear otro.

### Edge Cases

- El subcanal existe en varios canales (o estrategias) con escrituras distintas: se migran todos los que coinciden
  por nombre normalizado (minúsculas, sin tildes, espacios colapsados).
- El subcanal ya está inactivo: igual se migran sus asignaciones; queda inactivo.
- Al mover, dos asignaciones de la misma persona, día, turno y horario quedan iguales (venían de dos subcanales
  «Acomodo» distintos): se conservan las dos; nada se borra. El diagnóstico debe advertir si este caso existe.
- Asignaciones creadas con selección múltiple (mismo lote que otros subcanales): se mueven solas; las demás del
  lote no cambian.
- Asignaciones de hoy y del futuro: se mueven igual que las pasadas.
- Hay un canal «Acomodo de tienda» inactivo en Tienda: se reactiva y se usa.
- Un subcanal con un nombre parecido pero distinto (p. ej. «Acomodo de vitrinas»): no se toca.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Debe existir una consulta de diagnóstico, de solo lectura, que el usuario corre en producción, que
  liste cada subcanal cuyo nombre normalizado sea «acomodo de tienda» con: estrategia, canal, activo, quién y cuándo
  lo agregó, total de asignaciones, primera y última fecha, sucursales, y cuántas tienen meta, resultado, meta de
  compartidas, resultado de compartidas y verificación de Cobros.
- **FR-002**: El diagnóstico debe indicar si ya existe un canal llamado «Acomodo de tienda» (normalizado) en
  Tienda y si está activo.
- **FR-003**: El diagnóstico debe contar cuántas asignaciones quedarían iguales a otra (misma sucursal, día,
  persona, turno, horario) después de moverlas al canal nuevo.
- **FR-004**: El diagnóstico no debe escribir nada y debe devolver vacío (sin error) donde el subcanal no exista.
- **FR-005**: La migración debe dejar en Tienda un único canal activo «Acomodo de tienda», sin subcanales. Si ya
  existe uno con ese nombre normalizado, lo reutiliza (y lo reactiva si estaba inactivo).
- **FR-006**: El canal nuevo debe tomar las marcas de meta (captación y compartidas) del subcanal viejo; si hay
  varios con marcas distintas, se combinan (usa la meta si alguno la usaba). Si el subcanal no existe, usa la marca
  por defecto de un canal nuevo de Tienda (con meta de captación, sin compartidas, sin volanteras).
- **FR-007**: La migración debe mover al canal nuevo todas las asignaciones que usan cualquiera de esos
  subcanales, cambiando solo estrategia, canal y subcanal (queda vacío); todo lo demás (metas, resultados,
  verificación, horario, persona, lugar, observaciones, volanteras, lote, autor) se conserva.
- **FR-008**: La migración debe desactivar (no borrar) los subcanales viejos.
- **FR-009**: Cada asignación movida debe quedar registrada en la auditoría con su valor anterior.
- **FR-010**: La migración debe ser idempotente: correrla de nuevo no crea canales, no mueve nada que ya se movió
  y no falla.
- **FR-011**: La migración no debe fallar en una base donde el subcanal no exista (local, pruebas, producción ya
  migrada).
- **FR-012**: La migración debe ser una sola transacción: o queda todo aplicado o nada.
- **FR-013**: Después de la migración, la Planificación debe ofrecer Tienda → Acomodo de tienda como canal y ya no
  debe ofrecer el subcanal viejo.
- **FR-014**: Solo «Acomodo de tienda» cambia en esta spec; otros subcanales agregados a mano (CONTEO, garantías…)
  no se tocan y quedan para otra spec, después del diagnóstico.
- **FR-015**: Debe haber pruebas automáticas de la migración (base de datos) y del uso del canal nuevo en la
  Planificación (navegador).

### Key Entities

- **Canal (Tienda → Acomodo de tienda)**: nuevo nivel del catálogo; nombre, orden al final de Tienda, activo, marcas
  de meta.
- **Subcanal viejo «Acomodo de tienda»**: uno o más, bajo cualquier canal; queda inactivo como registro histórico.
- **Asignación**: fila de la Planificación; cambia su estrategia/canal/subcanal y conserva el resto.
- **Auditoría**: registro del valor anterior de cada asignación cambiada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El total de asignaciones y la suma de metas, resultados, metas y resultados de compartidas y
  verificadas que reporta el diagnóstico antes es exactamente igual a lo que tiene el canal nuevo después.
- **SC-002**: Después de migrar, cero asignaciones apuntan a un subcanal «Acomodo de tienda».
- **SC-003**: Correr la migración una segunda vez cambia cero filas.
- **SC-004**: En una base sin el subcanal, la migración termina sin error y crea un solo canal.
- **SC-005**: La encargada crea una asignación de «Acomodo de tienda» eligiendo dos niveles (estrategia y canal),
  sin subcanal.

## Assumptions

- El nombre se reconoce con la misma normalización que ya usa «+ Agregar otro…» (minúsculas, sin tildes, espacios
  colapsados); otras variantes (abreviaturas, errores de tipeo) se revisan con el diagnóstico antes de aplicar.
- Se migran todos los subcanales «Acomodo de tienda» encontrados, sin importar en qué canal o estrategia estén
  (recomendación del plan 018–021: solo este; el resto tras ver el diagnóstico).
- El canal nuevo no lleva horario sugerido: el horario sugerido vive en los subcanales y la asignación ya guarda
  su propio horario.
- Los reportes que agrupan por canal mostrarán el historial de «Acomodo de tienda» bajo el canal nuevo; es lo
  buscado.
- La aplicación en producción la hace el usuario, después de revisar el diagnóstico; este trabajo solo la deja
  probada en local.
- No hace falta cambiar pantallas: el canal nuevo aparece por ser parte del catálogo.
