// Excel del reporte del día (spec 009, US2): resumen, registros nuevos y clientes con seguimiento. Se carga lazy.
import { METHOD_LABEL, RESULT_LABEL } from '@/features/followup/api'
import { STAGE_LABEL } from '@/features/prospects/format'
import { ROLE_LABEL } from '@/features/auth/types'
import type { AgendaPersonView } from './agenda'
import type { DailyFollowedRow, DailyNewRow, DailyReport } from './api'
import { fmtAvg, perDay, perPerson } from './daily'
import { addSheet, dmy, fileSafe, laPazWallClock, newWorkbook, saveWorkbook } from './xlsx'

const origin = (r: { referrer: string | null; channel: string | null }) =>
  r.referrer ? `Referido · ${r.referrer}` : (r.channel ?? '')

/** `agenda`: solo cuando el día es hoy (spec 023); agrega la hoja «Agenda» con una fila por persona. */
export async function exportDaily(
  report: DailyReport,
  scopeName: string,
  originName: string,
  agenda?: AgendaPersonView[],
): Promise<void> {
  const t = report.totals
  const when = dmy(report.from)
  const wb = await newWorkbook()

  addSheet<[string, string | number]>(wb, {
    sheet: 'Resumen',
    title: `Del día ${when} · ${scopeName} · ${originName}`,
    columns: [
      { header: 'Dato', width: 34, value: (r) => r[0] },
      { header: 'Valor', width: 14, value: (r) => r[1] },
    ],
    rows: [
      ['Registros nuevos', t.new],
      ['Personas que registraron', t.new_people],
      ['Promedio por persona', fmtAvg(perPerson(t))],
      ['Promedio por día (últimos 7 días)', fmtAvg(perDay(t))],
      ['Clientes con seguimiento', t.followed],
      ['Clientes con contacto efectivo', t.effective],
      ['Contactos totales', t.contacts],
    ],
  })

  addSheet<DailyNewRow>(wb, {
    sheet: 'Registros nuevos',
    title: `Registros nuevos · ${when} · ${scopeName}`,
    columns: [
      { header: 'Registrado', width: 18, value: (r) => laPazWallClock(r.registered_at), date: true },
      { header: 'Cliente', width: 28, value: (r) => r.full_name },
      { header: 'Celular', width: 14, value: (r) => r.phone },
      { header: 'Canal / referidor', width: 28, value: origin },
      { header: 'Registró', width: 24, value: (r) => r.created_by },
      { header: 'Responsable', width: 24, value: (r) => r.assigned_to ?? '' },
      { header: 'Etapa', width: 18, value: (r) => STAGE_LABEL[r.stage] ?? r.stage },
      { header: 'Sucursal', width: 16, value: (r) => r.branch },
    ],
    rows: report.new_rows,
  })

  addSheet<DailyFollowedRow>(wb, {
    sheet: 'Con seguimiento',
    title: `Clientes con seguimiento · ${when} · ${scopeName}`,
    columns: [
      { header: 'Último contacto', width: 18, value: (r) => laPazWallClock(r.last_at), date: true },
      { header: 'Forma', width: 16, value: (r) => METHOD_LABEL[r.last_method] ?? r.last_method },
      { header: 'Cliente', width: 28, value: (r) => r.full_name },
      { header: 'Celular', width: 14, value: (r) => r.phone },
      { header: 'Contactos del día', width: 10, value: (r) => r.contacts },
      { header: 'Último resultado', width: 22, value: (r) => RESULT_LABEL[r.last_result] ?? r.last_result },
      { header: 'Efectivo', width: 10, value: (r) => (r.effective ? 'Sí' : 'No') },
      { header: 'Contactó', width: 24, value: (r) => r.last_actor },
      { header: 'Registrado', width: 18, value: (r) => laPazWallClock(r.registered_at), date: true },
      { header: 'Canal / referidor', width: 28, value: origin },
      { header: 'Etapa', width: 18, value: (r) => STAGE_LABEL[r.stage] ?? r.stage },
      { header: 'Sucursal', width: 16, value: (r) => r.branch },
    ],
    rows: report.followed_rows,
  })

  if (agenda) {
    addSheet<AgendaPersonView>(wb, {
      sheet: 'Agenda',
      title: `Agenda de recontacto ${when} · ${scopeName} · todos los orígenes`,
      columns: [
        { header: 'Persona', width: 28, value: (p) => p.full_name },
        { header: 'Rol', width: 14, value: (p) => ROLE_LABEL[p.role] },
        { header: 'Le tocaba hoy', width: 12, value: (p) => p.due },
        { header: 'Contactó', width: 11, value: (p) => p.done.length },
        { header: 'Pendientes', width: 11, value: (p) => p.pending.length },
        { header: 'Atrasados', width: 11, value: (p) => p.late.length },
        // Spec 026: desglose de los atrasados y la prioridad que marcó la jefa.
        { header: 'Atrasados 1 día', width: 11, value: (p) => p.lateBy.age.d1 },
        { header: 'Atrasados 2 a 7 días', width: 11, value: (p) => p.lateBy.age.d2to7 },
        { header: 'Atrasados más de 7 días', width: 11, value: (p) => p.lateBy.age.over7 },
        { header: 'Nunca contactados', width: 11, value: (p) => p.lateBy.type.never },
        { header: 'Fecha vencida', width: 11, value: (p) => p.lateBy.type.overdue },
        { header: 'Prioridad hoy', width: 11, value: (p) => p.priority },
      ],
      rows: agenda,
    })
  }

  await saveWorkbook(wb, `del-dia_${fileSafe(scopeName)}_${report.from}.xlsx`)
}
