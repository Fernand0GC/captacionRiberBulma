// Cálculos del reporte de referidos (spec 005, research R5). Los conteos vienen del servidor; aquí solo se derivan
// porcentajes, totales y agrupaciones para la pantalla y el Excel.

export type ReferrerKind = 'staff' | 'freelance' | 'client' | 'channel' | 'other'

export const KIND_LABEL: Record<ReferrerKind, string> = {
  staff: 'Personal',
  freelance: 'Freelance',
  client: 'Cliente',
  channel: 'Canal o app',
  other: 'Otro',
}

export const KINDS = Object.keys(KIND_LABEL) as ReferrerKind[]

/** Conteos de un referidor (o de un grupo) en el mes. */
export type Counts = { arrived: number; uncontacted: number; in_followup: number; sold: number; lost: number }

/** Una fila con meta: null = sin meta. */
export type CountsWithGoal = Counts & { goal: number | null }

/** Porcentaje entero o null si no hay base (división por cero). */
export function percent(part: number, whole: number | null): number | null {
  if (whole === null || whole <= 0) return null
  return Math.round((part / whole) * 100)
}

/** Conversión = compraron ÷ llegados. */
export const conversion = (r: Counts) => percent(r.sold, r.arrived)

/** Cumplimiento = llegados ÷ meta. Sin meta: null (se muestra sin cumplimiento). */
export const fulfillment = (r: CountsWithGoal) => percent(r.arrived, r.goal)

export const fmtPercent = (p: number | null) => (p === null ? '—' : `${p}%`)

/** Suma de conteos. La meta total suma solo las que existen; si ninguna tiene meta, queda null. */
export function totals(rows: CountsWithGoal[]): CountsWithGoal {
  const withGoal = rows.filter((r) => r.goal !== null)
  return {
    arrived: rows.reduce((s, r) => s + r.arrived, 0),
    uncontacted: rows.reduce((s, r) => s + r.uncontacted, 0),
    in_followup: rows.reduce((s, r) => s + r.in_followup, 0),
    sold: rows.reduce((s, r) => s + r.sold, 0),
    lost: rows.reduce((s, r) => s + r.lost, 0),
    goal: withGoal.length ? withGoal.reduce((s, r) => s + (r.goal ?? 0), 0) : null,
  }
}

/** Agrupa por tipo de referidor (como los colores de la planilla), en el orden de KINDS y sin grupos vacíos. */
export function groupByKind<T extends { kind: ReferrerKind }>(rows: T[]): { kind: ReferrerKind; rows: T[] }[] {
  return KINDS.map((kind) => ({ kind, rows: rows.filter((r) => r.kind === kind) })).filter((g) => g.rows.length > 0)
}

/** "2026-11" (input month) → "2026-11-01". */
export const monthStart = (yyyyMm: string) => `${yyyyMm.slice(0, 7)}-01`

/** Días 1..n del mes. */
export const monthDays = (days: number) => Array.from({ length: days }, (_, i) => i + 1)

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "2026-11-01" → "noviembre 2026". */
export function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${y}`
}
