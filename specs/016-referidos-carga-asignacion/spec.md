# Feature Specification: Cargar y asignar referidos desde la oficina, y su seguimiento

**Feature Branch**: `016-referidos-carga-asignacion`

**Created**: 2026-11-21

**Status**: Implementada en local (2026-11-21); pendiente de publicar

**Input**: Pedido del usuario (2026-11-21) con tres maquetas aprobadas:
- «Asignados del día» llevado a Referidos: https://claude.ai/artifact/8gR9dEno6jDCECGFeZ3dTv
- Caso de uso: «Jessica es la supervisora nacional de ventas, pide referidos al personal y debe asignarlos a la
  auxiliar de venta de su sucursal o sus sucursales (puede llevar 2 o más)».
- Maqueta con la interfaz real: https://claude.ai/artifact/GzKQt7jcyoSEGrAo3n1tPs — «si arma la spec 016 y desarróllalo en loop».

## Contexto

Hoy un referido entra de una sola forma: la persona que registra marca «Es referido» en Registrar, un cliente a la
vez, y queda sin responsable hasta que alguien lo reparte. Cuando el personal le pasa contactos por WhatsApp a la
jefa de ventas, ella tiene que registrar uno por uno y después ir a Captaciones a asignarlos. Además:

- La auxiliar que recibe el cliente no sabe que viene recomendado ni quién se lo asignó.
- En Referidos, tocar un referidor solo despliega una tablita; no se ve si los referidos ya fueron contactados,
  quién los atiende ni a qué etapa pasaron (lo que sí muestra «Asignados del día» en Actividad, spec 012).

Jessica = rol «Jefe de ventas» (`sales_lead`) con varias sucursales en `profile_branches`. El servidor ya tiene casi
todo: `submit_capture` (con referidor, limita al jefe a sus sucursales), `assign_prospects` (con historial en
`assignment_events`) y `referral_report_range`.

## Clarifications

### Session 2026-11-21

Decididas por recomendación (**por confirmar con ventas**, regla de trabajo en loop):

- Q: ¿Dónde se carga? → A: Pestaña nueva **«Cargar»** en `/referidos` (solo jefe de ventas, gerencia y Sistemas,
  igual que el resto de Referidos). No en Registrar: Registrar es del personal de campo y funciona sin señal; la carga
  en lote es de oficina y necesita conexión.
- Q: ¿Una carga puede mezclar sucursales? → A: **No.** Cada carga es de una sucursal, porque referidores y
  responsables son por sucursal. Si la página está en «Todas mis sucursales», la pestaña pide elegir una.
- Q: ¿A quién se puede asignar? → A: A los mismos que `assign_prospects` acepta: auxiliares, supervisores y encargado
  activos de esa sucursal.
- Q: ¿Asignación por defecto? → A: **Repartir parejo entre los auxiliares**, empezando por el que tiene menos
  pendientes (referidos y no referidos en Captación sin ningún contacto). Supervisor y encargado solo a mano. Con un
  solo auxiliar, todos van a él. Se puede elegir «Todos a una persona» o cambiar cada fila.
- Q: ¿Quién queda como «Registró»? → A: Quien carga (la jefa). «Quién registra» lo muestra así.
- Q: ¿Canal de la captación? → A: Ninguno (los canales «Referencia del personal/clientes» están inactivos). El
  origen queda en el referidor.
- Q: ¿Celular repetido? → A: Se avisa en la fila antes de guardar (consulta al servidor y repetidos dentro de la misma
  carga). Si igual se guarda, el servidor lo registra como duplicado rechazado (como Registrar) y no se asigna. El
  aviso solo nombra al cliente y a su responsable si quien carga maneja esa sucursal; si no, solo dice la sucursal.
- Q: ¿Pegar de WhatsApp? → A: Sí. Una línea por contacto; se toma el primer celular válido de la línea y el resto
  es el nombre. Siempre se revisa en la tabla antes de guardar.
- Q: ¿Tope por carga? → A: 50 contactos (el límite de `submit_capture` es 120 por minuto).
- Q: ¿Cómo se entera la auxiliar? → A: En Mis contactos, la tarjeta y la fila muestran «Referido por X» y
  «te lo asignó Y» (si lo asignó otra persona). No hay notificación nueva.
- Q: ¿Ventana de detalle? → A: Tocar el nombre de un referidor en el Reporte abre una ventana (como «Asignados del
  día»): Llegaron, Contactados, Sin contactar (con «el que más espera»), Compraron; «Quién los atiende» (en vez de
  «De dónde vienen», porque un referido siempre entra en Captación); «A qué proceso pasaron» con los mismos grupos y
  colores de la 012; lista con el último contacto y Excel. Reemplaza la tablita desplegable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cargar y asignar referidos en lote (Priority: P1)

Jessica recibe por WhatsApp los contactos que le pasó un vendedor. En Referidos › Cargar elige la sucursal, quién los
pasó, pega el mensaje (o escribe), revisa la tabla y toca «Guardar y asignar». Los clientes quedan registrados como
referidos de esa persona y asignados.

**Independent Test**: Con jefe.ventas (VERDOLAGO y TRINIDAD), cargar 3 contactos de un referidor de VERDOLAGO con
«Repartir parejo»; los 3 aparecen en Referidos › Contactos con responsable y «Registrado por: Jefe de Ventas Prueba».

**Acceptance Scenarios**:

