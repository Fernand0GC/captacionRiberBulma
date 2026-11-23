# Research: 022 Mis contactos — atrasados, resumen y lista liviana

## R1. De dónde sale la fecha de asignación

- **Decision**: `my_contacts` suma `assigned_at` = `created_at` del último `assignment_events` con `to_user = auth.uid()` para
  ese cliente; si no hay ninguno, `client_created_at`.
- **Rationale**: Todas las rutas que asignan (`assign_prospects`, reparto, `take_on_followup`, submit con asignación)
  escriben en `assignment_events` (tabla inmutable). En la base local, los 452 clientes activos asignados tienen su evento.
  Es el mismo origen que ya usa `assigned_by_name` (spec 016). El índice `assignment_events_prospect_idx (prospect_id, created_at)` cubre la búsqueda.
- **Alternatives considered**: columna `prospects.assigned_at` (exige backfill y mantenerla en cada RPC que asigna:
  más superficie, rompe «los reportes se calculan de los eventos», constitución III); usar `stage_changed_at` (no cambia al reasignar).

## R2. Cómo cambiar `my_contacts`

- **Decision**: migración `20261123002200_my_contacts_assigned_at.sql` que parchea la versión vigente con el mismo
  `pg_temp.patch_function` de la 016 (busca un texto exacto; si no lo encuentra, falla y no aplica nada): agrega el campo
  y un `left join lateral` nuevo. La versión vigente es la de `20261121000800_referral_batch.sql` (verificado con
  `pg_get_functiondef` en la base local); ninguna migración posterior la toca.
- **Rationale**: conserva todos los campos actuales sin reescribir la función entera (menos riesgo de pisar algo); si
  producción tuviera otra versión, la migración falla en vez de dejarla rota.
- **Alternatives considered**: `create or replace` completo (copia 30 líneas y puede pisar un cambio que no vimos).

## R3. Regla de «atrasado por asignación»

- **Decision**: en `dueStatus`, rama «nunca contactado y sin nada agendado»: si `assigned_at` existe y su día de La Paz es
  anterior a hoy → `{ kind: 'late', label: 'Atrasado · asignado hace N días' }`; si no → «Nuevo · contactar hoy».
  N = diferencia en días calendario de La Paz (reusa `dayDiff` y `laPazDate`).
- **Rationale**: reutiliza el `kind: 'late'` existente → tono rojo, cuenta en el ⚠ del menú (`ContactsBadge`) y en los
  avisos del portal (`notices.ts`) como «atrasado» sin tocar esos archivos (FR-016). Sin `assigned_at` (servidor sin la 022) se comporta como antes (FR-006).

## R4. Agrupar «Captados» por día y lista liviana

- **Decision**: funciones puras en `src/features/followup/inboxView.ts`: `groupByAssignedDay(rows, now)` (grupos del día más
  reciente al más viejo, con etiqueta «Hoy» / «Ayer» / «Sáb 21»), `summarize(rows, now)`, `cardOf(status)` y `tabCount(total, due)`.
  En pantalla: solo el primer grupo abierto (o todos los que tengan coincidencias si hay texto en la lupa); cada lista
  abierta dibuja `PAGE = 50` filas y «Ver más (N restantes)» suma 50. «Recaptados» queda como lista única con el mismo tope.
- **Rationale**: sin dependencias nuevas (constitución II: presupuesto de 170 KB); lo que no se dibuja no cuesta. Las funciones
  puras se prueban con Vitest sin React.
- **Alternatives considered**: virtualización (`@tanstack/react-virtual`, ~5 KB gzip, y complica tabla + tarjetas y los
  tests e2e que buscan filas fuera de pantalla); paginación en el servidor (rompe la lupa y los contadores, que necesitan todos).

## R4b. Paginación con tamaño elegible (reemplaza «Ver más»)

- **Decision**: `pageOf(list, page, size)`, `pageWindow(page, pages)` (primera, última y vecinas de la actual, con «…»),
  `keepPlace(from, size)` y `parsePageSize(raw)` en `inboxView.ts`. Tamaños 10/25/50/100, 25 por defecto, en `localStorage`
  (`mis-contactos:page-size`) con try/catch. Un solo tamaño para toda la pantalla.
- **Rationale**: con «Ver más» las filas se acumulan; paginando nunca hay más filas dibujadas que el tamaño elegido (gama baja).
  25 de entrada porque la auxiliar trabaja desde el celular; quien quiere más lo elige una vez.
- **Alternatives considered**: tamaño por grupo (más estado y sorpresa); guardar en el servidor (no hace falta: es comodidad por dispositivo).

