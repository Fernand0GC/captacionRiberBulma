import { ROLE_LABEL } from '@/features/auth/types'
import { activityTotals } from './activity'
import type { AgentActivityFilters, AgentActivityRow } from './api'
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
