# Research: 021 Depurar «Clientes asignados»

## R1. Dónde guardar «oculto»

- **Decisión**: tabla `public.assigned_hidden (prospect_id, agent_id, hidden_by, hidden_at)`, clave primaria
  `(prospect_id, agent_id)`. «Mostrar» borra la marca (no el cliente).
- **Por qué**: el pedido dice «tabla de ocultos, no borra nada»; la marca es por par cliente + persona (FR-011), así el
  mismo cliente sigue visible en el modal de otra persona. Borrar la marca al mostrar es lo más simple y deja el
  estado exacto; no hace falta historial de ocultar/mostrar (YAGNI).
- **Alternativas**: columna en `prospects` (afectaría a todas las personas y pantallas, rompe FR-011/FR-012);
  `hidden_until`/`shown_at` con historial (complejidad sin pedido).

## R2. Acceso: RLS sin políticas + RPC `security definer`

- **Decisión**: RLS activado y `revoke all` para `anon`/`authenticated`; todo pasa por RPC que verifican
  `app_is_active()`, `is_manager()` y `manages_branch(p.branch_id)` **por cada cliente** (todo o nada:
  si uno no corresponde → `forbidden`).
- **Por qué**: clarify decidió encargada + jefe + gerente (+ admin). `is_manager()` es exactamente ese grupo y
  `manages_branch()` ya limita a la encargada a su sucursal y al jefe a las suyas. Mismo patrón que `referrer_phones`.
- **Alternativa**: políticas RLS de insert/delete: más difíciles de probar y no permiten el «Ocultar» masivo del período.

## R3. «Ocultar» del aviso con más de 500 asignados

- **Decisión**: RPC `hide_assigned_contacted(f jsonb)` con los mismos filtros que `list_agent_assigned` (período,
  sucursal, persona). Calcula en el servidor los contactados no ocultos con la misma definición de «contactado»
  (contacto de esa persona desde su primera asignación del período) y los marca. Devuelve cuántos ocultó.
- **Por qué**: FR-002 pide ocultar todos, no solo las 500 filas cargadas. Un pgTAP compara que lo ocultado coincide con
  `contacts > 0` de `list_agent_assigned` (evita que las dos definiciones se separen).

## R4. Cambios en `list_agent_assigned`

- **Decisión**: nueva versión partiendo de `20261123002000` (conserva `phone_raw`, `phone_norm`, `branch_id`); agrega
  por fila `hidden boolean` y en la respuesta `hidden_total` y `contacted_visible` (contactados no ocultos del
  período completo). `total` y las filas siguen incluyendo los ocultos; el cliente decide qué mostrar.
- **Por qué**: los indicadores de arriba cuentan todo el período (FR-004) y «Ver ocultos» no necesita otra consulta.
  Misma firma y grants: la app anterior ignora los campos nuevos.

## R5. Recordar «Mantener»

- **Decisión**: `localStorage` con clave `rb.assigned-keep.<viewerId>.<agentId>` y valor la fecha de hoy en La Paz;
  lecturas/escrituras en `try/catch`. Si no se puede leer, el aviso aparece (falla hacia preguntar).
- **Por qué**: clarify: «una vez por día, por quien mira y por persona», recordado en ese navegador. Es comodidad de
  pantalla; no hace falta tabla ni RPC. Solo guarda ids de personal (no datos de clientes, constitución IV).

## R6. Forma del aviso

- **Decisión**: banda en línea arriba de la lista del modal (`role="alert"` con dos botones), no un diálogo encima del
  diálogo.
- **Por qué**: un modal dentro de otro en celular tapa todo y complica el foco; la banda deja ver la lista que se va a
  depurar. Se cierra con cualquiera de los dos botones.

## R7. Interacción con la reasignación (020)

- **Decisión**: `reassignable` excluye ocultos; `filterAssigned` excluye ocultos salvo `showHidden`. Así la selección
  de la 020 nunca ofrece un oculto (FR-013) sin tocar `useAssignSelection`.

## R8. E2E sobre una base con datos

- **Decisión**: archivo nuevo `tests/e2e/assigned-hide.spec.ts`. El «Ocultar» del aviso afecta a todos los
  contactados del día de la auxiliar (también datos ajenos al test): el test anota primero qué ocultos ya había y al
  final vuelve a «Mostrar» solo los que ocultó él. Las comprobaciones filtran por el tag del test
  (`oculto ${tag}` en la lupa).
