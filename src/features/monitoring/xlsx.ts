// Armado y descarga de una hoja simple para los Excel de monitoreo (contracts/excel-export.md). Se carga lazy.

const LA_PAZ_OFFSET_MS = 4 * 3600_000 // Bolivia: UTC-4 todo el año, sin horario de verano

/** Excel guarda la fecha "de pared": se corre a la hora de La Paz para que se vea igual que en la app. */
export const laPazWallClock = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - LA_PAZ_OFFSET_MS) : null)

export type Column<T> = {
  header: string
  width: number
  value: (r: T) => string | number | Date | null
  date?: boolean
}

export async function downloadSheet<T>(opts: {
  sheet: string
  title: string
  columns: Column<T>[]
  rows: T[]
  /** Fila final (p. ej. TOTAL), en negrita. */
  footer?: (string | number | null)[]
  fileName: string
}): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Riber Captación'
  const HEADER_ROW = 3
  const ws = wb.addWorksheet(opts.sheet, { views: [{ state: 'frozen', ySplit: HEADER_ROW }] })
  ws.getCell('A1').value = opts.title
  ws.getCell('A1').font = { bold: true, size: 14 }

  const header = ws.getRow(HEADER_ROW)
  opts.columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width
    if (c.date) ws.getColumn(i + 1).numFmt = 'dd/mm/yyyy hh:mm'
    const cell = header.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, color: { argb: 'FFE6C567' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B0B0C' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  header.height = 30
  opts.rows.forEach((r, i) => {
    const row = ws.getRow(HEADER_ROW + 1 + i)
    opts.columns.forEach((c, j) => (row.getCell(j + 1).value = c.value(r)))
  })
  if (opts.footer) {
    const row = ws.getRow(HEADER_ROW + 1 + opts.rows.length)
    opts.footer.forEach((v, j) => (row.getCell(j + 1).value = v))
    row.font = { bold: true }
  }
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: opts.columns.length } }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = opts.fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

export const fileSafe = (s: string) => s.replace(/\s+/g, '-')
export const dmy = (iso: string) => iso.split('-').reverse().join('/')
