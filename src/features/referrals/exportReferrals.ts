import type { Workbook, Worksheet } from 'exceljs'
import type { RangeContact, RangeReport, RangeRow } from './api'
import { contactStage, conversion, dayColumns, fulfillment, KIND_LABEL, rangeLabel, sortRegistrars, sumDays, totals, type ReferrerKind } from './logic'

// Excel de Referidos (spec 005 FR-012 + spec 014 FR-010): respeta período, sucursal y filtros de la pantalla.
// exceljs se carga recién al exportar (constitución II).

const LA_PAZ_OFFSET_MS = 4 * 3600_000 // Bolivia: UTC-4 todo el año
/** Excel guarda la fecha "de pared": se corre a la hora de La Paz. */
const wall = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - LA_PAZ_OFFSET_MS) : null)
const ratio = (p: number | null) => (p === null ? null : p / 100)
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const HEADER_FONT = { bold: true, color: { argb: 'FFE6C567' } }
const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF0B0B0C' } }

type Col = { header: string; width: number; numFmt?: string }

function addSheet(wb: Workbook, title: string, name: string, headers: Col[]): Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3 }] })
  ws.getCell('A1').value = title
  ws.getCell('A1').font = { bold: true, size: 14 }
  const row = ws.getRow(3)
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = h.width
    if (h.numFmt) ws.getColumn(i + 1).numFmt = h.numFmt
    const cell = row.getCell(i + 1)
    cell.value = h.header
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  row.height = 30
  return ws
}

const COUNT_COLS: Col[] = [
  { header: 'Llegados', width: 10 },
  { header: 'Sin contactar', width: 12 },
  { header: 'En seguimiento', width: 13 },
  { header: 'Compraron', width: 11 },
  { header: 'Sin interés', width: 11 },
  { header: 'Conversión', width: 11, numFmt: '0%' },
  { header: 'Meta', width: 8, numFmt: '0.#' },
  { header: 'Cumplimiento', width: 13, numFmt: '0%' },
]

const counts = (r: Parameters<typeof conversion>[0] & { goal: number | null }) => [
  r.arrived,
  r.uncontacted,
  r.in_followup,
  r.sold,
  r.lost,
  ratio(conversion(r)),
  r.goal,
  ratio(fulfillment(r)),
]

function contactsSheet(wb: Workbook, title: string, list: RangeContact[]) {
  const ws = addSheet(wb, title, 'CONTACTOS', [
    { header: 'Sucursal', width: 14 },
    { header: 'Referidor', width: 24 },
    { header: 'Nombre', width: 28 },
    { header: 'Celular', width: 14 },
    { header: 'Producto', width: 22 },
    { header: 'Responsable', width: 24 },
    { header: 'Registrado por', width: 24 },
    { header: 'Etapa', width: 16 },
    { header: 'Días esperando', width: 10 },
    { header: 'Llegó', width: 16, numFmt: 'dd/mm/yyyy hh:mm' },
    { header: 'Último contacto', width: 16, numFmt: 'dd/mm/yyyy hh:mm' },
    { header: 'Venta', width: 16, numFmt: 'dd/mm/yyyy hh:mm' },
  ])
  list.forEach((c) =>
    ws.addRow([
      c.branch_name,
      c.referrer_name,
      c.full_name,
      c.phone,
      c.product,
      c.assigned_to,
      c.registered_by,
      contactStage(c),
      c.days_waiting,
      wall(c.arrived_at),
      wall(c.last_contact_at),
      wall(c.sold_at),
    ]),
  )
}

async function download(wb: Workbook, file: string) {
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = file
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

/** Reporte completo: Sucursales (varias) o Resumen + Por día (una), y Contactos y Quién registra. */
export async function exportRangeReport(
  report: RangeReport,
  opts: { rows: RangeRow[]; scopeName: string; kind?: ReferrerKind },
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Riber Captación'
  const title = `Referidos · ${opts.scopeName} · ${rangeLabel(report.from, report.to)}${opts.kind ? ` · ${KIND_LABEL[opts.kind]}` : ''}${report.goal_prorated ? ' · metas prorrateadas' : ''}`

  if (report.branch_id === null) {
    const ws = addSheet(wb, title, 'SUCURSALES', [{ header: 'Sucursal', width: 18 }, { header: 'Referidores', width: 11 }, ...COUNT_COLS, { header: 'Captaciones', width: 11 }])
    report.by_branch.forEach((b) => ws.addRow([b.name, b.referrers, ...counts(b), b.captures]))
    ws.addRow(['TOTAL', report.by_branch.reduce((n, b) => n + b.referrers, 0), ...counts(report.totals), report.totals.captures]).font = { bold: true }
  } else {
    const ws = addSheet(wb, title, 'RESUMEN', [{ header: 'Referidor', width: 28 }, { header: 'Tipo', width: 14 }, ...COUNT_COLS])
    opts.rows.forEach((r) => ws.addRow([r.active ? r.name : `${r.name} (desactivado)`, KIND_LABEL[r.kind], ...counts(r)]))
    ws.addRow(['TOTAL', '', ...counts(totals(opts.rows))]).font = { bold: true }

    const cols = dayColumns(report.from, report.to)
    const daily = addSheet(wb, title, 'POR DIA', [
      { header: 'Referidor', width: 28 },
      { header: 'Dato', width: 10 },
      ...cols.map((c) => ({ header: c.days.length > 1 ? c.label : c.key.slice(5).split('-').reverse().join('/'), width: c.days.length > 1 ? 8 : 6 })),
      { header: 'Total', width: 7 },
    ])
    opts.rows.forEach((r) => {
      const v = cols.map((c) => sumDays(r.by_day, c))
      daily.addRow([r.name, 'Llegados', ...v.map((x) => x.arrived || null), v.reduce((n, x) => n + x.arrived, 0)])
      daily.addRow(['', 'Compras', ...v.map((x) => x.sold || null), v.reduce((n, x) => n + x.sold, 0)])
    })
  }

  const ids = new Set(opts.rows.map((r) => r.id))
  contactsSheet(wb, title, report.branch_id === null ? report.contacts : report.contacts.filter((c) => ids.has(c.referrer_id)))

  const reg = addSheet(wb, title, 'QUIEN REGISTRA', [
    { header: 'Persona', width: 28 },
    { header: 'Sucursal', width: 16 },
    { header: 'Captaciones', width: 12 },
    { header: 'Referidas', width: 10 },
    { header: '% referidas', width: 11, numFmt: '0%' },
  ])
  sortRegistrars(report.registrars).forEach((r) => reg.addRow([r.name, r.branch_name, r.captures, r.referred, r.captures ? r.referred / r.captures : null]))

  await download(wb, `referidos-${slug(opts.scopeName)}-${report.from}-a-${report.to}.xlsx`)
}

/** Solo la lista de contactos con los filtros de la pestaña Contactos. */
export async function exportContacts(list: RangeContact[], opts: { title: string }): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Riber Captación'
  contactsSheet(wb, opts.title, list)
  await download(wb, `${slug(opts.title)}.xlsx`)
}
