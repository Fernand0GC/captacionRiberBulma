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

// Spec 014: rango, orden, columnas del «Por día» y metas prorrateadas ----------------------------------

/** Meta del rango: entera o con un decimal si se prorrateó ("3,2"). Sin meta: "—". */
export function fmtGoal(goal: number | null): string {
  if (goal === null) return '—'
  return Number.isInteger(goal) ? String(goal) : goal.toFixed(1).replace('.', ',')
}

/** Diferencia contra el período anterior para las tarjetas: "+3", "−2", "igual". */
export function fmtDelta(now: number, before: number): string {
  const d = now - before
  if (d === 0) return 'igual que el período anterior'
  return `${d > 0 ? '+' : '−'}${Math.abs(d)} vs. período anterior`
}

/** Columnas por las que se ordena la tabla de referidores (o sucursales). */
export const SORT_KEYS = ['name', 'arrived', 'uncontacted', 'in_followup', 'sold', 'lost', 'conversion', 'goal', 'fulfillment'] as const
export type SortKey = (typeof SORT_KEYS)[number]
export const isSortKey = (v: string | undefined): v is SortKey => SORT_KEYS.includes(v as SortKey)

/** Valor de una fila para ordenar; los vacíos (sin meta, sin llegados) van siempre al final. */
function sortValue(r: CountsWithGoal & { name: string }, key: SortKey): number | string | null {
  switch (key) {
    case 'name':
      return r.name.toLocaleLowerCase('es')
    case 'conversion':
      return conversion(r)
    case 'fulfillment':
      return fulfillment(r)
    default:
      return r[key]
  }
}

/** Ordena sin mutar. Sin columna, deja el orden que mandó el servidor (orden y nombre del jefe). */
export function sortRows<T extends CountsWithGoal & { name: string }>(rows: T[], key: SortKey | undefined, dir: 'asc' | 'desc' = 'desc'): T[] {
  if (!key) return rows
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key)
    const vb = sortValue(b, key)
    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1
    if (typeof va === 'string' || typeof vb === 'string') return String(va).localeCompare(String(vb), 'es') * sign
    return (va - vb) * sign
  })
}

/** Sentido inicial al tocar una columna: el nombre de la A a la Z; los números, de mayor a menor. */
export const defaultDir = (key: SortKey): 'asc' | 'desc' => (key === 'name' ? 'asc' : 'desc')

export type DayColumn = { key: string; label: string; days: string[] }

/** Columnas del «Por día» (FR-008): una por día hasta 62 días; con más, una por mes. */
export function dayColumns(from: string, to: string): DayColumn[] {
  const days: string[] = []
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10))
  }
  if (days.length <= 62) {
    return days.map((iso) => ({ key: iso, label: iso.slice(8, 10).replace(/^0/, ''), days: [iso] }))
  }
  const byMonth = new Map<string, string[]>()
  for (const iso of days) byMonth.set(iso.slice(0, 7), [...(byMonth.get(iso.slice(0, 7)) ?? []), iso])
  return [...byMonth.entries()].map(([ym, list]) => ({ key: ym, label: monthLabel(`${ym}-01`).slice(0, 3) + ` ${ym.slice(2, 4)}`, days: list }))
}

/** Suma llegados y compras de una columna (uno o varios días). */
export function sumDays(byDay: Record<string, { arrived: number; sold: number }>, col: DayColumn): { arrived: number; sold: number } {
  return col.days.reduce(
    (acc, d) => ({ arrived: acc.arrived + (byDay[d]?.arrived ?? 0), sold: acc.sold + (byDay[d]?.sold ?? 0) }),
    { arrived: 0, sold: 0 },
  )
}

/** "2026-11" → "2026-10" (para copiar las metas del mes anterior). */
export function previousMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  const py = m === 1 ? (y ?? 0) - 1 : (y ?? 0)
  const pm = m === 1 ? 12 : (m ?? 1) - 1
  return `${py}-${String(pm).padStart(2, '0')}`
}

/** "2026-11-01" → "01/11" o rango "01/11–15/11/2026" para títulos. */
export function rangeLabel(from: string, to: string): string {
  const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  if (from === to) return `${dm(from)}/${from.slice(0, 4)}`
  return `${dm(from)}–${dm(to)}/${to.slice(0, 4)}`
}

// Contactos y «Quién registra» (spec 014, US4–US5) ------------------------------------------------------

const STAGE_TEXT: Record<string, string> = {
  capture: 'Sin contactar',
  recapture: 'Recaptación',
  followup: 'Seguimiento',
  interested: 'Cliente potencial',
  sale: 'Compró',
  lost: 'Sin interés',
}

type ContactLike = {
  referrer_id: number
  stage: string
  sold_at: string | null
  assigned_to: string | null
  product: string | null
  registered_by: string | null
  arrived_at: string
  days_waiting: number | null
}

/** Etapa que se muestra: «Compró» si tiene venta (aunque después cambie la etapa), si no la etapa actual. */
export const contactStage = (c: Pick<ContactLike, 'stage' | 'sold_at'>) => (c.sold_at ? 'Compró' : (STAGE_TEXT[c.stage] ?? c.stage))

export type ContactFilters = { referrerId?: number; stage?: string; assigned?: string; product?: string; author?: string }

/**
 * Filtra y ordena la lista plana: primero los que siguen sin contactar (del que más espera al que menos),
 * después el resto por fecha de llegada (más nuevo primero). Etapa «sold» = compró.
 */
export function filterContacts<T extends ContactLike>(list: T[], f: ContactFilters): T[] {
  return list
    .filter(
      (c) =>
        (f.referrerId === undefined || c.referrer_id === f.referrerId) &&
        (f.stage === undefined || (f.stage === 'sold' ? c.sold_at !== null : c.sold_at === null && c.stage === f.stage)) &&
        (f.assigned === undefined || c.assigned_to === f.assigned) &&
        (f.product === undefined || c.product === f.product) &&
        (f.author === undefined || c.registered_by === f.author),
    )
    .sort((a, b) => {
      const wa = a.days_waiting ?? -1
      const wb = b.days_waiting ?? -1
      if (wa !== wb) return wb - wa
      return b.arrived_at.localeCompare(a.arrived_at)
    })
}

/** Quién registra: más referidas primero; a igualdad, más captaciones (los que no marcan quedan abajo, visibles). */
export function sortRegistrars<T extends { name: string; captures: number; referred: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.referred - a.referred || b.captures - a.captures || a.name.localeCompare(b.name, 'es'))
}

/** Filtros de «Referidores y metas» (spec 014, US7). */
export type ReferrerView = 'todos' | 'registro' | 'desactivados' | 'unidos'

/** Qué referidores muestra cada filtro. «Todos» = los que se pueden editar (activos y desactivados, no unidos). */
export function inView(r: { active: boolean; source?: 'manager' | 'capture'; merged_into?: number | null }, view: ReferrerView): boolean {
  const merged = r.merged_into != null
  switch (view) {
    case 'registro':
      return !merged && r.source === 'capture'
    case 'desactivados':
      return !merged && !r.active
    case 'unidos':
      return merged
    default:
      return !merged
  }
}