## R5. Orden

- **Decision**: Captados: grupos de hoy → días anteriores (desc). Dentro del grupo: `DUE_ORDER`, reasignados nunca contactados
  primero (por `waiting_since` ascendente, R8b), interés y luego
  `assigned_at` descendente (lo recién asignado primero). Recaptados: igual que hoy, con `assigned_at` en lugar de
  `client_created_at` como último criterio.
- **Rationale**: lo decidió el usuario en el clarify (hoy primero). Dentro del día, lo más reciente arriba mantiene a la
  vista lo que acaba de llegar aunque el grupo tenga más de 50.

## R6. Contador de pestaña

- **Decision**: total siempre primero; si todos piden atención, «⚠» solo (con `aria-label` «todos por atender»); si
  algunos, «⚠ N»; si ninguno, nada. `tabCount(total, due)` devuelve `{ total, due: number | 'all' | null }`.
- **Rationale**: «290 ⚠290» repetía el número. Mantener el total primero conserva el formato que verifica
  `tests/e2e/followup.spec.ts` de la 020 (`/^Captados\s*2(?!\d)/`), que no se toca.

## R7. Tarjetas del resumen

- **Decision**: «Para hoy» = `now` + `soon`; «Atrasados» = `late`; «Contactados hoy» = `done`. Se cuentan sobre todos los
  contactos abiertos que pasan la lupa (ambas pestañas). Tocar una filtra `all` antes de repartir en pestañas, igual que la lupa.
  Estado `card: 'today' | 'late' | 'done' | null` solo en React.
- **Rationale**: grupos disjuntos derivados de `dueStatus` (una sola regla). Que el número de la tarjeta coincida con lo que
  muestra al tocarla evita confusión.

## R8. Datos para el e2e

- **Decision**: el e2e nuevo (`tests/e2e/my-contacts-late.spec.ts`) crea sus propios clientes con fecha de asignación pasada vía
  `docker exec … psql` (ids fijos de la 022 + tag con la hora) y los borra en `afterAll` con el mismo patrón que los scripts
  de limpieza de la 021 (desactiva los triggers de inmutabilidad solo durante el borrado). Busca siempre con «palabra + tag».
- **Rationale**: no hay forma de asignar «ayer» desde la UI; adelantar el reloj del navegador con `page.clock` hace que
  supabase-js vea el token vencido y lo refresque en bucle. La base local ya se usa así en los seeds.
- **Alternatives considered**: `page.clock` (descartado arriba); depender de los «Vol 021» (los tests no deben asumir datos ajenos).

## R8b. Clientes que el encargado pasa a otra auxiliar (decidido después del clarify)

- **Decision**: para quien los recibe son trabajo de hoy («Nuevo · contactar hoy»: la fecha es la de *su* asignación), con la marca
  «Reasignado de <persona> · sin contactar desde el dd/mm» y primero dentro del grupo del día (el que más espera, primero).
  `my_contacts` suma `reassigned_from_name` (`from_user` del evento vigente) y `waiting_since` (primer evento del cliente, solo
  si nunca fue contactado).
- **Rationale**: el atraso es de quien no llamó (A queda registrada en Actividad, spec 020); a B no se le pinta rojo algo que le
  dieron hoy, pero sabe que esos clientes ya esperaron. `assign_prospects` no registra evento si se reasigna a la misma persona
  (`if r.assigned_to is distinct from p_to`), así que reasignar a la misma auxiliar no «reinicia» el atraso.
- **Alternatives considered**: contar el atraso desde la primera asignación también para B (le pinta rojo algo que no es su
  falta); no marcar nada (los clientes que más esperaron quedan mezclados con los recién captados).

## R9. Riesgo con otros e2e

- Con la base local cargada (≈370 contactos abiertos de la auxiliar por los «Vol 021»), el tope de 50 puede dejar fuera de
  pantalla una fila que otros e2e buscan **sin** lupa (p. ej. `followup.spec.ts` busca un «Resuelto hoy» en «No contestó»,
  que va al final del orden por estado). No se tocan esos archivos (son de la 020/otras specs): se avisa al usuario y se
  verifica solo el e2e nuevo, como pidió.
- **Resultado (2026-11-23)**: se confirmó en `followup.spec.ts` («embudo…», línea 64: «No contestó» con 148 filas, «Ver más (98
  restantes)»). Con autorización del usuario, el test ahora usa la lupa `llamar <tag>` tras entrar como la auxiliar; los 2 tests
  del archivo pasan.
