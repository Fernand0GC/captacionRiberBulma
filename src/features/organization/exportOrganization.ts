import { SHIFT_LABEL, type Assignment } from './api'
import { totals } from './logic'

// Exportación de la organización (contracts/excel-export.md de la 003): mismas columnas y orden que la planilla de ventas;
// desde la 004, «Meta compartidas» y «Resul. compartidas» van después de «Resul.» (research R8). Desde la 006, «Compartidas
// verificadas» y «Volanteras»; las filas llegan ordenadas por persona y los totales llevan formato de número (research R1).

/** Fecha ISO → Date de Excel a mediodía UTC (sin corrimiento por zona horaria). */
const excelDate = (iso: string) => new Date(`${iso}T12:00:00Z`)
/** "HH:MM" → fracción de día, que Excel muestra como hora. */
const excelTime = (hhmm: string | null) => {
  if (!hhmm) return null
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return (h * 60 + m) / 1440
}
const dmy = (iso: string) => iso.split('-').reverse().join('/')
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Genera y descarga el Excel de las filas visibles. Devuelve cuántas filas exportó (0 = no generó archivo). */
export async function exportOrganization(rows: Assignment[], scopeName: string, from: string, to: string): Promise<number> {
  if (rows.length === 0) return 0
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Riber Captación'
  const ws = wb.addWorksheet('ORGANIZACION', { views: [{ state: 'frozen', ySplit: 6 }] })

  ws.getCell('A1').value = `Organización comercial · ${scopeName} · del ${dmy(from)} al ${dmy(to)}`
  ws.getCell('A1').font = { bold: true, size: 14 }
  const t = totals(rows)
  const summary: [string, number][] = [
    ['Meta de captación', t.goal],
    ['Captados', t.result],
    ['Meta de compartidas', t.shareGoal],
    ['Compartidas', t.shareResult],
    ['N° de asignaciones', t.count],
  ]
  summary.forEach(([label, n], i) => {
    ws.getCell(3, 1 + i * 2).value = label
    ws.getCell(3, 1 + i * 2).font = { color: { argb: 'FF6B6B6B' } }
    ws.getCell(4, 1 + i * 2).value = n
    ws.getCell(4, 1 + i * 2).font = { bold: true, size: 13 }
  })

  const columns: { header: string; width: number; numFmt?: string; value: (r: Assignment) => string | number | Date | null }[] = [
    { header: 'Fecha', width: 12, numFmt: 'dd/mm/yyyy', value: (r) => excelDate(r.work_date) },
    { header: 'Gerente', width: 28, value: (r) => r.lead },
    { header: 'Sucursal', width: 16, value: (r) => r.branch },
    { header: 'Turno', width: 9, value: (r) => SHIFT_LABEL[r.shift] },
    { header: 'Hora Inicio', width: 11, numFmt: 'hh:mm', value: (r) => excelTime(r.start_time) },
    { header: 'Hora Fin', width: 11, numFmt: 'hh:mm', value: (r) => excelTime(r.end_time) },
    { header: 'Personal', width: 28, value: (r) => r.person },
    { header: 'Estrategia', width: 11, value: (r) => r.strategy },
    { header: 'Canal', width: 22, value: (r) => r.channel },
    { header: 'Subcanal', width: 36, value: (r) => r.subchannel },
    { header: 'Ubicación /Lugar', width: 24, value: (r) => r.place },
    { header: 'Meta', width: 8, numFmt: '#,##0', value: (r) => r.goal },
    { header: 'Resul.', width: 8, numFmt: '#,##0', value: (r) => r.result },
    { header: 'Meta compartidas', width: 11, numFmt: '#,##0', value: (r) => r.share_goal },
    { header: 'Resul. compartidas', width: 11, numFmt: '#,##0', value: (r) => r.share_result },
    { header: 'Hecho', width: 10, value: (r) => r.done === null ? null : r.done ? 'Sí' : 'No' },
    { header: 'Compartidas verificadas', width: 12, numFmt: '#,##0', value: (r) => r.share_verified },
    { header: 'Volanteras', width: 30, value: (r) => r.flyers.map((f) => f.name).join(', ') || null },
    { header: 'Freelancers', width: 30, value: (r) => (r.freelancers ?? []).map((f) => f.name).join(', ') || null },
    { header: 'Observaciones', width: 36, value: (r) => r.notes },
    { header: 'Registrado por', width: 28, value: (r) => r.result_by_name },
  ]
  const header = ws.getRow(6)
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2A44' } }
    ws.getColumn(i + 1).width = c.width
    if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt
  })
  // Totales como número entero (research R1). Va DESPUÉS del formato de columna: exceljs lo aplica también a las
  // celdas que ya existen, y A es fecha y E es hora (por eso salía «#####» o «00:00»).
  summary.forEach((_, i) => {
    ws.getCell(4, 1 + i * 2).numFmt = '#,##0'
  })
  rows.forEach((r, n) => {
    const row = ws.getRow(7 + n)
    columns.forEach((c, i) => {
      row.getCell(i + 1).value = c.value(r)
    })
  })
  ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6 + rows.length, column: columns.length } }

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `organizacion_${slug(scopeName)}_${from}_${to}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
  return rows.length
}
