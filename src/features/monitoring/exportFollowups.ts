import { METHOD_LABEL, RESULT_LABEL } from '@/features/followup/api'
import { INTEREST_LABEL, STAGE_LABEL } from '@/features/prospects/format'
import { fetchAllFollowupStatus, type FollowupStatusFilters, type FollowupStatusRow } from './api'
import { FOLLOWUP_TABS } from './labels'
import { dmy, downloadSheet, fileSafe, laPazWallClock, type Column } from './xlsx'

/** Hoja SEGUIMIENTOS (contracts/excel-export.md). Devuelve cuántas filas exportó. */
export async function exportFollowups(filters: FollowupStatusFilters, scopeName: string): Promise<number> {
  const rows = await fetchAllFollowupStatus(filters)
  const tab = FOLLOWUP_TABS.find((t) => t.tab === filters.tab)?.label ?? 'Todos'
  const columns: Column<FollowupStatusRow>[] = [
    { header: 'Cliente', width: 28, value: (r) => r.full_name },
    { header: 'Celular', width: 13, value: (r) => r.phone_raw },
    { header: 'Sucursal', width: 14, value: (r) => r.branch_name },
    { header: 'Responsable', width: 24, value: (r) => r.assigned_to_name ?? 'Sin asignar' },
    { header: 'Etapa', width: 16, value: (r) => STAGE_LABEL[r.stage] ?? r.stage },
    { header: 'Interés', width: 10, value: (r) => (r.interest ? INTEREST_LABEL[r.interest] : null) },
    { header: 'No contestó seguidos', width: 11, value: (r) => r.no_answer_streak },
    { header: 'Contactos totales', width: 11, value: (r) => r.contacts_total },
    { header: 'Último contacto', width: 17, value: (r) => laPazWallClock(r.last_contacted_at), date: true },
    { header: 'Forma', width: 16, value: (r) => (r.last_method ? METHOD_LABEL[r.last_method] : null) },
    { header: 'Resultado', width: 20, value: (r) => (r.last_result ? RESULT_LABEL[r.last_result] : null) },
    { header: 'Hecho por', width: 22, value: (r) => r.last_actor_name },
    { header: 'Observación', width: 50, value: (r) => r.last_note },
    { header: 'Próximo contacto', width: 17, value: (r) => laPazWallClock(r.next_contact_at), date: true },
    { header: 'Vencido', width: 9, value: (r) => (r.overdue ? 'Sí' : 'No') },
    { header: 'Días sin contacto', width: 10, value: (r) => r.days_without_contact },
    { header: 'Motivo sin interés', width: 22, value: (r) => r.lost_reason },
    { header: 'Canal', width: 16, value: (r) => r.channel_name },
    { header: 'Registrado por', width: 22, value: (r) => r.created_by_name },
    { header: 'Fecha de registro', width: 17, value: (r) => laPazWallClock(r.client_created_at), date: true },
  ]
  await downloadSheet({
    sheet: 'SEGUIMIENTOS',
    title: `Seguimientos · ${tab} · ${scopeName} · registrados del ${dmy(filters.from)} al ${dmy(filters.to)}`,
    columns,
    rows,
    fileName: `Seguimientos_${fileSafe(scopeName)}_${filters.from}_${filters.to}.xlsx`,
  })
  return rows.length
}
