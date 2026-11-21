# Feature Specification: Referidos con período, sucursales, filtros y lista de referidores ordenada

**Feature Branch**: `014-referidos-mejoras`

**Created**: 2026-11-21

**Status**: Implementada en local (2026-11-21); pendiente de publicar

**Input**: Pedido del usuario (2026-11-21) con la captura de Referidos de RURRE vacía: «en referidos no lo hemos
trabajado bien. si revisas captación hay harto trabajo… quiero un plan de mejoras para referidos, por ejemplo poder
filtrar por rango». Se aprobó el plan de 3 entregas y se pidió «desarrolla todo hasta la entrega 3».

## Contexto

Referidos (spec 005) nació como copia de la planilla de Isa: **una sucursal y un mes**. Captación siguió creciendo
(Panel con rango, Captaciones con filtros en los títulos, Actividad por sucursal con detalle, filtros en la URL) y
Referidos quedó atrás:

- Solo se puede ver un mes completo (`referral_report(p_branch, p_month)`), sin rango.
- Una sola sucursal: gerencia no compara sucursales.
- Sin filtros ni orden; la lista de contactos solo se abre por referidor.
- Los filtros viven en el estado de la pantalla: al recargar se pierden y no se puede compartir el link.
- El mensaje vacío («Agrégalos en Referidores y metas») quedó viejo: desde la spec 010 los auxiliares crean los
  referidores al registrar. El problema real es que **nadie marca referidos**, y eso no se ve.
- Captaciones y Seguimientos no muestran ni filtran «Referido por».
- Los referidores escritos en el registro pueden repetirse con variantes («Fernanda» y «Contacto Fernanda») y no se
  pueden unir (pendiente de la spec 010).

## Clarifications

### Session 2026-11-21

Decididas por recomendación (**por confirmar con ventas**, regla de trabajo en loop):

- Q: En un rango, ¿qué cuenta «Compraron»? → A: Los referidos que **llegaron en el rango** y ya compraron (aunque la
  venta sea posterior). Es la cohorte de la 005 llevada a cualquier rango: la conversión nunca pasa de 100 % y responde
  «de los que me pasaron, ¿cuántos compraron?». Las ventas por fecha de venta siguen en el Panel.
- Q: ¿Qué meta se usa en un rango que no es un mes completo? → A: La meta mensual **prorrateada por días**
  (meta × días del rango en ese mes ÷ días del mes) y marcada «prorrateada». Un mes se toma completo si el rango lo
  cubre desde el día 1 hasta su último día **o hasta hoy** (así «Este mes» muestra la meta entera, como la planilla).
- Q: ¿«Todas las sucursales» para quién? → A: Gerencia y Sistemas ven todas; el jefe de ventas con varias sucursales
  ve «Todas mis sucursales». El encargado sigue sin ver Referidos (spec 005, R7).
- Q: ¿Qué períodos? → A: Hoy · 7 días · Este mes · Mes pasado · Rango (máximo 366 días, como Captaciones). Por
  defecto «Este mes» (lo que mostraba la pantalla).
- Q: ¿Cómo se ve el «Por día» con rangos largos? → A: Una columna por día hasta 62 días; con más, una columna por mes.
- Q: Al unir dos referidores, ¿qué pasa con el que se va? → A: Sus clientes pasan al que queda (queda en el historial
  de cada ficha), sus metas pasan solo a los meses en que el que queda no tenía meta, y el que se va queda
  **desactivado y marcado «unido a…»** (no se borra: su nombre sigue en el historial). Si alguien vuelve a escribir
  ese nombre al registrar, o llega una captación sin señal que lo traía, se guarda con el que quedó.
- Q: ¿Comparación con el período anterior? → A: Sí, en las tarjetas: el mismo largo de días justo antes
  (ej.: 1–15 nov contra 17–31 oct). Solo totales.
- Q: ¿Captaciones: columna nueva o filtro escondido? → A: Columna «Referido por» con filtro en el título («Solo
  referidos» o un referidor de la sucursal elegida). En Seguimientos, un selector «Origen» como los demás filtros.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver referidos de cualquier período (Priority: P1)

La jefa de ventas elige Hoy, 7 días, Este mes, Mes pasado o un rango «desde/hasta» y ve llegados, compraron,
conversión, meta y cumplimiento de ese período.

**Independent Test**: Con referidos el 4 y el 12 de septiembre, el rango 1–10 de septiembre muestra solo el del 4 y la
meta de septiembre prorrateada a 10/30.

