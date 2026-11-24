# Feature Specification: Reasignar atrasados desde la Agenda de recontacto

**Feature Branch**: `025-agenda-reasignar-atrasados`
**Created**: 2026-11-24
**Status**: En producción. Sin migración (solo front). QA del PO aprobada y app en `main` (`9457ad3`, 2026-11-24).
**Input**: «¿Es posible reasignar desde la agenda?». La jefa ve en «Del día» → «Agenda de recontacto» cuántos
atrasados arrastra cada persona (spec 023), pero para repartirlos tenía que ir a dos pantallas: Actividad (solo los
nunca contactados, spec 020) y Seguimientos (los agendados vencidos, specs 015/023).

## Contexto

La ventana de detalle de una persona en la agenda (Pendientes / Contactados hoy / Atrasados) era solo de lectura.
«Atrasados» junta dos casos (FR-004 de la 023): nunca contactado asignado antes de hoy, y agendado antes de hoy sin
contacto. La selección y la asignación ya existían y estaban probadas (`useAssignSelection` + `assign_prospects`).

## Decisiones (aprobadas por el PO, 2026-11-24)

1. Se reasignan **los dos tipos** de atrasado.
2. **Solo desde la pestaña Atrasados**: lo pendiente de hoy todavía le toca a esa persona.
3. Se ofrece **«Repartir entre las N auxiliares»** (viene con el selector compartido).
4. Sin cambios en la base: se reusa `assign_prospects` (permisos, misma sucursal, historial en `assignment_events`).

Corrección durante el análisis: el agendado vencido que se reasigna **no** le llega atrasado a quien lo recibe. La regla
del «caso Rene» de `dueStatus` lo muestra como «Recibido hoy · venció el dd/mm» (trabajo de hoy, en Pendientes),
porque `assign_prospects` deja un evento con fecha de hoy. El nunca contactado llega como «Nuevo · contactar hoy».

## Criterios de aceptación

1. En Atrasados aparece «Seleccionar»; en Pendientes y Contactados hoy, no.
2. Al marcar y elegir «Asignar a X», se confirma diciendo a quién se le quitan («N de persona»); al confirmar pasan a X
   con el aviso «✓ N reasignados».
3. La agenda se recarga sola: −N atrasados en el origen; los dos tipos le llegan a X en «Le tocaba hoy / Pendientes».
4. «Seleccionar los N» marca todos los atrasados de la persona, no solo la página.
5. «Repartir entre las auxiliares» reparte en partes iguales (misma regla que Captaciones).
6. «Todas las sucursales»: si los atrasados son de una sola sucursal se puede asignar a su personal; si son de varias,
   aviso «elige una sucursal» y no se asigna.
7. Permisos: auxiliar, supervisor o encargado de otra sucursal → `forbidden` en el servidor; «Asignar a…» solo lista
   personal activo de la sucursal.
8. Si falla, se muestra el error, la selección se conserva y la agenda no cambia.
9. Agenda truncada: se mantiene el aviso y «Seleccionar los N» solo alcanza a los cargados.

## Cambios

- `src/features/monitoring/agenda.ts`: `lateAssignable(person)` (atrasados como `Assignable`, con la persona como dueña
  actual) y `lateBranch(person)` (sucursal única de los atrasados; varias → `undefined`; sin atrasados → la de la persona).
- `src/features/monitoring/AgendaSection.tsx`: en `AgendaDialog`, `useAssignSelection` (`layout: 'dialog'`) con
  `SelectToggle` solo en Atrasados, casillas en `ClientItem` y la barra al pie; cambiar de pestaña cancela la selección.
- Tests: `tests/unit/agenda.test.ts` (6 nuevos), `supabase/tests/agenda_reassign_test.sql` (pgTAP: permisos por rol y
  cómo queda la fila en `recontact_agenda` después de reasignar), `tests/e2e/agenda-reassign.spec.ts` (recorrido completo
  con dos auxiliares propias del test).

## Riesgos conocidos

- «Repartir» hace una llamada a `assign_prospects` por auxiliar: si una falla, las anteriores ya quedaron (igual que en
  Captaciones y Seguimientos).
- «— Quitar responsable» también está disponible: el cliente sale de la agenda (no tiene responsable).

## Fuera de alcance

Reglas de la base, Excel de «Del día», pantallas de la auxiliar, reasignar desde Pendientes o Contactados hoy.
