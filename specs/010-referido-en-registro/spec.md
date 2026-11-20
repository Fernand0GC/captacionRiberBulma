# Feature Specification: Marcar el referido al registrar (auxiliares)

**Feature Branch**: `010-referido-en-registro`

**Created**: 2026-11-20

**Status**: Implementada en local (2026-11-20); pendiente de publicar

**Input**: Observación de ventas (Isabel Aparicio, jefe de ventas, 2026-11-20) con la captura de Referidos de COBIJA en
cero: «Para poder tener este reporte sería bueno implementar en el usuario del registro de los auxiliares la opción de
poder poner que el cliente viene de un referido y el nombre del referido».
Maqueta del formulario: https://claude.ai/artifact/5a7iP5dURzfyD4W67YBJuf

## Contexto

Los reportes ya existen y leen el referidor de cada cliente: Referidos por mes (spec 005) y «Del día» con el filtro
«Solo referidos» (spec 009). Lo que falla es la entrada del dato:

- La casilla «Es referido» del formulario de registro **solo aparece si la sucursal tiene referidores cargados**, y esa
  lista la arma el jefe de ventas en «Referidores y metas».
- En producción ninguna sucursal cargó la lista, así que **ningún auxiliar ve la casilla** y todos los reportes de
  referidos están en cero.
- Aun con lista, el auxiliar **solo puede elegir**; si quien recomendó no está, no lo puede anotar.

Esta spec quita esa dependencia: el auxiliar marca el referido siempre y, si hace falta, escribe el nombre de quien lo
recomendó. Los reportes no cambian.

## Clarifications

### Session 2026-11-20

Decididas por recomendación (**por confirmar con ventas**):

- Q: ¿«El nombre del referido» es el cliente o quien lo recomendó? → A: Quien lo **recomendó** (el referidor). El nombre del cliente ya se pide en el formulario. La pregunta en pantalla lo dice de forma explícita.
- Q: ¿El auxiliar escribe el nombre o lo elige de una lista? → A: Las dos: escribe, la app sugiere los que ya existen en su sucursal y, si no está, lo agrega.
- Q: ¿Se guarda como texto libre en el cliente? → A: No. El nombre nuevo se guarda como **referidor de la sucursal**, para que el reporte sume por referidor y los demás auxiliares lo encuentren.
- Q: ¿Qué se pide de un referidor nuevo? → A: Nombre y tipo (cliente, personal, freelance u otro). El tipo «canal o app» queda para la pantalla del jefe.
- Q: ¿Qué pasa con dos nombres casi iguales? → A: Mismo nombre sin distinguir mayúsculas, tildes ni espacios de más es el mismo referidor. Variantes distintas («Fernanda» y «Contacto Fernanda») las une el jefe en una entrega posterior.
- Q: ¿Canal «Referidos» en «Canal de hoy»? → A: Descartado para esta spec: cambia el flujo diario y toca la decisión de gerencia del 2026-11-03 sobre los canales de referencia.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Marcar el referido aunque la sucursal no tenga lista (Priority: P1)

Un auxiliar de una sucursal sin referidores cargados registra un cliente, marca que viene recomendado y escribe quién
lo recomendó.

**Why this priority**: Es la observación de ventas. Sin esto no entra ningún dato y los reportes siguen en cero.

**Independent Test**: En COBIJA (sin lista), registrar a un cliente como referido por «Doña Susi» (cliente) y verlo en
Referidos de COBIJA con 1 llegado.

**Acceptance Scenarios**:

1. **Given** una sucursal sin referidores, **When** el auxiliar abre «Nueva captación», **Then** ve la casilla de referido.
2. **Given** la casilla marcada, **When** escribe un nombre que no existe y elige el tipo, **Then** al guardar el cliente queda con ese referidor y el referidor queda en la lista de la sucursal.
3. **Given** la casilla marcada, **When** intenta guardar sin indicar quién lo recomendó, **Then** el formulario se lo pide y no guarda.
4. **Given** la casilla sin marcar, **When** guarda, **Then** el registro es igual que hoy (solo nombre y celular obligatorios).
5. **Given** un referido registrado así, **When** el jefe abre Referidos y «Del día» con «Solo referidos», **Then** el cliente cuenta en los dos.