**Acceptance Scenarios**:

1. **Given** el reporte, **When** se elige «Rango» 1–15, **Then** cuenta los referidos que llegaron esos días y la meta se muestra prorrateada y marcada.
2. **Given** «Este mes», **When** hoy es 21, **Then** la meta es la del mes completa (como antes).
3. **Given** filtros elegidos, **When** se recarga la página o se comparte el link, **Then** se ven los mismos filtros.

### User Story 2 - Comparar sucursales (Priority: P1)

Gerencia elige «Todas las sucursales» y ve una tabla por sucursal; con un clic baja al detalle de una y vuelve.

**Acceptance Scenarios**:

1. **Given** «Todas las sucursales», **When** se abre el reporte, **Then** hay una fila por sucursal con referidores, llegados, compraron, conversión, meta y cumplimiento, y un total.
2. **Given** la tabla por sucursal, **When** se toca una sucursal, **Then** se ve su detalle por referidor, con «← Todas las sucursales» para volver.
3. **Given** un jefe de ventas con dos sucursales, **When** elige «Todas mis sucursales», **Then** solo ve las suyas; con sucursales ajenas el servidor responde prohibido.

### User Story 3 - Leer el reporte de un vistazo y ordenarlo (Priority: P1)

Arriba hay tarjetas (Llegados, Compraron, Conversión, Cumplimiento, Sin contactar) con la diferencia contra el período
anterior. La tabla se ordena tocando el título y se filtra por tipo de referidor.

**Acceptance Scenarios**:

1. **Given** el reporte, **When** se toca «Conversión», **Then** las filas se ordenan de mayor a menor; otro toque invierte.
2. **Given** el filtro «Tipo: Freelance», **When** se aplica, **Then** solo quedan los freelance y los totales se recalculan.
3. **Given** un período sin referidos, **When** se abre, **Then** el mensaje explica que nadie registró referidos y ofrece ver «Quién registra».
4. **Given** el reporte filtrado, **When** se exporta, **Then** el Excel tiene las mismas filas.

### User Story 4 - Trabajar la lista de referidos (Priority: P2)

Pestaña «Contactos»: todos los referidos del período en una lista con filtros en los títulos (referidor, etapa,
responsable, producto, registrado por). Los que siguen sin contactar muestran cuántos días llevan esperando.

**Acceptance Scenarios**:

1. **Given** la pestaña Contactos, **When** se filtra «Etapa: Sin contactar», **Then** solo quedan esos, del que más espera al que menos.
2. **Given** un contacto, **When** se toca su nombre, **Then** se abre su ficha.

### User Story 5 - Saber quién registra referidos (Priority: P2)

Pestaña «Quién registra»: por persona, captaciones registradas en el período, cuántas marcó como referidas y el
porcentaje. Así se ve si el equipo usa «Es referido».

**Acceptance Scenarios**:

1. **Given** una auxiliar con 10 captaciones y 2 referidas, **When** se abre la pestaña, **Then** su fila dice 10 · 2 · 20 %.
2. **Given** personas que registraron sin marcar ningún referido, **When** se abre, **Then** aparecen con 0 (resaltadas).

### User Story 6 - Ver el origen en Captaciones y Seguimientos (Priority: P2)

**Acceptance Scenarios**:

1. **Given** Captaciones, **When** se filtra «Referido por: Solo referidos», **Then** solo se listan captaciones con referidor y la columna muestra de quién.
2. **Given** una sucursal elegida, **When** se filtra por un referidor, **Then** solo se listan los suyos (y el Excel también).
3. **Given** Seguimientos, **When** se elige «Origen: Solo referidos», **Then** pestañas y lista cuentan solo referidos.

### User Story 7 - Ordenar la lista de referidores (Priority: P3)

En «Referidores y metas»: buscador, filtro (Todos · Agregados en el registro · Desactivados · Unidos), unir un
referidor con otro, copiar las metas del mes anterior y editar todas las metas a la vez.

**Acceptance Scenarios**:

1. **Given** «Fernanda» (agregado en el registro) y «Contacto Fernanda», **When** la jefa une «Fernanda» con «Contacto Fernanda», **Then** los clientes de Fernanda pasan a Contacto Fernanda, Fernanda queda «unido a Contacto Fernanda» y el reporte los suma juntos.
2. **Given** un referidor unido, **When** una auxiliar escribe «fernanda» al registrar, **Then** la captación se guarda con «Contacto Fernanda».
3. **Given** un mes sin metas propias, **When** se toca «Copiar metas de octubre», **Then** se guardan como metas propias del mes.
4. **Given** «Editar todas las metas», **When** se cambian varias y se guarda, **Then** se guardan juntas en una sola operación.

