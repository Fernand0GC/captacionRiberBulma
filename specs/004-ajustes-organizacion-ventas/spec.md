# Feature Specification: Ajustes de la organización comercial pedidos por ventas

**Feature Branch**: `004-ajustes-organizacion-ventas`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Observaciones del área de ventas sobre el formulario «Nueva asignación» de la Planificación (spec 003), recibidas por WhatsApp el 2026-11-18: faltan subcanales y se deben poder añadir a mano; tiene que ser con selección múltiple; plaza; especificar la meta de captación; especificar las compartidas en Barrio chino y WhatsApp; debe especificar metas de compartidas; permitir meter la actividad que debe realizar en tienda, ya que no todas están ahí."

## Contexto

La spec 003 llevó la organización diaria de ventas a la app: cada asignación une turno, persona, estrategia, canal
y **un** subcanal, con **una** meta y **un** resultado sin unidad. Ventas la probó y pidió seis ajustes:

1. **Faltan subcanales y actividades de tienda.** Hoy solo el administrador puede agregarlos (FR-027 de la 003),
   así que quien planifica no puede cargar una actividad que no está en la lista.
2. **Selección múltiple.** Una persona trabaja varios subcanales en el mismo horario (por ejemplo, Mensajería
   WhatsApp y Barrios chinos – grupos de 08:30 a 12:30) y hoy hay que cargar una asignación por cada uno.
3. **Meta de captación.** La meta actual no dice qué mide.
4. **Metas de compartidas.** En «Compartidas y estados» lo que se cuenta son compartidas, no captaciones.
5. **Compartidas en Barrio chino y WhatsApp.** Esos subcanales están en RRSS-Mensajería, que hoy no lleva meta
   (FR-030 de la 003), así que no se puede indicar cuántas compartidas se esperan.
6. **Plaza.** Mencionado sin más detalle (ver Clarifications).

Esta feature **modifica** la organización de la 003; no crea una pantalla nueva.

## Clarifications

### Session 2026-11-18

- Q: ¿De quién son las observaciones? → A: Del área de ventas (quienes planifican). Fernando solo las reenvió.
- Q: ¿Quién puede agregar subcanales desde el formulario? → A: Todos los que planifican (encargado, supervisor de campo, jefe de ventas, gerencia y administrador). *Decidido por recomendación el 2026-11-18; por confirmar con ventas.*
- Q: ¿Las metas son obligatorias? → A: Sí, cuando el subcanal (o el canal, si no hay subcanal) usa esa meta. *Decidido por recomendación; por confirmar con ventas.*
- Q: ¿Qué es «Plaza»? → A: Queda fuera de esta entrega hasta que ventas lo aclare. Si resulta ser una actividad nueva, se agrega con «+ Agregar otro…» sin desarrollo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Indicar meta de captación y meta de compartidas (Priority: P1)

Quien planifica carga una asignación y, según el subcanal, indica cuántos contactos debe captar la persona,
cuántas compartidas debe hacer, o ambas cosas. Al cerrar el día registra el resultado de cada una por separado.

**Why this priority**: Es el pedido que más se repite (puntos 3, 4 y 5) y sin él no se puede medir el trabajo de
compartidas, que hoy se planifica sin número.

**Independent Test**: Crear una asignación en «Mensajería WhatsApp» con meta de captación 20 y de compartidas 15,
registrar resultados 18 y 15, y ver el cumplimiento de cada meta por separado.

**Acceptance Scenarios**:

1. **Given** un subcanal marcado con meta de captación y de compartidas, **When** quien planifica abre el formulario, **Then** ve dos campos con nombre claro: «Meta de captación (contactos)» y «Meta de compartidas».
2. **Given** «Compartidas y estados», marcado solo con meta de compartidas, **When** se elige, **Then** solo aparece «Meta de compartidas».
3. **Given** «Tareas administrativas», sin metas, **When** se elige, **Then** no aparece ningún campo de meta.
4. **Given** una asignación con las dos metas, **When** se registra el resultado, **Then** se piden «Captados» y «Compartidas» por separado y se muestra el cumplimiento de cada uno.
5. **Given** asignaciones guardadas antes de este cambio, **When** se ven, **Then** su meta y resultado aparecen como meta y resultado de captación.

---

### User Story 2 - Elegir varios subcanales en una sola carga (Priority: P1)

Quien planifica elige un canal, marca varios de sus subcanales y pone las metas de cada uno, todo con la misma
persona, turno y horario, y lo guarda de una vez.

**Why this priority**: Es la carga diaria más común en Tienda (una persona atiende varias redes a la vez) y hoy
obliga a repetir el formulario por cada subcanal.

**Independent Test**: En RRSS-Mensajería marcar «Mensajería WhatsApp» y «Barrios chinos – grupos», poner metas
distintas a cada uno, guardar y ver que cada subcanal queda con sus metas y su resultado propios.

