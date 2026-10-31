import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { INTEREST_LABEL, STAGE_LABEL } from '@/features/prospects/format'
import type { ProspectFilters, ProspectRow } from '@/features/prospects/api'

const BATCH = 200 // máximo que acepta list_prospects por página
const LA_PAZ_OFFSET_MS = 4 * 3600_000 // Bolivia: UTC-4 todo el año, sin horario de verano

/** Trae todas las captaciones del filtro (de a 200). */
async function fetchAll(filters: ProspectFilters): Promise<ProspectRow[]> {
  const rows: ProspectRow[] = []
  for (let offset = 0; ; offset += BATCH) {
    const { data, error } = await supabase.rpc('list_prospects', {
      f: filters,
      p_limit: BATCH,
      p_offset: offset,
    })
    if (error) throw toAppError(error)
    const page = data as { total: number; rows: ProspectRow[] }
    rows.push(...page.rows)
    if (page.rows.length < BATCH || rows.length >= page.total) return rows
  }
}

/** Excel guarda la fecha "de pared": se corre a la hora de La Paz para que se vea igual que en la app. */
const laPazWallClock = (iso: string) => new Date(new Date(iso).getTime() - LA_PAZ_OFFSET_MS)

function interestLabel(r: ProspectRow) {
  if (r.stage === 'sale') return 'COMPRA'
  if (r.stage === 'lost') return 'Perdido'
  return r.interest ? INTEREST_LABEL[r.interest] : ''
}

/** Hoja CLIENTES del modelo Unificado.xlsx (contracts/excel-export.md). Devuelve cuántas filas exportó. */
export async function exportProspects(filters: ProspectFilters, scopeName: string): Promise<number> {
  const [{ default: ExcelJS }, rows] = await Promise.all([import('exceljs'), fetchAll(filters)])
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Riber Captación'
  const ws = wb.addWorksheet('CLIENTES', { views: [{ state: 'frozen', ySplit: 6 }] })

  ws.getCell('A1').value =
    `Captaciones · ${scopeName} · del ${filters.from.split('-').reverse().join('/')} al ${filters.to.split('-').reverse().join('/')}`
  ws.getCell('A1').font = { bold: true, size: 14 }
  const summary: [string, number][] = [
    ['Clientes registrados', rows.length],
    ['Interés alto', rows.filter((r) => r.interest === 'high').length],
    ['Interés medio', rows.filter((r) => r.interest === 'medium').length],
    ['Ventas', rows.filter((r) => r.stage === 'sale').length],
    ['Sin interés', rows.filter((r) => r.stage === 'lost').length],
  ]
  summary.forEach(([label, n], i) => {
    ws.getCell(3, 1 + i * 2).value = label
    ws.getCell(3, 1 + i * 2).font = { color: { argb: 'FF6B6B6B' } }
    ws.getCell(4, 1 + i * 2).value = n
    ws.getCell(4, 1 + i * 2).font = { bold: true, size: 13 }
  })

  const columns: {
    header: string
    width: number
    value: (r: ProspectRow, i: number) => string | number | Date | null
  }[] = [
    { header: 'Nº', width: 6, value: (_, i) => i + 1 },
    { header: 'Nombre completo', width: 30, value: (r) => r.full_name },
    { header: 'Teléfono / celular', width: 14, value: (r) => r.phone_raw },
    { header: 'Ocupación', width: 26, value: (r) => r.occupation },
    { header: 'Producto', width: 22, value: (r) => r.product_name },
    { header: 'Dirección / referencia', width: 30, value: (r) => r.address },
    { header: 'Tipo de interés', width: 14, value: interestLabel },
    { header: 'Fecha de captación', width: 18, value: (r) => laPazWallClock(r.client_created_at) },
    { header: 'Sucursal', width: 14, value: (r) => r.branch_name },
    { header: 'Canal', width: 18, value: (r) => r.channel_name },
    { header: 'Registró', width: 24, value: (r) => r.created_by_name },
    { header: 'Etapa', width: 16, value: (r) => STAGE_LABEL[r.stage] ?? r.stage },
    { header: 'Responsable seguimiento', width: 24, value: (r) => r.assigned_to_name },
    { header: 'Turno', width: 9, value: (r) => (r.shift === 'morning' ? 'Mañana' : 'Tarde') },
  ]
  const HEADER_ROW = 6
  const header = ws.getRow(HEADER_ROW)
  columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width
    const cell = header.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, color: { argb: 'FFE6C567' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B0B0C' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  header.height = 30
  rows.forEach((r, i) => {
    const row = ws.getRow(HEADER_ROW + 1 + i)
    columns.forEach((c, j) => (row.getCell(j + 1).value = c.value(r, i)))
  })
  ws.getColumn(8).numFmt = 'dd/mm/yyyy hh:mm'
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: columns.length } }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `captacion_${scopeName.replace(/\s+/g, '-')}_${filters.from}_${filters.to}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  return rows.length
}