### Edge Cases

- Rango mayor a 366 días o «hasta» antes de «desde»: «hasta» se corrige a «desde» (como el Panel); el servidor rechaza más de 366.
- Unir un referidor consigo mismo, con uno de otra sucursal o con uno ya unido: se rechaza.
- Un referidor unido no se puede editar ni reactivar (se muestra en el filtro «Unidos»).
- «Todas las sucursales» no muestra la grilla por referidor (los referidores son de cada sucursal); muestra la tabla por sucursal.
- Un referido de una sucursal que después se desactiva sigue contando en «Todas».

## Requirements *(mandatory)*

### Reporte

- **FR-001**: El reporte MUST aceptar los períodos Hoy, 7 días, Este mes, Mes pasado y Rango (desde/hasta, ≤ 366 días).
- **FR-002**: Los conteos MUST ser los de la spec 005 (cohorte por fecha de llegada en La Paz, solo fichas activas) aplicados al rango.
- **FR-003**: La meta del rango MUST ser la suma, por mes tocado, de la meta vigente de ese mes completa (si el rango cubre el mes hasta su fin o hasta hoy) o prorrateada por días; MUST marcarse cuando hay prorrateo.
- **FR-004**: Gerencia y Sistemas MUST poder ver todas las sucursales; el jefe de ventas, todas las suyas a la vez. El permiso MUST verificarse en el servidor.
- **FR-005**: Con varias sucursales, el reporte MUST mostrar una fila por sucursal y permitir bajar al detalle y volver.
- **FR-006**: El reporte MUST mostrar tarjetas de Llegados, Compraron, Conversión, Cumplimiento y Sin contactar, con la diferencia contra el período anterior del mismo largo.
- **FR-007**: La tabla por referidor MUST ordenarse por cualquier columna y filtrarse por tipo; los totales MUST respetar el filtro.
- **FR-008**: «Por día» MUST mostrar una columna por día hasta 62 días y una por mes en rangos mayores.
- **FR-009**: Período, sucursal, sección, vista, filtros y orden MUST guardarse en la URL.
- **FR-010**: El Excel MUST respetar período, sucursal y filtros, y sumar las hojas Contactos y Quién registra (y Sucursales con varias sucursales).

### Contactos y uso

- **FR-011**: La pestaña Contactos MUST listar todos los referidos del período con nombre, sucursal (con varias), referidor, producto, responsable, registrado por, etapa, llegada, venta y días esperando (sin contactar), con filtros en los títulos.
- **FR-012**: La pestaña Quién registra MUST mostrar por persona: captaciones del período, referidas y porcentaje, de mayor a menor.
- **FR-013**: Captaciones MUST mostrar la columna «Referido por» y filtrar por «Solo referidos» o por un referidor (con sucursal elegida). Seguimientos MUST filtrar por origen «Solo referidos». Los dos Excel MUST respetar el filtro.

### Referidores

- **FR-014**: La lista de referidores MUST tener buscador y filtro por origen/estado.
- **FR-015**: El jefe a cargo, gerencia y Sistemas MUST poder unir un referidor con otro de la misma sucursal; la unión MUST mover los clientes (con historial), mover metas sin pisar las del destino y dejar el origen desactivado y marcado.
- **FR-016**: Una captación que llega con un referidor unido (por id o por nombre) MUST guardarse con el referidor destino.
- **FR-017**: MUST poder copiarse las metas del mes anterior y editarse todas las metas del mes juntas.

### Compatibilidad

- **FR-018**: Todo MUST ser aditivo: la app publicada (que usa `referral_report` y no manda los filtros nuevos) sigue funcionando igual.

## Success Criteria *(mandatory)*

- **SC-001**: Gerencia ve los referidos de todas las sucursales de un rango cualquiera en menos de 30 segundos y sin Excel.
- **SC-002**: Un link de Referidos con filtros abre exactamente la misma vista en otro dispositivo.
- **SC-003**: Un jefe identifica en una sola pantalla quién del equipo no está marcando referidos.
- **SC-004**: Dos referidores duplicados se unen en menos de 30 segundos y el reporte los suma desde ese momento.
