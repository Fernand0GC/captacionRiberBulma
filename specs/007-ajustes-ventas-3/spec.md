# Feature Specification: Observaciones del grupo de ventas del 2026-11-19

**Feature Branch**: `007-ajustes-ventas-3`

**Created**: 2026-11-19

**Status**: Implementada en local (2026-11-19); pendiente de publicar

**Input**: Chat de WhatsApp «OBSERVACIONES APP DE CAPTACIONES» (mensajes del 2026-11-19), después de publicar la 006:
«no está guardando las organizaciones», «se están duplicando los ingresos, tuve que eliminar lo que se carga doble»,
«indica que el personal a esta hora tiene tarea asignada pero no es así», «debería poder ocultarse la organización de
la mañana», «contestar la mensajería de WhatsApp no debe tener meta de compartidas», «las compartidas están en el
reporte de ejecución; la meta es general, no específica» y «designación de funciones al personal 8:30 a 9:00».

## Contexto

Análisis de las observaciones del 2026-11-19 contra el código publicado (006):

| Observación | Causa encontrada | Se resuelve en |
|---|---|---|
| «No está guardando» (foto: «Compartidas redes sociales» con la meta vacía) | La meta de compartidas es obligatoria; el aviso de error se muestra al final de la zona con scroll, fuera de la vista, y parece que «Guardar» no hace nada | US2 |
| «Se duplican los ingresos» | «Copiar del día anterior / al día siguiente» copia todo sin mirar lo que ya existe en el día de destino; dos copias o una copia sobre un día ya cargado duplican | US1 |
| «Dice que tiene tarea a esa hora y no es así» (aviso 16:20–17:30 al cargar 16:20–17:30) | Ya existía una asignación igual (duplicado o un intento anterior que sí se guardó). El cálculo del cruce es correcto, pero el aviso no dice con qué se cruza | US1 y US3 |
| Ocultar la mañana | Ya existe el filtro «Turno» en la Planificación | US4 (mejora: elegirlo solo) |
| WhatsApp sin meta de compartidas | Marca del subcanal en el Catálogo | Fuera de la spec (Catálogo, sin código) |
| Designación de funciones 8:30–9:00 | Subcanal «DISTRIBUCION DE TAREAS AL PERSONAL» ya existe; falta el horario | Fuera de la spec (Catálogo, sin código) |
| Meta de compartidas «general» | Contradice el pedido del 2026-11-18 («debe especificar metas de compartidas») | Clarifications |

## Clarifications

### Session 2026-11-19

Decididas por recomendación (**por confirmar con ventas**):

- Q: ¿Qué hace la copia cuando el día de destino ya tiene asignaciones? → A: Copia solo las que faltan; salta las que ya existen iguales (misma persona, turno, horario, canal y subcanal) y avisa cuántas copió y cuántas saltó. Antes de copiar pide confirmación.
- Q: ¿Dónde se ve el error al guardar? → A: Junto a los botones (siempre visible) y, si falta un dato, el formulario lleva la vista a ese campo.
- Q: ¿El filtro Turno se elige solo? → A: Al abrir la Planificación del día de hoy, desde las 13:00 queda en «Tarde» y antes en «Todos»; se puede cambiar.

Decididas por el usuario (gerencia):

- Q: ¿La meta de compartidas por asignación sigue siendo obligatoria? → A: Pasa a ser **opcional**: se puede escribir por asignación, pero vacía no impide guardar. (El 2026-11-18 ventas pidió especificarla; el 2026-11-19 dijo que la meta es general.)
- Q: «Los subcanales al lado derecho» → A: Las dos cosas: «Canal › Subcanal» en una sola celda, y los subcanales cargados juntos (misma carga) en una sola fila.
- Q: ¿Dónde van Gerente y Sucursal? → A: Arriba, en la barra de «＋ Mañana / ＋ Tarde» («COBIJA · Gerente: Isabel Aparicio · 19/11»); con varias sucursales, una franja por sucursal con su gerente.
- Q: ¿Maqueta antes de programar? → A: No; se sigue al plan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Copiar un día sin duplicar (Priority: P1)

Quien planifica copia el día anterior (o al día siguiente) y, aunque apriete dos veces o el día ya tenga algo cargado,
cada asignación queda una sola vez.

**Why this priority**: Es la causa de tres de las quejas (duplicados, cruces que «no existen» y tener que borrar a mano).

**Independent Test**: Copiar el día anterior dos veces seguidas y ver que la segunda copia no agrega nada.

**Acceptance Scenarios**:

1. **Given** un día de destino vacío, **When** se copia el día anterior, **Then** se copian todas las asignaciones y se avisa cuántas.
2. **Given** un día de destino que ya tiene todas las asignaciones del día de origen, **When** se copia otra vez, **Then** no se agrega ninguna y se avisa que ya estaban.
3. **Given** un día de destino con algunas asignaciones cargadas a mano, **When** se copia, **Then** solo se agregan las que faltan; las cargadas a mano no cambian.
4. **Given** el botón de copiar, **When** se aprieta, **Then** primero se pide confirmación indicando de qué día a qué día se copia.
5. **Given** el botón «Guardar» del formulario, **When** se toca dos veces muy rápido, **Then** se guarda una sola vez.