**Acceptance Scenarios**:

1. **Given** un canal elegido, **When** quien planifica abre la lista de subcanales, **Then** puede marcar uno o varios.
2. **Given** dos subcanales marcados, **When** pone las metas, **Then** cada subcanal tiene sus propios campos de meta según sus marcas.
3. **Given** subcanales marcados con horarios sugeridos distintos, **When** se eligen, **Then** se propone el horario del primero marcado y el usuario puede cambiarlo; el horario es uno solo para todos.
4. **Given** una carga con tres subcanales guardada, **When** se ve la organización, **Then** se distingue que pertenecen a la misma carga, y el resultado se registra por subcanal.
5. **Given** una carga con varios subcanales, **When** se edita o elimina uno, **Then** los demás no cambian.
6. **Given** un canal sin subcanales elegidos, **When** se guarda, **Then** queda una asignación solo con el canal, como hoy.

---

### User Story 3 - Agregar un subcanal o actividad que falta desde el formulario (Priority: P2)

Quien planifica no encuentra la actividad en la lista, elige «+ Agregar otro…», escribe el nombre y la usa en la
asignación. Desde ahí la actividad queda disponible para las siguientes cargas.

**Why this priority**: Ventas no puede esperar a sistemas para planificar una actividad nueva (puntos 1 y 7). Va
después de las metas porque, mientras tanto, el administrador sí puede agregarla desde el Catálogo.

**Independent Test**: En Tienda → Tareas administrativas, agregar «Kardex de ventas» desde el formulario, guardar
la asignación y verlo ofrecido en la carga siguiente.

**Acceptance Scenarios**:

1. **Given** el formulario con un canal elegido, **When** quien planifica elige «+ Agregar otro…» y escribe un nombre, **Then** el subcanal se crea en ese canal y queda marcado.
2. **Given** un nombre que ya existe en ese canal (sin importar mayúsculas, tildes ni espacios), **When** se intenta agregar, **Then** el sistema usa el existente en vez de crear un duplicado.
3. **Given** un subcanal agregado por quien planifica, **When** el administrador entra al Catálogo, **Then** lo ve marcado como agregado por ventas, con quién y cuándo, y puede renombrarlo, ponerle horario y metas o desactivarlo.
4. **Given** una persona sin permiso para agregar subcanales (FR-013), **When** abre la lista, **Then** no ve «+ Agregar otro…».

---


### Edge Cases

- Un subcanal cambia sus marcas de meta después de tener asignaciones: las asignaciones guardadas conservan sus metas; el cambio vale para las nuevas.
- Se desmarca un subcanal al editar una carga de varios: solo se elimina esa asignación, con registro de quién lo hizo (FR-020 de la 003).
- Copiar el día (FR-016 de la 003) copia las dos metas de cada asignación, sin resultados.
- Se marcan subcanales y uno ya está asignado a la misma persona en un horario que se cruza: se avisa sin impedir el guardado (FR-015 de la 003).
- Un subcanal agregado por ventas con nombre muy corto o vacío: se rechaza con el mismo límite del catálogo (2 a 80 caracteres).
- El encargado edita el día mismo de la asignación: aplican los límites de FR-029 de la 003 a ambas metas.

## Requirements *(mandatory)*

### Metas

- **FR-001**: Cada asignación MUST poder tener dos metas: **meta de captación** (contactos) y **meta de compartidas**, ambas enteros de 0 a 9999, y un resultado para cada una.
- **FR-002**: Cada subcanal MUST indicar si usa meta de captación, meta de compartidas, ambas o ninguna. Esta marca reemplaza a la marca «lleva meta» por canal (FR-030 de la 003). Una asignación sin subcanal MUST usar la marca de su canal.
- **FR-003**: El formulario MUST mostrar solo los campos de meta que corresponden y la base MUST guardar vacíos los que no correspondan.
- **FR-004**: Las metas MUST ser obligatorias cuando el subcanal (o el canal, si la asignación no tiene subcanal) las usa; el formulario y la base MUST rechazar guardar sin ellas. Las asignaciones anteriores al cambio no se ven afectadas.
- **FR-005**: El catálogo inicial MUST marcar: Barrios chinos – grupos y Mensajería WhatsApp con captación y compartidas; Compartidas y estados solo con compartidas; Tareas administrativas sin metas; los subcanales de canales que hoy llevan meta, solo con captación; Mensajería Facebook, Marketplace y TikTok y los Comentarios, sin metas (se respeta lo aclarado en la 003: «no tienen una meta como tal»). El administrador MUST poder cambiar estas marcas desde el Catálogo.
- **FR-006**: Las asignaciones existentes MUST conservar su meta y su resultado como meta y resultado de captación.
- **FR-007**: El cumplimiento (FR-019 de la 003) MUST mostrarse por separado para captación y compartidas.
- **FR-008**: La tabla MUST mostrar totales separados de meta y resultado de captación y de compartidas (reemplaza FR-023 de la 003), y la exportación a Excel MUST incluir las cuatro columnas (amplía FR-024 de la 003).

