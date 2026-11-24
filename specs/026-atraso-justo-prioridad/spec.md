# Spec 026 · Atraso justo y «Poner para hoy»

**Estado**: En producción. Migración `migraciones-026-produccion.sql` (`20261124000400_contact_priority.sql`) aplicada
en el SQL Editor (2026-11-24, confirmado por el PO) y app en `main` (`041a57b`, 2026-11-24).

## Por qué
Diagnóstico de Rene (24/11, `RB-union/diagnostico-sin-contactar-mes.sql`): de sus 66 «Sin contactar» del mes, 44 estaban
en Pendientes (43 recibidos hoy con fecha vencida heredada), 21 en Atrasados y 1 cerrado por otra persona. Dos problemas:
1. Al día siguiente, lo recibido con una fecha heredada aparecía con los días de atraso de la persona anterior
   («Atrasado 16 días») aunque se lo asignaron ayer.
2. La jefa no tenía cómo decir «esto, hoy» sin reasignar.

## Qué cambia
**A · Atraso justo** (`dueStatus.ts`, sin cambios en la base): los días se cuentan desde la fecha más reciente entre lo
agendado y el día en que lo recibió el responsable actual → «Atrasado 1 día · recibido el 23/11 (tocaba el 12/11)».
`lateInfo()` da días y tipo (*nunca contactado* / *fecha vencida*; las visitas vencidas cuentan como fecha vencida).
En «Del día» → detalle de la Agenda → Atrasados: filtros por antigüedad (1 día · 2 a 7 · más de 7) y tipo, con cantidades;
la reasignación de la 025 actúa sobre lo filtrado. Hoja «Agenda» del Excel: columnas del desglose y «Prioridad hoy».
No cambia en qué columna cae ningún cliente.

**B · «Poner para hoy»**: en el modal «Clientes asignados» (Sin contactar → Seleccionar) y en Atrasados de la Agenda.
El cliente sigue con la misma persona y pasa a «Le tocaba hoy» / Pendientes con «Prioridad de hoy · atrasado N días»;
en «Mis contactos» va primero. Dura solo el día marcado (mañana, si no se contactó, vuelve a Atrasados con sus días
reales); si se reasigna, no lo sigue; se puede quitar el mismo día. Tabla `contact_priorities` (cliente + persona + día),
solo por RPC `set_contact_priority(p_agent, p_prospects, p_on)` → `{changed, skipped}`. Permisos como «Ocultar» (021):
encargado, jefe de ventas, gerente y admin en sus sucursales; los que ya no son de esa persona se saltan y se avisa.
`my_contacts`, `recontact_agenda` (incluye lo marcado aunque esté agendado más adelante) y `list_agent_assigned` suman
`priority_today`. El frontend tolera que la migración no esté aplicada (sin `priority_today` = sin prioridad).

## Criterios de aceptación
A1–A8, B1–B8, P1–P3, E1–E2 (aprobados en la sesión del 24/11). Pruebas: `tests/unit/dueStatus.test.ts`,
`tests/unit/agenda.test.ts`, `tests/unit/inboxView.test.ts`, `supabase/tests/contact_priority_test.sql`,
`tests/e2e/agenda-priority.spec.ts`.

## Fuera de alcance (pendiente)
- Clientes «invisibles»: contactados antes por otra persona y sin fecha (no aparecieron en el caso Rene).
- Cliente cerrado por otra persona que sigue a cargo y cuenta como «Sin contactar» en el modal (caso Frans).
