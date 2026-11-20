import { ROLE_LABEL } from '@/features/auth/types'
import { activityTotals, branchTotals, perStaff } from './activity'
import type { AgentActivityFilters, AgentActivityRow, BranchActivityRow } from './api'
import { ACTIVITY_METRICS } from './labels'
import { dmy, downloadSheet, fileSafe, type Column } from './xlsx'

/** Hoja ACTIVIDAD (contracts/excel-export.md): las filas en el orden de la pantalla y la fila TOTAL. */
export async function exportActivity(rows: AgentActivityRow[], filters: AgentActivityFilters, scopeName: string): Promise<void> {
  const columns: Column<AgentActivityRow>[] = [
    { header: 'Personal', width: 28, value: (r) => r.full_name },
    { header: 'Rol', width: 14, value: (r) => ROLE_LABEL[r.role] },
    { header: 'Activo', width: 8, value: (r) => (r.active ? 'Sí' : 'No') },
    ...ACTIVITY_METRICS.map((m) => ({ header: m.label, width: 12, value: (r: AgentActivityRow) => r[m.key] })),
  ]
  const t = activityTotals(rows)
  await downloadSheet({
    sheet: 'ACTIVIDAD',
    title: `Actividad · ${scopeName} · del ${dmy(filters.from)} al ${dmy(filters.to)}`,
    columns,
    rows,
    footer: ['TOTAL', null, null, ...ACTIVITY_METRICS.map((m) => t[m.key])],
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
