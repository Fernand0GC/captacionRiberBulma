import { ROLE_LABEL } from '@/features/auth/types'
import { METHOD_LABEL, RESULT_LABEL } from '@/features/followup/api'
import { STAGE_LABEL } from '@/features/prospects/format'
import { activityTotals, branchTotals, perStaff } from './activity'
import type { AgentActivityFilters, AgentActivityRow, AgentAssignedRow, BranchActivityRow } from './api'
import { OUTCOME_GROUPS } from './assigned'
import { ACTIVITY_METRICS } from './labels'
import { dmy, downloadSheet, fileSafe, laPazWallClock, type Column } from './xlsx'

/** Hoja ACTIVIDAD (contracts/excel-export.md): las filas en el orden de la pantalla y la fila TOTAL. */
export async function exportActivity(rows: AgentActivityRow[], filters: AgentActivityFilters, scopeName: string): Promise<void> {
  const columns: Column<AgentActivityRow>[] = [
    { header: 'Personal', width: 28, value: (r) => r.full_name },
    { header: 'Rol', width: 14, value: (r) => ROLE_LABEL[r.role] },
    { header: 'Activo', width: 8, value: (r) => (r.active ? 'Sí' : 'No') },
    ...ACTIVITY_METRICS.map((m) => ({ header: m.label, width: 12, value: (r: AgentActivityRow) => r[m.key] })),
    { header: 'Asignados contactados', width: 13, value: (r) => r.assigned_contacted },
  ]
  const t = activityTotals(rows)
  await downloadSheet({
    sheet: 'ACTIVIDAD',
    title: `Actividad · ${scopeName} · del ${dmy(filters.from)} al ${dmy(filters.to)}`,
    columns,
    rows,
    footer: ['TOTAL', null, null, ...ACTIVITY_METRICS.map((m) => t[m.key]), rows.reduce((a, r) => a + r.assigned_contacted, 0)],
    fileName: `Actividad_${fileSafe(scopeName)}_${filters.from}_${filters.to}.xlsx`,
  })
}

/** Hoja POR SUCURSAL: la pestaña «Por sucursal» en el orden de la pantalla y la fila TOTAL. */
export async function exportBranchActivity(rows: BranchActivityRow[], filters: AgentActivityFilters, scopeName: string): Promise<void> {
  const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10)
  const columns: Column<BranchActivityRow>[] = [
    { header: 'Sucursal', width: 20, value: (r) => r.name },
    { header: 'Personal activo', width: 14, value: (r) => r.staff },
    { header: 'Contactaron', width: 12, value: (r) => r.actors },
    { header: 'Prom. por persona', width: 14, value: (r) => round1(perStaff(r.total, r.staff)) },
    ...ACTIVITY_METRICS.map((m) => ({ header: m.label, width: 12, value: (r: BranchActivityRow) => r[m.key] })),
  ]
  const t = branchTotals(rows)
  await downloadSheet({
    sheet: 'POR SUCURSAL',
    title: `Actividad por sucursal · ${scopeName} · del ${dmy(filters.from)} al ${dmy(filters.to)}`,
    columns,
    rows,
    footer: ['TOTAL', t.staff, t.actors, round1(perStaff(t.total, t.staff)), ...ACTIVITY_METRICS.map((m) => t[m.key])],
    fileName: `Actividad_por_sucursal_${fileSafe(scopeName)}_${filters.from}_${filters.to}.xlsx`,
  })
}

/** Hoja ASIGNADOS (spec 012): los clientes asignados a una persona en el período, como la pestaña del detalle. */
export async function exportAssigned(rows: AgentAssignedRow[], filters: AgentActivityFilters, actorName: string): Promise<void> {
  const outcome = (r: AgentAssignedRow) => OUTCOME_GROUPS.find((g) => g.key === r.outcome)?.label ?? ''
  const columns: Column<AgentAssignedRow>[] = [
    { header: 'Cliente', width: 28, value: (r) => r.full_name },
    { header: 'Asignado', width: 16, date: true, value: (r) => laPazWallClock(r.assigned_at) },
    { header: 'Quién asignó', width: 24, value: (r) => (r.self_assigned ? 'Lo tomó por su cuenta' : r.assigned_by) },
    { header: 'Etapa al asignarse', width: 16, value: (r) => STAGE_LABEL[r.stage_at] ?? r.stage_at },
    { header: 'Contactos', width: 10, value: (r) => r.contacts },
    { header: 'Primer contacto', width: 16, date: true, value: (r) => laPazWallClock(r.first_at) },
    { header: 'Último contacto', width: 30, value: (r) => (r.last_method && r.last_result ? `${METHOD_LABEL[r.last_method]} · ${RESULT_LABEL[r.last_result]}` : 'Sin contactar') },
    { header: 'Observación', width: 30, value: (r) => r.last_note },
    // 024: el resultado es la etapa en que lo dejó; «Etapa hoy» muestra si otra persona lo avanzó después.
    { header: 'Etapa en que lo dejó', width: 18, value: (r) => STAGE_LABEL[r.stage_left] ?? r.stage_left },
    { header: 'Etapa hoy', width: 16, value: (r) => STAGE_LABEL[r.stage_now] ?? r.stage_now },
    { header: 'Resultado', width: 22, value: outcome },
    { header: 'Cuenta en asignados', width: 18, value: (r) => (r.counted ? 'Sí' : 'No (reasignado sin contactar)') },
    { header: 'Reasignado a', width: 22, value: (r) => (r.reassigned ? (r.reassigned_to ?? 'Sin responsable') : null) },
  ]
  await downloadSheet({
    sheet: 'ASIGNADOS',
    title: `Clientes asignados · ${actorName} · del ${dmy(filters.from)} al ${dmy(filters.to)}`,
    columns,
    rows,
    fileName: `Asignados_${fileSafe(actorName)}_${filters.from}_${filters.to}.xlsx`,
  })
}