1. **Given** «Todas mis sucursales», **When** se abre «Cargar», **Then** pide elegir una sucursal (solo las suyas).
2. **Given** una sucursal, **Then** «¿Quién te pasó los contactos?» sugiere los referidores activos de esa sucursal y deja agregar uno nuevo con su tipo.
3. **Given** un mensaje pegado con nombres y celulares, **When** se toca «Leer contactos», **Then** la tabla se llena con una fila por línea con celular válido.
4. **Given** un celular que ya existe, **Then** la fila avisa y no cuenta para guardar; dos filas con el mismo celular también avisan.
5. **Given** «Repartir parejo» y 2 auxiliares (uno con 3 pendientes y otro con 0), **When** se cargan 3, **Then** la propuesta da 3 al de 0 pendientes o los reparte para emparejar, y la lista muestra «+N ahora».
6. **Given** se cambia el responsable de una fila, **Then** esa fila conserva la elección y las demás se reparten.
7. **When** se guarda, **Then** un aviso dice cuántos se guardaron y a quién; la tabla se limpia y queda el mismo referidor para seguir cargando.
8. **Given** un jefe de ventas, **When** intenta cargar en una sucursal que no es suya (por la API), **Then** el servidor responde `forbidden`.

### User Story 2 - La auxiliar ve que es un referido y quién se lo asignó (Priority: P2)

**Acceptance Scenarios**:

1. **Given** un referido asignado por Jessica a Isabel, **When** Isabel abre Mis contactos, **Then** la tarjeta (celular) y la fila (escritorio) muestran «Referido por X» y «te lo asignó Jessica».
2. **Given** un cliente no referido o que tomó ella misma, **Then** no aparece esa línea.

### User Story 3 - Ver el avance de los referidos de una persona (Priority: P2)

**Acceptance Scenarios**:

1. **Given** el Reporte de una sucursal, **When** se toca el nombre de un referidor, **Then** se abre la ventana con sus referidos del período.
2. **Then** muestra Llegaron, Contactados (%), Sin contactar (con «el que más espera: N días») y Compraron.
3. **Then** «Quién los atiende» agrupa por responsable (incluye «Sin asignar») y al tocar uno filtra la lista.
4. **Then** «A qué proceso pasaron» usa los grupos Venta, Cliente potencial, Seguimiento, Recaptación, Sin interés, Sin cambio y Sin contactar; al tocar uno filtra.
5. **Then** cada fila muestra cliente (celular y producto), llegó (y quién registró), último contacto (método · resultado · nota, cantidad y fecha del primero) o «Sin contactar · espera N días», etapa y responsable.
6. **When** se toca «Descargar Excel», **Then** baja la lista filtrada.

### Edge Cases

- Fila sin nombre (menos de 3 letras) o celular inválido: no cuenta para guardar y se marca.
- Referidor unido a otro (spec 014): se guarda en el que quedó.
- Responsable desactivado entre que se abrió la pantalla y se guardó: el servidor rechaza la carga entera (`invalid_input · assigned_to`) y no guarda nada.
- Repetir el guardado (doble toque o reintento): los mismos ids no crean nada nuevo.
- Sucursal sin auxiliares: «Repartir parejo» no aplica; hay que elegir a mano.
- La app publicada anterior no llama a las RPC nuevas ni lee los campos nuevos (todo aditivo).

## Requirements *(mandatory)*

- **FR-001**: `/referidos` MUST tener la pestaña «Cargar» para los roles de Referidos; el período no aplica en ella.
- **FR-002**: La carga MUST ser de una sola sucursal del alcance de quien carga.
- **FR-003**: El referidor MUST elegirse con el mismo selector de Registrar (activos de la sucursal) o crearse con nombre y tipo.
- **FR-004**: La carga MUST aceptar filas escritas o leídas de un texto pegado (una por línea, primer celular válido).
- **FR-005**: Cada fila MUST tener nombre, celular, producto (opcional) y responsable (automático o elegido).
- **FR-006**: La pantalla MUST avisar celulares repetidos (en la base o en la misma carga) antes de guardar.
- **FR-007**: La propuesta automática MUST repartir entre auxiliares por menor cantidad de pendientes, respetando filas elegidas a mano.
- **FR-008**: `referral_batch_save` MUST registrar cada fila con `submit_capture` (mismas reglas, idempotente por id) y asignar las aceptadas con `assign_prospects`, todo en una transacción; máximo 50 filas.
- **FR-009**: `referral_assignees` MUST devolver los responsables posibles de la sucursal con sus pendientes.
- **FR-010**: `referral_phone_check` MUST devolver qué celulares ya existen, sin revelar datos de sucursales que quien consulta no maneja.
- **FR-011**: `my_contacts` MUST devolver `referrer_name` y `assigned_by_name` (de forma aditiva).
- **FR-012**: Mis contactos MUST mostrar «Referido por X · te lo asignó Y» cuando corresponda.
- **FR-013**: `referral_report_range` MUST devolver por contacto `contacts`, `first_contact_at`, `last_method`, `last_result` y `last_note` (aditivo).
- **FR-014**: Tocar un referidor en el Reporte MUST abrir la ventana de detalle (US3) en lugar de la tablita.

## Success Criteria *(mandatory)*

- **SC-001**: Cargar y asignar 5 referidos pegados de WhatsApp toma menos de 1 minuto y ≤ 6 toques después de pegar.
- **SC-002**: Ningún referido cargado queda «Sin asignar» si la sucursal tiene auxiliares.
- **SC-003**: La auxiliar distingue un referido en su lista sin abrir la ficha.
- **SC-004**: La app anterior sigue funcionando con la migración aplicada (pgTAP de 014/015 en verde).

## Assumptions

- Los contactos los pasa el personal fuera del sistema (WhatsApp); la app no lee WhatsApp, solo el texto pegado.
- «Pendiente» de un responsable = cliente activo asignado a él, en etapa Captación y sin ningún contacto registrado.