### Selección múltiple

- **FR-009**: El formulario de nueva asignación MUST permitir marcar uno o varios subcanales del canal elegido.
- **FR-010**: Al guardar, el sistema MUST crear una asignación por cada subcanal marcado, con la misma fecha, sucursal, turno, persona, estrategia, canal, horario y lugar, y las metas propias de cada subcanal.
- **FR-011**: Las asignaciones creadas juntas MUST mostrarse agrupadas en la organización, y cada una MUST poder editarse, eliminarse y recibir su resultado de forma independiente.
- **FR-012**: Todas las asignaciones de una misma carga MUST guardarse juntas: si una falla, no se guarda ninguna.

### Subcanales agregados por ventas

- **FR-013**: El formulario MUST ofrecer «+ Agregar otro…» en la lista de subcanales para crear un subcanal nuevo en el canal elegido. Pueden hacerlo todos los que planifican la sucursal: encargado, supervisor de campo, jefe de ventas a cargo, gerente general y administrador.
- **FR-014**: El sistema MUST evitar duplicados: si ya existe un subcanal con el mismo nombre en ese canal (comparando sin mayúsculas, tildes ni espacios extra), MUST usar el existente; si estaba desactivado, MUST avisar y no reactivarlo sin el administrador.
- **FR-015**: Un subcanal agregado desde el formulario MUST quedar activo, sin horario sugerido y con meta de captación; MUST registrar quién lo creó y cuándo.
- **FR-016**: El administrador MUST poder ver en el Catálogo cuáles subcanales agregó ventas y editarlos como cualquier otro. Esto amplía FR-027 de la 003: el administrador sigue siendo el único que renombra, reordena, desactiva y cambia marcas.

### Permisos

- **FR-017**: Los permisos MUST seguir aplicándose en el servidor en cada operación (FR-028 de la 003), incluida la creación de subcanales.

### Key Entities *(include if feature involves data)*

- **Subcanal** (cambia): agrega marcas «usa meta de captación» y «usa meta de compartidas», y origen (catálogo o agregado por ventas, con quién y cuándo).
- **Canal** (cambia): su marca «lleva meta» pasa a ser «metas por defecto» para asignaciones sin subcanal.
- **Asignación** (cambia): meta y resultado pasan a ser meta y resultado de captación; se agregan meta y resultado de compartidas, y una referencia a la carga con la que se creó.
- **Carga** (nueva, solo como agrupador): el conjunto de asignaciones creadas en un mismo guardado con selección múltiple.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona con 4 subcanales en el mismo horario se planifica en una sola carga del formulario, en menos de 1 minuto.
- **SC-002**: El 100 % de las asignaciones de «Compartidas y estados», «Barrios chinos – grupos» y «Mensajería WhatsApp» cargadas después del cambio pueden tener meta de compartidas.
- **SC-003**: Un gerente obtiene por separado el total de captaciones y el de compartidas de sus sucursales para una semana en menos de 30 segundos.
- **SC-004**: Ventas planifica una actividad que no estaba en la lista el mismo día, sin pedirla a sistemas.
- **SC-005**: Un mes después de salir a producción, no hay en el catálogo dos subcanales del mismo canal con el mismo nombre escrito distinto.
- **SC-006**: Ninguna asignación anterior al cambio pierde su meta ni su resultado.

## Assumptions

- «Especificar las compartidas en Barrio chino y WhatsApp» significa poder poner una meta (y registrar el resultado) de compartidas en esos subcanales. En qué grupos o estados se comparte se anota en observaciones; no se crea una lista de grupos.
- La selección múltiple es dentro de un mismo canal. Para subcanales de canales distintos se hace otra carga.
- Varias asignaciones de una carga comparten un solo horario; si un subcanal necesita otro horario, se carga aparte.
- El resultado de captación y de compartidas se sigue escribiendo a mano; no se cuenta desde las captaciones (igual que en la 003).
- Las actividades de tienda que faltan (punto 7) se resuelven agregando subcanales; no se crea otro tipo de registro.
- Fuera de alcance: «Plaza» (pendiente de aclaración de ventas), lista de grupos de WhatsApp o de Barrio chino, metas por sucursal o por mes, unificación con el catálogo de captaciones.
- Depende de la spec 003, en producción desde el 2026-11-17 (commit `b7b02a3`, con las marcas «Pide ubicación» y «Lleva meta» y el canal Tareas administrativas).
- Cada push a `main` publica la app al instante en Vercel: las migraciones de esta feature deben estar en producción antes del push, o el cambio debe funcionar en cualquier orden.