---

### User Story 2 - Ver por qué no se guarda (Priority: P1)

Si falta un dato obligatorio o hay un error, quien planifica lo ve en el momento, sin tener que bajar en el formulario.

**Why this priority**: Hoy parece que «Guardar» no funciona, y eso lleva a reintentar y a duplicar.

**Independent Test**: Marcar «Compartidas redes sociales» sin meta, apretar «Guardar» y ver el aviso junto a los botones y el campo de la meta a la vista.

**Acceptance Scenarios**:

1. **Given** un dato obligatorio vacío, **When** se aprieta «Guardar», **Then** el aviso se ve junto a los botones y la vista va al campo que falta.
2. **Given** un error de la base (por ejemplo, sin conexión), **When** se aprieta «Guardar», **Then** el aviso se ve junto a los botones.
3. **Given** que se corrige el dato, **When** se vuelve a guardar, **Then** el aviso desaparece y se guarda.

---

### User Story 3 - Aviso de cruce que se entiende (Priority: P2)

Cuando una persona ya tiene otra asignación que se cruza, el aviso dice cuál es, para encontrarla.

**Independent Test**: Cargar dos asignaciones que se cruzan para la misma persona y ver en el aviso el subcanal (o canal) y el horario de la otra.

**Acceptance Scenarios**:

1. **Given** una persona con «Llamadas a clientes de recompra 16:20–19:00», **When** se carga otra a las 16:30, **Then** el aviso dice «Llamadas a clientes de recompra (16:20–19:00)».
2. **Given** una asignación igual ya guardada, **When** se intenta cargar la misma, **Then** el aviso dice que ya existe una igual.
3. **Given** el aviso, **When** se decide guardar igual, **Then** se puede (como hoy).

---

### User Story 4 - Ver solo la tarde (Priority: P3)

Por la tarde, quien abre la Planificación del día ve directamente las asignaciones de la tarde.

**Independent Test**: Abrir la Planificación de hoy después de las 13:00 y ver el filtro Turno en «Tarde».

**Acceptance Scenarios**:

1. **Given** la Planificación de hoy abierta desde las 13:00, **When** se muestra, **Then** el filtro Turno está en «Tarde».
2. **Given** antes de las 13:00, otro día o un rango de días, **When** se muestra, **Then** el filtro Turno está en «Todos».
3. **Given** el filtro elegido solo, **When** la persona lo cambia, **Then** se respeta su elección.

---

### User Story 5 - Planificación compacta (Priority: P2)

Quien revisa la Planificación en la computadora ve cada día sin datos repetidos: la sucursal, su gerente y la fecha
arriba; la persona en su franja; y por fila solo lo que cambia (horario, canal › subcanal, lugar, metas, resultado y
observaciones).

**Why this priority**: Ventas pidió que la planificación «no se haga extensa» y sea fácil de ver (2026-11-19). Hoy la
tabla tiene 15 columnas y repite gerente, sucursal, fecha y persona en cada fila.

**Independent Test**: Abrir la Planificación de Cobija del 19/11 y ver la gerente una sola vez arriba, sin columnas
Fecha, Gerente, Sucursal ni Personal, y los subcanales cargados juntos en una sola fila.

**Acceptance Scenarios**:

1. **Given** una sola sucursal y un solo día, **When** se muestra la tabla, **Then** arriba, junto a «＋ Mañana / ＋ Tarde», dice la sucursal, su gerente y la fecha, y las filas no repiten esos datos.
2. **Given** varias sucursales, **When** se muestra la tabla, **Then** cada sucursal tiene una franja con su nombre y su gerente, y debajo van sus personas.
3. **Given** un rango de varios días, **When** se muestra la tabla, **Then** la fecha se ve en la franja de cada persona (no por fila).
4. **Given** una persona, **When** se muestran sus asignaciones, **Then** su nombre aparece solo en su franja, y las volanteras (si hay) debajo del canal de esa fila.
5. **Given** una asignación, **When** se muestra, **Then** el turno va como marca junto al horario (mañana / tarde), el canal y el subcanal en una sola celda («Canal › Subcanal») y las dos metas en una sola celda.
6. **Given** una carga con varios subcanales a la misma hora para la misma persona, **When** se muestra, **Then** ocupa una sola fila con los subcanales uno al lado del otro, cada uno con su meta y su resultado, y cada uno se puede editar o borrar por separado.
7. **Given** la exportación a Excel, **When** se descarga, **Then** mantiene todas las columnas como hoy.

---

### Edge Cases

