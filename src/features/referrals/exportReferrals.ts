import { STAGE_LABEL } from '@/features/prospects/format'
import type { ReferralReport, ReportRow } from './api'
import { conversion, fulfillment, KIND_LABEL, monthDays, monthLabel, totals } from './logic'

// Excel del reporte de referidos (FR-012): mismas filas y columnas que la pantalla, en tres hojas
// (Resumen, Por día, Contactos). exceljs se carga recién al exportar (constitución II).

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

export async function exportReferrals(report: ReferralReport): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Riber Captación'
  const title = `Referidos · ${report.branch} · ${monthLabel(report.month)}`
  const name = (id: number) => report.referrers.find((r) => r.id === id)

  const sheet = (sheetName: string, headers: { header: string; width: number; numFmt?: string }[]) => {
    const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 3 }] })
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

  // Resumen
  const summary = sheet('RESUMEN', [
    { header: 'Referidor', width: 28 },
    { header: 'Tipo', width: 14 },
    { header: 'Llegados', width: 10 },
    { header: 'Sin contactar', width: 12 },
    { header: 'En seguimiento', width: 13 },
    { header: 'Compraron', width: 11 },
    { header: 'Sin interés', width: 11 },
    { header: 'Conversión', width: 11, numFmt: '0%' },
    { header: 'Meta', width: 8 },
    { header: 'Cumplimiento', width: 13, numFmt: '0%' },
  ])
  const line = (label: string, kind: string, r: ReportRow | ReturnType<typeof totals>) => [
    label,
    kind,
    r.arrived,
    r.uncontacted,
    r.in_followup,
    r.sold,
    r.lost,
    ratio(conversion(r)),
    r.goal,
    ratio(fulfillment(r)),
  ]
  report.referrers.forEach((r) => summary.addRow(line(r.active ? r.name : `${r.name} (desactivado)`, KIND_LABEL[r.kind], r)))
  summary.addRow(line('TOTAL', '', totals(report.referrers))).font = { bold: true }

  // Por día
  const days = monthDays(report.days)
  const daily = sheet('POR DIA', [
    { header: 'Referidor', width: 28 },
    { header: 'Dato', width: 10 },
    ...days.map((d) => ({ header: String(d), width: 4 })),
    { header: 'Total', width: 7 },
  ])
  report.referrers.forEach((r) => {
    const arrived = days.map((d) => r.by_day[String(d)]?.arrived ?? 0)
    const sold = days.map((d) => r.by_day[String(d)]?.sold ?? 0)
    daily.addRow([r.name, 'Llegados', ...arrived.map((n) => n || null), arrived.reduce((s, n) => s + n, 0)])
    daily.addRow(['', 'Compras', ...sold.map((n) => n || null), sold.reduce((s, n) => s + n, 0)])
  })

  // Contactos
  const contacts = sheet('CONTACTOS', [
    { header: 'Referidor', width: 24 },
    { header: 'Tipo', width: 12 },
    { header: 'Nombre', width: 28 },
    { header: 'Celular', width: 14 },
    { header: 'Producto', width: 22 },
    { header: 'Responsable', width: 24 },
    { header: 'Etapa', width: 16 },
    { header: 'Llegó', width: 16, numFmt: 'dd/mm/yyyy hh:mm' },
    { header: 'Venta', width: 16, numFmt: 'dd/mm/yyyy hh:mm' },
  ])
  report.contacts.forEach((c) => {
    const r = name(c.referrer_id)
    contacts.addRow([
      r?.name ?? '',
      r ? KIND_LABEL[r.kind] : '',
      c.full_name,
      c.phone,
      c.product,
      c.assigned_to,
      STAGE_LABEL[c.stage] ?? c.stage,
      wall(c.arrived_at),
      wall(c.sold_at),
    ])
  })

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `referidos-${slug(report.branch)}-${report.month.slice(0, 7)}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
