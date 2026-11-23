# Research: spec 019

## R1. Cómo encontrar el subcanal

- **Decision**: por `public.org_norm(name) = public.org_norm('Acomodo de tienda')`, en cualquier canal y estrategia.
- **Rationale**: es la misma normalización que usa `org_add_subchannel` para evitar duplicados (spec 004), así que
  cualquier escritura que «+ Agregar otro…» aceptó como igual se reconoce igual. No hay ids estables entre bases.
- **Alternatives**: por id (distinto en cada base); `ilike '%acomodo%'` (puede atrapar otro subcanal; queda solo en el
  diagnóstico para que el usuario vea variantes).

## R2. Qué columnas cambian en la asignación

- **Decision**: `strategy_id` ← Tienda, `channel_id` ← canal nuevo, `subchannel_id` ← null. Nada más; tampoco
  `updated_at`/`updated_by`.
- **Rationale**: la llave compuesta `org_assignments_channel_fk (channel_id, strategy_id)` obliga a cambiar la
  estrategia si el subcanal estaba bajo Calle. La de subcanal `(subchannel_id, channel_id)` acepta null (MATCH SIMPLE).
  Metas, resultados, compartidas, verificación de Cobros, volanteras, lote y autores son historial y no cambian.
  `updated_by` no puede ser «la migración» (no hay usuario); dejarlo igual evita atribuir el cambio a otra persona.
- **Alternatives**: crear filas nuevas y anular las viejas (duplica el historial y rompe los reportes por id).

## R3. Rastro del cambio

- **Decision**: lo deja el trigger existente `org_assignments_audit` (`audit_row`): guarda en `audit_log` el valor
  anterior y nuevo de strategy/channel/subchannel; `actor_id` queda null (migración).
- **Rationale**: cumple FR-009 sin código nuevo.

## R4. Idempotencia y base sin subcanal

- **Decision**: la función busca canal existente antes de crear; mueve con `where subchannel_id = any(viejos)` (en la
  segunda corrida no hay filas); desactiva con `where active`. Sin subcanales encontrados: crea el canal (si falta) con
  marcas por defecto y devuelve `moved = 0`.
- **Rationale**: FR-010/FR-011. Re-ejecutar no cambia filas (SC-003).

## R5. Marcas de meta del canal (clarificación 2)

- **Decision**: al crear, `uses_goal = bool_or(sc.uses_goal)`, `uses_share_goal = bool_or(sc.uses_share_goal)` de los
  subcanales encontrados; sin subcanales, `true/false`. Si el canal ya existía y hay filas para mover, se suman las marcas de los subcanales que aún tienen
  asignaciones (`canal OR esos subcanales`), para que ninguna asignación movida pierda su meta visible sin reactivar marcas de subcanales ya vacíos. Sin filas que mover, no se
  tocan (respeta un cambio hecho a mano en Catálogo). `uses_flyers = false` al crear.
- **Rationale**: las metas marcadas son obligatorias al guardar (004); copiar evita errores al editar asignaciones viejas.

## R6. Concurrencia en producción

- **Decision**: `lock table public.org_assignments in share row exclusive mode` dentro de la función, antes de mover.
- **Rationale**: evita que un guardado simultáneo deje una asignación nueva en el subcanal viejo entre la lectura y la
  desactivación. El bloqueo dura milisegundos (la migración es una transacción corta); las lecturas siguen.

## R7. Tests que se rompen por el canal nuevo

- **Decision**: ajustar `supabase/tests/org_catalog_test.sql:7` (14 → 15 canales). Los e2e existentes eligen canales
  por nombre y no cuentan opciones: no se rompen.

## R8. Cómo probar el movimiento en local

- **Decision**: el test pgTAP crea subcanales «Acomodo de tienda» de prueba (uno bajo Tienda, uno bajo Calle con otra
  escritura), asignaciones con metas/resultados/verificación, llama la función, verifica y la vuelve a llamar (idempotencia).
  Todo dentro de `begin … rollback`, como el resto de los tests.
- **Alternatives**: datos en `seed.sql` (prohibido para catálogos reales por CLAUDE.md y no prueba producción).