- Copiar cuando una persona del día de origen ya no está activa: no se copia (como hoy).
- Copiar cuando una asignación del día de origen difiere en algo (otra hora u otro subcanal) de una del destino: se copia, porque no es igual.
- Dos personas copian el mismo día a la vez: cada asignación queda una sola vez.
- Error con el formulario ya arriba del todo: el aviso igual se ve junto a los botones.
- El filtro Turno elegido solo no debe ocultar asignaciones sin que se note: el filtro se ve marcado.
- Una sucursal sin gerente asignado: la franja dice «Sin gerente».
- Una carga con varios subcanales en la que después se editó la hora de uno: ese ya no es igual a los otros y va en su propia fila.
- Con filtros por columna (Gerente, Sucursal, Persona…): siguen funcionando aunque esas columnas ya no se muestren.

## Requirements *(mandatory)*

### Copia sin duplicados

- **FR-001**: Copiar un día MUST saltar las asignaciones que ya existen en el destino con la misma persona, turno, hora de inicio, hora de fin, canal y subcanal.
- **FR-002**: Copiar un día MUST informar cuántas asignaciones copió y cuántas saltó por existir.
- **FR-003**: Copiar un día MUST pedir confirmación antes, con el día de origen y el de destino.
- **FR-004**: La regla de FR-001 MUST cumplirse también si dos copias del mismo día ocurren a la vez.
- **FR-005**: «Guardar» MUST ignorar un segundo toque mientras el primero se está guardando.

### Errores visibles

- **FR-006**: El aviso de error del formulario de asignación MUST verse junto a los botones, sin depender del scroll.
- **FR-007**: Si el error es un dato vacío o inválido, el formulario MUST llevar la vista a ese campo.

### Aviso de cruce

- **FR-008**: El aviso de cruce MUST nombrar el subcanal (o el canal, si no tiene) y el horario de cada asignación con la que se cruza.
- **FR-009**: Si la asignación que se carga es igual a una existente (FR-001), el aviso MUST decir que ya existe una igual.

### Filtro de turno

- **FR-010**: Al abrir la Planificación de un solo día que es hoy, desde las 13:00 (hora de Bolivia), el filtro Turno MUST quedar en «Tarde»; en otro caso, en «Todos». La persona lo puede cambiar.

### Meta de compartidas

- **FR-011**: La meta de compartidas MUST ser opcional en toda asignación (nueva, edición y carga múltiple). Si se escribe, MUST ser un entero de 0 a 9999 como hoy. La meta de captación no cambia (sigue obligatoria donde aplica).

### Planificación compacta (pantalla ancha)

- **FR-012**: La tabla MUST mostrar sucursal, gerente y fecha una sola vez: en la barra de acciones si hay una sola sucursal y un solo día; si no, en una franja por sucursal (con su gerente) y la fecha en la franja de cada persona.
- **FR-013**: La tabla MUST dejar de mostrar las columnas Fecha, Gerente, Sucursal y Personal; la persona va en su franja y las volanteras dentro de la celda del canal.
- **FR-014**: La tabla MUST mostrar el turno como marca junto al horario, canal y subcanal en una celda («Canal › Subcanal»; la estrategia se lee del canal) y las metas de captación y compartidas en una celda.
- **FR-015**: Las asignaciones de una misma carga con igual persona, día, turno y horario MUST mostrarse en una sola fila, con cada subcanal, su meta y su resultado, y acciones de editar y borrar por subcanal.
- **FR-016**: El Excel exportado y la vista de celular MUST NOT cambiar por esta historia.

### Key Entities

- **Asignación** (no cambia de datos): se define «asignación igual» como misma sucursal, día, persona, turno, hora de inicio, hora de fin, canal y subcanal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Copiar el mismo día dos veces deja 0 asignaciones repetidas en el 100 % de las pruebas.
- **SC-002**: Con un dato obligatorio vacío, el aviso es visible sin mover la pantalla en el 100 % de las pruebas (celular y computadora).
- **SC-003**: Ventas deja de reportar duplicados y «no guarda» en la semana siguiente a publicar.
- **SC-005**: La tabla del día de una sucursal pasa de 15 a 6 columnas y muestra la gerente una sola vez.
- **SC-006**: Una carga con 2 o más subcanales a la misma hora ocupa 1 fila, no una por subcanal.
- **SC-004**: Ninguna observación del grupo del 2026-11-19 queda sin respuesta (resuelta en esta spec, en el Catálogo o justificada).

## Assumptions

- Los duplicados que ya existen en producción se limpian a mano con una consulta de revisión; esta spec evita los nuevos.
- «Mensajería WhatsApp» sin meta de compartidas y «DISTRIBUCION DE TAREAS AL PERSONAL» 08:30–09:00 se cargan desde el Catálogo (no requieren código).
- «Solo encargado o supervisor» en algunos subcanales sigue como aviso en el nombre; bloquearlo por rol queda fuera de alcance.
- Fuera de alcance: una meta de compartidas «general» por persona o por día (si ventas la confirma, va en otra spec).