---

### User Story 2 - Elegir un referidor que ya existe (Priority: P1)

Al escribir, la app sugiere los referidores activos de la sucursal y el auxiliar elige uno sin escribirlo entero.

**Why this priority**: Evita nombres repetidos y es más rápido que escribir.

**Independent Test**: Con «Contacto Fernanda» en la lista, escribir «fer», elegir la sugerencia y guardar; el reporte
suma en «Contacto Fernanda» y no se crea otro referidor.

**Acceptance Scenarios**:

1. **Given** referidores en la sucursal, **When** el auxiliar escribe parte del nombre, **Then** ve las coincidencias con su tipo.
2. **Given** un nombre escrito igual a uno existente salvo mayúsculas, tildes o espacios, **When** guarda, **Then** se usa el existente.
3. **Given** dos auxiliares que agregan el mismo nombre nuevo casi a la vez, **When** ambos guardan, **Then** queda un solo referidor con los dos clientes.

---

### User Story 3 - Registrar sin señal (Priority: P1)

El auxiliar registra en campo sin conexión un cliente referido por alguien nuevo; al sincronizar, cliente y referidor
quedan guardados juntos.

**Why this priority**: Principio I de la constitución: el registro de campo no depende de la señal.

**Independent Test**: Sin conexión, registrar un referido con referidor nuevo; al volver la señal, el cliente aparece
con su referidor y el referidor en la lista.

**Acceptance Scenarios**:

1. **Given** el celular sin señal, **When** guarda un referido con referidor nuevo, **Then** queda en el dispositivo y se sincroniza después sin pasos extra.
2. **Given** un envío que se repite por mala señal, **When** llega dos veces, **Then** no se duplica ni el cliente ni el referidor.
3. **Given** un referidor recién agregado sin señal, **When** registra otro cliente del mismo referidor antes de sincronizar, **Then** puede volver a elegirlo.

---

### User Story 4 - El jefe ve y corrige lo que agregan los auxiliares (Priority: P2)

En «Referidores y metas», el jefe de ventas distingue los referidores agregados desde el registro, con quién y cuándo,
y puede renombrarlos, cambiarles el tipo o desactivarlos como hoy.

**Why this priority**: Mantiene ordenada la lista sin frenar el registro. Se puede publicar después de las historias 1 a 3.

**Independent Test**: Tras el registro de la historia 1, el jefe ve «Doña Susi» marcada como agregada por el auxiliar y
la renombra; el reporte muestra el nombre nuevo.

**Acceptance Scenarios**:

1. **Given** un referidor agregado desde el registro, **When** el jefe abre la lista, **Then** lo ve identificado con quién lo agregó y la fecha.
2. **Given** ese referidor, **When** el jefe lo renombra o cambia el tipo, **Then** el reporte lo refleja para todo su historial.

---

### Edge Cases

- El nombre escrito coincide con un referidor **desactivado**: el cliente se guarda con ese referidor y el referidor sigue desactivado (no se ofrece en sugerencias); el jefe decide si lo reactiva.
- Una persona supera el tope diario de referidores nuevos: el cliente **se guarda igual**, sin referidor, y la app le deja un aviso con el cliente y el nombre escrito para que el jefe lo complete. Nunca se pierde una captación por este tope.
- Nombre de menos de 2 o más de 60 caracteres, o tipo sin elegir: el formulario lo pide antes de guardar.
- Quien registra sin sucursal propia (jefe, gerencia, Sistemas): sugerencias y referidor nuevo son de la sucursal elegida para registrar.
- El cliente resulta duplicado por celular: se aplica la regla de hoy (el duplicado no cuenta en el reporte); si el referidor era nuevo, igual queda creado.
- La app publicada antes de este cambio sigue registrando sin errores.

