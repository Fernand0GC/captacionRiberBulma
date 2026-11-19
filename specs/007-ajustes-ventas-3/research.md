# Research (007)

## R1 · Copia que devuelve copiadas y saltadas sin romper la app publicada
- **Decision**: Nueva `org_copy_day_v2(...) → jsonb {copied, skipped}`. La vieja `org_copy_day(...) → integer` queda con la misma firma, pero llama a la v2 y devuelve `copied`.
- **Rationale**: Cambiar el tipo de retorno exige `drop function`; la app publicada recibiría un objeto donde espera un número («[object Object] asignaciones»). Con la v2, migración y app se publican en cualquier orden, y la vieja también deja de duplicar.
- **Alternatives**: `drop` + recrear (rompe la app hasta publicar); `out` params (mismo problema de firma).

## R2 · Qué es «asignación igual» y cómo evitar duplicados con copias simultáneas
- **Decision**: Igual = misma sucursal, día, persona, turno, hora de inicio, hora de fin, canal y subcanal (`is not distinct from` para los nulos). La copia toma `pg_advisory_xact_lock` por (sucursal, día destino), salta las filas iguales que ya existen y deduplica el origen con `distinct on`.
- **Rationale**: El candado serializa dos copias del mismo día (FR-004) sin índice único. Un índice único fallaría al crearse por los duplicados que ya hay en producción, y prohibiría cargar a mano dos asignaciones iguales a propósito (hoy permitido con aviso).
- **Alternatives**: Índice único parcial (ver arriba); borrar el destino antes de copiar (pierde lo cargado a mano).

## R3 · Meta de compartidas opcional
- **Decision**: En `org_upsert` se quita el `raise` cuando `uses_share_goal` y la meta viene vacía; si el subcanal no usa compartidas se sigue anulando. En el cliente, `parseGoal(raw, label, { optional: true })` devuelve `null` con texto vacío. El asterisco de «Meta de compartidas» se cambia por «(opcional)».
- **Rationale**: Decisión de gerencia (Clarifications). La meta de captación no cambia.

## R4 · Error visible y foco
- **Decision**: El `<p role="alert">` del error pasa al pie fijo (`sticky bottom-0`) junto a los botones. Las validaciones devuelven `{ message, field }`; el formulario hace `scrollIntoView({ block: 'center' })` y `focus()` sobre el `id` del campo (meta por subcanal: `goal-<id>` / `share-<id>`).
- **Rationale**: Hoy el error queda al final del área con scroll (foto 3 del chat).

## R5 · Guardar una sola vez
- **Decision**: `useRef<boolean>` que se marca al entrar a `submit` y se libera en `finally`, además del `disabled={busy}` actual.
- **Rationale**: `isPending` de React Query se actualiza en el siguiente render; dos toques en el mismo frame pasan los dos.

## R6 · Aviso de cruce
- **Decision**: `overlaps` recibe filas con `channel` y `subchannel` y el aviso arma «Subcanal (16:20–19:00)» (o canal si no hay subcanal). Si alguna es igual (R2, comparando también canal y subcanal elegidos), el aviso dice «Ya existe una asignación igual».
- **Rationale**: Hoy el aviso solo muestra horas y no deja encontrar la otra asignación.

## R7 · Filtro Turno inicial
- **Decision**: `defaultShiftFilter(from, to, now)`: si `from === to === laPazDate(now)` y `shiftFor(now) === 'afternoon'` (corte 13:00, `src/lib/dates.ts`) → `'afternoon'`; si no → sin filtro. Se aplica al cambiar de día solo si la persona no tocó el filtro Turno.
- **Rationale**: Reusa el corte de turno que ya usa la app.

## R8 · Tabla compacta
- **Decision**: `groupRows(rows)` en `logic.ts` arma sucursal → persona (con fecha si hay varios días) → filas, y junta en una fila las asignaciones del mismo `batch_id` con igual persona, día, turno, inicio y fin. Cada fila tiene `items[]` (subcanal, metas, resultado, acciones). Encabezado: con una sola sucursal y un día, en la barra de acciones («COBIJA · Gerente: … · jue 19/11»); si no, franja por sucursal. El gerente es `lead` de la primera fila de la sucursal («Sin gerente» si falta). Columnas: Horario (marca de turno) · Canal › Subcanal (+ volanteras) · Lugar · Metas · Resultado · Observaciones + acciones.
- **Rationale**: Los filtros por columna siguen trabajando sobre `visible` (no dependen de las columnas mostradas). El Excel y las tarjetas de celular no cambian (FR-016).
- **Alternatives**: Juntar filas sin `batch_id` por coincidencia de horario (podría unir asignaciones cargadas por separado que sí son distintas).
