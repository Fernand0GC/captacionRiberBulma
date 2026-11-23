# Tasks: «Acomodo de tienda» como canal propio de Tienda

**Input**: Design documents from `specs/019-acomodo-tienda-canal/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/migration.md, quickstart.md

**Tests**: pedidos explícitamente (pgTAP + Playwright). Se escriben primero y deben fallar antes de la migración (TDD).

**No tocar**: `specs/018-encargada-edita-hoy/`, `org_can_replan`, `supabase/tests/org_assignments_test.sql`,
`.specify/feature.json`. Sin git, sin `supabase db reset`, nada en producción.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1 diagnóstico · US2 canal nuevo con historial · US3 planificar con el canal · US4 repetir sin daño

---

## Phase 1: Setup

- [X] T001 Verificar base local arriba y al día (`supabase migration up`, sin `db reset`); correr `pnpm db:test` y anotar el estado de partida (qué pasa y qué falla antes de tocar nada)

---

## Phase 2: User Story 1 — Diagnóstico (P1) 🎯

- [X] T002 [US1] Escribir `specs/019-acomodo-tienda-canal/diagnostico-produccion.sql` (3 bloques, `begin read only` … `rollback`) — hecho en specify
- [X] T003 [US1] Correrlo en local: 0 filas, sin error (FR-004) — hecho en specify

---

## Phase 3: Tests primero (deben fallar)

- [X] T004 [US2] [US4] Crear `supabase/tests/acomodo_tienda_channel_test.sql` (pgTAP, `begin … rollback`):
  - existe la función `org_subchannel_to_channel(text, text)` y `authenticated` no puede ejecutarla
  - existe un solo canal activo Tienda → «Acomodo de tienda», sin subcanales (efecto de la migración en local)
  - datos de prueba: subcanal «Acomodo de tienda» bajo Tienda → Llamadas (uses_goal true) y «acomodo  de Tiénda» bajo Calle → Volantes (inactivo, uses_share_goal true); asignaciones en ambos con meta, resultado, meta/resultado de compartidas, verificación de Cobros, volanteras y lote; una asignación en otro subcanal de Llamadas (control); el canal creado se vuelve a nombrar para forzar la creación en la llamada
  - tras llamar la función: `created`, `moved`, `deactivated` esperados; todas en Tienda/canal nuevo/sin subcanal; sumas de goal/result/share_goal/share_result/share_verified iguales a las de antes; verificación (nota, autor, fecha), flyer_ids, batch_id, updated_at y updated_by sin cambio; subcanales inactivos y existentes; control intacto; marcas del canal = OR (captación y compartidas); fila en `audit_log` por asignación movida con el subcanal viejo en `old`
  - segunda llamada: `moved = 0`, `deactivated = 0`, `created = false`, sigue un solo canal (idempotencia)
  - canal existente inactivo → se reactiva y se usa (no se crea otro)
  - sin subcanales → crea el canal con marcas por defecto (true/false) y `moved = 0`
  - estrategia inexistente → `invalid_input`
  - Planificación: `org_save` como encargada (…0003) con Tienda → Acomodo de tienda sin subcanal → se guarda; `org_add_subchannel` con «Acomodo de tienda» en Llamadas → `inactive_subchannel`
- [X] T005 [P] [US2] Ajustar `supabase/tests/org_catalog_test.sql:7`: 14 → 15 canales (agrega «Acomodo de tienda», 019)
- [X] T006 [P] [US3] Agregar al final de `tests/e2e/organization.spec.ts` el test «organización (019): Acomodo de tienda es canal de Tienda»: la encargada abre Cargar, elige Tienda → canal «Acomodo de tienda», no aparece grupo «Subcanales», carga horario y meta, guarda y ve la fila con «Acomodo de tienda» (fecha futura al azar, como el test 008; la limpieza es `pnpm db:clean`)
- [X] T007 Correr `pnpm db:test` y confirmar que fallan solo T004 y T005 (todavía no hay migración)

---

## Phase 4: User Story 2 + 4 — Migración (P1/P2)

- [X] T008 [US2] [US4] Crear `supabase/migrations/20261123001900_acomodo_tienda_channel.sql` con `public.org_subchannel_to_channel(p_name, p_strategy)` según `contracts/migration.md` y research R1–R6: validar estrategia y nombre; buscar subcanales por `org_norm`; `lock table org_assignments in share row exclusive mode`; buscar canal por `org_norm` en la estrategia, crear (sort al final, marcas OR, flyers false) o reactivar y sumar marcas si hay filas que mover; `update` de strategy/channel/subchannel; desactivar subcanales; devolver jsonb. Revocar `execute` a public, anon, authenticated. Al final: `select public.org_subchannel_to_channel('Acomodo de tienda', 'Tienda');`
- [X] T009 [US2] `supabase migration up` y `pnpm db:test`: todo en verde (incluido T004/T005)

---

## Phase 5: User Story 3 — Planificación (P2)

- [X] T010 [US3] Correr `pnpm e2e tests/e2e/organization.spec.ts` (todos los tests del archivo, para ver que el canal nuevo no rompe los anteriores)

---

## Phase 6: Producción y cierre

- [X] T011 Generar `migraciones-019-produccion.sql` en la raíz de RB-union (como los anteriores): la migración tal cual envuelta en `begin; … commit;` (el SQL Editor no garantiza una sola transacción, FR-012), y después una consulta de verificación de solo lectura (sumas del canal nuevo y subcanales viejos sin asignaciones) para comparar con el diagnóstico. **No aplicarlo**
- [X] T012 [P] Actualizar `CLAUDE.md` (lista de features: 019) y `docs/plan-018-021.md` (Estado)
- [X] T013 Proponer al usuario los comandos de git (sin ejecutarlos)

---

## Dependencies

- T004–T006 antes de T008 (TDD). T008 antes de T009–T010. T011 después de T009.
- T005 y T006 en paralelo con T004 (archivos distintos).
- US3 depende de US2 (el canal lo crea la migración).