## Requirements *(mandatory)*

### Registro

- **FR-001**: El formulario de registro MUST mostrar siempre la opción de marcar al cliente como referido, tenga o no referidores la sucursal.
- **FR-002**: Al marcarla, el sistema MUST pedir quién lo recomendó, con un texto que deje claro que es la persona que lo mandó y no el cliente.
- **FR-003**: El sistema MUST sugerir, mientras se escribe, los referidores activos de la sucursal donde se registra, también sin conexión.
- **FR-004**: Quien registra MUST poder indicar un referidor que no existe, con nombre (2 a 60 caracteres) y tipo (cliente, personal, freelance u otro).
- **FR-005**: Indicar el referidor MUST ser obligatorio cuando se marca la opción y no pedirse cuando no se marca.

### Guardado

- **FR-006**: El cliente y su referidor nuevo MUST guardarse en una sola operación: se guardan los dos o ninguno.
- **FR-007**: Un nombre que coincide con un referidor de la misma sucursal, sin distinguir mayúsculas, tildes ni espacios repetidos, MUST usar ese referidor en vez de crear otro, también ante registros simultáneos.
- **FR-008**: El registro con referidor nuevo MUST funcionar sin conexión y sincronizarse después, y repetir el envío MUST NOT duplicar datos.
- **FR-009**: Quien registra MUST poder crear referidores solo por esta vía y solo en la sucursal donde registra; la verificación MUST hacerse en el servidor (principio IV).
- **FR-010**: El sistema MUST limitar los referidores nuevos por persona y día (10). Superado el tope, MUST guardar la captación sin referidor y avisar a quien registra con el cliente y el nombre escrito (la ficha no tiene campo de notas; ver plan R6).
- **FR-011**: La versión anterior de la app MUST seguir registrando sin cambios.

### Lista del jefe

- **FR-012**: «Referidores y metas» MUST identificar los referidores agregados desde el registro, con quién los agregó y cuándo.
- **FR-013**: Administrar la lista (renombrar, tipo, orden, metas, desactivar) MUST seguir reservado a jefe de ventas, gerencia y Sistemas, como en la spec 005.

### Reportes

- **FR-014**: Los clientes registrados así MUST contar en Referidos y en «Del día» con las reglas actuales, sin cambios en esos reportes.

### Key Entities *(include if feature involves data)*

- **Referidor** (cambia): puede nacer desde el registro de una captación; se sabe quién lo agregó, cuándo y por qué vía (registro o pantalla del jefe).
- **Captación** (sin cambios de estructura): sigue guardando su referidor, opcional.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un auxiliar de una sucursal sin lista registra un cliente referido en menos de 15 segundos más que un registro normal.
- **SC-002**: El 100 % de los referidos registrados aparece en Referidos y en «Del día» sin intervención del jefe.
- **SC-003**: En las pruebas, escribir un nombre existente con otras mayúsculas, tildes o espacios nunca crea un referidor repetido.
- **SC-004**: A las 2 semanas de publicar, las sucursales que captan referidos tienen registros con referidor (hoy: 0 en todas).
- **SC-005**: Ninguna captación se pierde ni se rechaza por causa del referidor en las pruebas sin conexión.

## Assumptions

- «Nombre del referido» es quien recomendó al cliente (por confirmar con Isabel; la maqueta lo muestra).
- Los referidores siguen siendo de cada sucursal y no reciben pago ni premio (spec 005).
- Corregir el referidor de un cliente ya registrado sigue como hoy: lo hacen encargado, jefe o gerencia eligiendo de la lista.
- Fuera de alcance: unir dos referidores que son la misma persona (entrega siguiente, cuando haya datos reales), canal «Referidos» en «Canal de hoy», marcar referidos en clientes ya registrados de forma masiva, y contar referidos rechazados por celular repetido (spec futura de Recompra).
- Dependencia: specs 005 (referidores y reporte) y 009 («Del día»), ya publicadas.
- Publicación como siempre: primero el SQL en producción y después la app.
