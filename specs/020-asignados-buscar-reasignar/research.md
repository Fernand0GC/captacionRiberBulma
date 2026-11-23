# Research: 020 Buscar y reasignar en «Clientes asignados»

## R1. ¿Reasignar con qué operación del servidor?

- **Decision**: `assign_prospects(p_ids, p_to)` tal cual (migración `20261028000900_followup.sql`), vía `useAssign()`.
- **Rationale**: ya verifica `is_manager()`, `manages_branch()` por cliente, destino activo con rol válido y de la
  misma sucursal, y deja `assignment_events` (historial inmutable). La clarificación confirmó «igual que Captaciones».
- **Alternatives**: función nueva «reassign_uncontacted» que valide en servidor que el cliente esté sin contactar.
  Rechazada: el usuario pidió no crear una función paralela; «sin contactar» es un filtro de qué se ofrece, no una
  regla de permiso (Captaciones ya deja reasignar cualquier cliente).

## R2. ¿Cómo reutilizar `AssignSelection.tsx` dentro de un modal?

- **Decision**: usar `useAssignSelection` sin copiar lógica, con dos opciones nuevas y opcionales (compatibles):
  `layout: 'page' | 'dialog'` (en `'dialog'` la barra va `sticky` al pie del área con scroll del modal, sin el
  desplazamiento `lg:left-64` de la barra lateral) y `noBranchText` (texto cuando no hay sucursal única).
- **Rationale**: el modal es un `<dialog>` nativo (top layer); una barra `fixed` con `lg:left-64` queda corrida y
  tapa los botones del pie del modal. Con opciones por defecto, Captaciones y Seguimientos no cambian.
- **Alternatives**: copiar la barra al modal (rechazado: duplica reglas de reparto/confirmación, justo lo que la spec
  015 unificó); portal a `document.body` (rechazado: queda debajo del top layer del `<dialog>`).

## R3. ¿Qué filas se ofrecen para reasignar y con qué dueño?

- **Decision**: función pura `reassignable(rows)` en `assigned.ts`: `contacts === 0 && !reassigned`. Se mapean a
  `Assignable` como `{ id: prospect_id, assigned_to: actorId, assigned_to_name: actorName }` (siguen a cargo de la
  persona del modal; si no, `reassigned` sería true).
- **Rationale**: no hace falta traer `assigned_to` del servidor; la condición ya está en la fila. Queda probado en
  Vitest y la 021 puede sumar su propio criterio en el mismo archivo.

## R4. Sucursal para «Asignar a…»

- **Decision**: `list_agent_assigned` devuelve `branch_id` del cliente; `singleBranch(rows)` devuelve la sucursal
  si todas las filas reasignables son de una sola, si no `undefined` (la barra muestra `noBranchText`).
- **Rationale**: las opciones (`assignee_options`) y `assign_prospects` trabajan por sucursal del cliente. Una persona
  casi siempre tiene clientes de una sola sucursal; el caso mixto (gerencia en «todas») se resuelve con el filtro de
  sucursal de Actividad, que el modal ya respeta.

## R5. Criterio de búsqueda (lupa)

- **Decision**: `matchesNameOrPhone({ full_name, phone_norm }, q)` en `src/lib/search.ts`:
  - vacío → true;
  - si el texto solo tiene dígitos y separadores (espacios, `+`, `-`, `.`, `(`, `)`): se quitan los separadores y un
    `591` inicial cuando sobran dígitos, y se busca como subcadena en `phone_norm`;
  - si no: `matchesAll(normalizeText(full_name), q)` (todas las palabras, sin tildes ni mayúsculas).
- **Rationale**: mismo criterio que el buscador de productos (ya probado); `phone_norm` son los 8 dígitos limpios.
- **Alternatives**: buscar en el servidor (rechazado: las listas ya están cargadas, la constitución pide no poner
  datos personales en la URL y una consulta por tecla es más lenta en 3G).

## R6. Campos nuevos de `list_agent_assigned`

- **Decision**: `phone_raw`, `phone_norm` y `branch_id` por fila. Migración `20261123002000_agent_assigned_phone_branch.sql`
  con `create or replace` de la función (misma firma, mismos permisos).
- **Rationale**: mismos nombres que `FollowupRow` (Mis contactos), así un solo buscador sirve para ambos.
  `create or replace` no rompe la app desplegada (campos extra se ignoran).

## R7. Orden de `AssignedPanel.tsx` para la 021

- **Decision**: partir el componente en piezas con nombre: `AssignedKpis`, `OriginSection`, `OutcomeSection`,
  `AssignedToolbar` (Contacto + lupa + Seleccionar + contador) y `AssignedRowItem`. El estado (filtro + selección)
  queda arriba en `AssignedPanel`.
- **Rationale**: la 021 agrega «Ver ocultos» a la barra y una acción por fila; con piezas separadas se agrega sin
  reescribir la lista.

## R8. Tests (TDD)

- **pgTAP** `supabase/tests/agent_assigned_test.sql`: +3 aserciones (celular, `phone_norm`, sucursal) y una que
  reasigna con `assign_prospects` como encargado y comprueba que `agent_activity` no cambia y la fila sale reasignada.
- **Vitest** `tests/unit/assigned.test.ts` (filtro con búsqueda, `reassignable`, `singleBranch`) y
  `tests/unit/search.test.ts` (`matchesNameOrPhone`).
- **Playwright**: test nuevo en `tests/e2e/monitoring.spec.ts` (buscar + reasignar desde el modal) y en
  `tests/e2e/followup.spec.ts` (lupa de Mis contactos). Filtran por nombres con `tag` propio; no asumen base vacía.
