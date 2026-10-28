import { laPazDate } from '@/lib/dates'

// Filtros de /gestion en la URL (solo datos no personales; la búsqueda por nombre/celular va en el estado, constitución IV).
export type Period = 'hoy' | 'ayer' | '7d' | 'mes' | 'rango'

export type ManageSearch = {
  periodo?: Period
  desde?: string
  hasta?: string
  sucursal?: number
  autor?: string
  canal?: number
  pagina?: number
}

const PERIODS: Period[] = ['hoy', 'ayer', '7d', 'mes', 'rango']
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const toInt = (v: unknown) => (v === undefined || v === '' ? undefined : Number.isInteger(Number(v)) ? Number(v) : undefined)

export function validateManageSearch(raw: Record<string, unknown>): ManageSearch {
  return {
    periodo: PERIODS.includes(raw.periodo as Period) ? (raw.periodo as Period) : undefined,
    desde: isDate(raw.desde) ? raw.desde : undefined,
    hasta: isDate(raw.hasta) ? raw.hasta : undefined,
    sucursal: toInt(raw.sucursal),
    autor: typeof raw.autor === 'string' && /^[0-9a-f-]{36}$/.test(raw.autor) ? raw.autor : undefined,
    canal: toInt(raw.canal),
    pagina: toInt(raw.pagina),
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Rango de fechas (La Paz) del período elegido. */
export function periodRange(s: ManageSearch, now: Date = new Date()): { from: string; to: string } {
  const today = laPazDate(now)
  switch (s.periodo ?? 'hoy') {
    case 'ayer':
      return { from: addDays(today, -1), to: addDays(today, -1) }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case 'mes':
      return { from: `${today.slice(0, 8)}01`, to: today }
    case 'rango': {
      const from = s.desde ?? today
      const to = s.hasta && s.hasta >= from ? s.hasta : from
      return { from, to }
    }
    default:
      return { from: today, to: today }
  }
}
