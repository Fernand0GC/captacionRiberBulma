# Spec 028 · La Agenda de recontacto refleja los asignados del día

**Estado**: Implementada en local (2026-11-25). Pendiente: QA del PO, commit, migración en producción
(`RB-union/migraciones-028-produccion.sql` = `20261125000300_agenda_assigned_today.sql`) y deploy.

## Por qué
Observación de ventas (25/11): «no refleja los clientes asignados del día». Diagnóstico de Rene
(`RB-union/diagnostico-asignados-vs-agenda.sql`): 15 «Asignados» en Actividad y 13 en «Le tocaba hoy». La diferencia
eran 2 clientes que Isabel le pasó hoy desde Nayara con la visita o llamada ya agendada para más adelante (Carlos Tonore
29/11, Saul Paye 03/12): la agenda no los traía. Además, Maria Fernanda y Nayara tenían «Le tocaba hoy» con 0 asignados
(eran rellamadas) y nada lo explicaba.

## Decisiones (aprobadas por el PO, 2026-11-25)
1. **Opción C**: lo recibido hoy y agendado más adelante se ve hoy, pero no se exige (no suma a Le tocaba hoy,
   Pendientes ni Atrasados). Se descartó meterlo en «Le tocaba hoy» (inflaría Pendientes y molestaría visitas pactadas).
2. «Asignados hoy» usa la regla de Actividad (012 + 024) y se calcula en el servidor.
3. Columna «Rellamadas»: le tocaba hoy por algo recibido antes de hoy. Le tocaba hoy = recibidos hoy en la agenda + rellamadas.
4. En «Mis contactos», solo la etiqueta «Nuevo para ti · visita dd/mm hh:mm», primero dentro de su estado (sin tarjeta nueva).
5. Los que contactó y ya pasaron a otra persona solo se cuentan («N pasó a otra persona»); la lista está en Actividad.

## Qué cambia
- `recontact_agenda` (migración `20261125000300`, parches idempotentes): trae lo recibido hoy por el responsable actual
  aunque esté agendado más adelante, y devuelve `assigned: [{id, assigned, passed_on}]`.
- `dueStatus.ts`: `receivedLater()` y la etiqueta «Nuevo para ti» (sigue siendo `normal`: no pide atención).
- `inboxView.ts`: `freshRank`, lo «Nuevo para ti» primero dentro de su estado.
- `agenda.ts`: `later`, `assignedToday`, `passedOn`, `recalls` por persona y en `agendaTotals`.
- `AgendaSection.tsx`: columnas «Asignados hoy» y «Rellamadas», nota «N para más adelante» (abre la pestaña
  «Para más adelante» del detalle) y «N pasó a otra persona». Sin la migración, la tabla queda como antes.
- `exportDaily.ts`: hoja «Agenda» con Asignados hoy, Rellamadas, Para más adelante y Pasaron a otra persona.

## Criterios de aceptación
C1–C14 aprobados en la sesión del 25/11. Pruebas: `supabase/tests/agenda_assigned_today_test.sql` (permisos, filas,
asignados y **paridad con `agent_activity`** como encargado y como gerencia), `tests/unit/agenda.test.ts`,
`tests/unit/dueStatus.test.ts`, `tests/unit/inboxView.test.ts`, `tests/e2e/agenda-assigned-today.spec.ts`. Los e2e
de 023/025/026 se ajustaron a las dos columnas nuevas.

## Fuera de alcance (pendiente)
- Recibido hoy, ya contactado antes por otra persona y **sin fecha**: cuenta en «Asignados hoy» pero no aparece en
  la agenda ni en «Para más adelante» (caso «invisible» de la 026; no apareció en el caso Rene).
