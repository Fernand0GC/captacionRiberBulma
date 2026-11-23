# Research: Recontacto visible para jefas (023)

## R1 — Agenda: una sola regla con «Mis contactos»

- **Decision**: La RPC nueva `recontact_agenda` devuelve **filas de clientes** con los mismos campos que `my_contacts`
  (`next_contact_at`, `visit_at`, `last_contacted_at`, `last_result`, `assigned_at`, `stage`…) más el responsable. La app
  clasifica cada fila con `dueStatus` + `cardOf` (`src/features/followup/dueStatus.ts`, `inboxView.ts`), las mismas
  funciones que arman las tarjetas «Para hoy / Atrasados / Contactados hoy» de la auxiliar, y agrupa por persona.
- **Rationale**: SC-002 pide que los números coincidan siempre con «Mis contactos». Copiar la regla a SQL crea dos
  versiones que se separan con el próximo ajuste (la regla ya tiene casos finos: «más tarde hoy», visita de mañana que
  se confirma hoy, nunca contactado asignado antes de hoy). Reusar la función garantiza la paridad por construcción.
- **Alternatives**: (a) contar en SQL → riesgo de divergencia; (b) llamar `my_contacts` por persona → N llamadas y
  `my_contacts` usa `auth.uid()`.

## R2 — Columnas de la agenda sobre las tarjetas de la auxiliar

- **Decision**: `Pendientes` = tarjeta `today` (now + soon); `Contactó` = tarjeta `done` (contactado hoy, sin quedar para
  más tarde hoy); `Atrasados` = tarjeta `late`; `Le tocaba hoy` = Pendientes + Contactó.
- **Rationale**: Son exactamente las 3 tarjetas que ve la auxiliar (spec 022). Un atrasado que se llamó hoy pasa a
  «Contactó», que es lo que la jefa quiere ver («lo hizo»). Ajusta la redacción de FR-002/FR-003 (spec actualizada).
- **Cerrados hoy**: `my_contacts` excluye venta y sin interés. La agenda **sí** incluye los cerrados hoy con último
  contacto hoy (por ejemplo, el 3.er «no contestó» o una venta), y cuentan en «Contactó» (edge case de la spec). Así
  «Contactó» puede ser mayor que «Contactados hoy» de la auxiliar; «Pendientes» y «Atrasados» coinciden exactos.

## R3 — Filtro previo en el servidor (volumen)

- **Decision**: `recontact_agenda` solo devuelve clientes que pueden caer en alguna tarjeta: abiertos con
  `next_contact_at` antes de pasado mañana (incluye la visita de mañana, «soon»), abiertos nunca contactados sin fecha,
  y cualquier cliente con último contacto hoy. Tope 5000 filas con `truncated`.
- **Rationale**: Es un superconjunto de las tarjetas (lo que no entra sería «normal» y no cuenta) y reduce mucho las filas
  en «Todas las sucursales». La clasificación final sigue siendo `dueStatus`.

## R4 — Agenda solo para hoy

- **Decision**: «Del día» elige un día (no un período). La sección se muestra con números solo cuando el día elegido es
  hoy; en otro día muestra «La agenda de recontacto solo está disponible para hoy» y un botón «Ir a hoy». La RPC no recibe
  fecha.
- **Rationale**: Decisión de la jefa nacional (Clarifications). `next_contact_at` se pisa con cada contacto, así que
  reconstruir días pasados exigiría guardar historia nueva.

## R5 — Personas que aparecen

- **Decision**: Mismo criterio que `agent_activity`: auxiliares, supervisores y encargados activos de la sucursal (o
  sucursales del alcance) siempre, aunque estén en cero; cualquier otra persona solo si es responsable de alguna fila.
  La RPC devuelve `people` (id, nombre, rol, sucursal) y `rows`.
- **Origen (referidos)**: la agenda no aplica el filtro «Solo referidos» de «Del día»; la sección dice «Incluye todos los
  orígenes» cuando ese filtro está activo.

## R6 — Recontacto en Actividad

- **Decision**: En `agent_activity`, cada contacto lleva `recontact = exists(contacto anterior del mismo cliente, de
  cualquier persona)`, con orden `(contacted_at, id)` para desempatar dos contactos con la misma hora. Columnas nuevas
  `first_contacts` y `recontacts` (por persona y por sucursal). `list_agent_contacts` acepta `metric` = `first` y
  `recontact` para que el número abra el detalle con esos mismos contactos.
- **Rationale**: Clarification Q2 (cualquier persona). El índice `followups_prospect_idx (prospect_id, contacted_at
  desc)` resuelve el `exists`. `first + recontact = total` por construcción.
- **Alternatives**: «misma persona» (descartado por la jefa nacional).

## R7 — «Contar por» en Seguimientos

- **Decision**: `list_followup_status` acepta `f.date_basis` ∈ `registered` (por defecto) | `assigned` | `last_contact` |
  `next_contact`. El período se aplica a: `client_created_at`; la última asignación al responsable actual
  (`assignment_events.to_user = assigned_to`); el último contacto (`lf.contacted_at`); `next_contact_at`. En la URL va
  `contar=asignacion|ultimo|proximo` (sin el parámetro = registro).
- **Rationale**: Lista, pestañas, «Seleccionar/Asignar» (`useAssignSelection` con `fetchAll`) y Excel ya usan el mismo
  objeto `FollowupStatusFilters`: agregar un campo cubre FR-018 sin tocar esas piezas. Sin `date_basis` la función
  responde idéntico (SC-005).
- **Detalle**: con `assigned` los clientes sin responsable no entran (no tienen asignación vigente).

## R8 — Forma de cambiar las funciones

- **Decision**: Una migración `20261124000100_recontacto_visible.sql`: crea `recontact_agenda` y parchea `agent_activity`,
  `list_agent_contacts` y `list_followup_status` con `pg_temp.patch_function` (patrón de la 015/022: si el texto
  esperado no está, falla sin cambiar nada; si ya está aplicada, no hace nada). Copia para producción en
  `../migraciones-023-produccion.sql`, sin aplicar.
- **Rationale**: Parche mínimo y verificable, igual que las features anteriores; nada de tablas nuevas.

## R9 — `dueStatus` con filas que no son de «Mis contactos»

- **Decision**: `dueStatus` pasa a aceptar un tipo mínimo `DueInput` (los campos que realmente lee, con `stage: string`),
  compatible con `FollowupRow`. Sin cambios de lógica.
- **Rationale**: Las filas de la agenda pueden ser venta o sin interés (cerrados hoy); TypeScript estricto sin `any` ni
  casts.
