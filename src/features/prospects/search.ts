import { laPazDate } from '@/lib/dates'

// Filtros de /gestion en la URL (solo datos no personales; la búsqueda por nombre/celular va en el estado, constitución IV).
export type Period = 'hoy' | 'ayer' | '7d' | 'mes' | 'rango'

export type ManageSearch = {
  periodo?: Period
  desde?: string
  hasta?: string
  sucursal?: number
  autor?: string
  canal?: number | 'sin'
  responsable?: string // 'sin' (sin asignar) o uuid
  etapa?: string
  /** Captaciones: filtro por producto (título de la columna Producto). */
  producto?: number
  ver?: ManageView
  pagina?: number
  // Seguimientos (specs/002-monitoreo-seguimiento/contracts/ui-routes.md)
  estado?: FollowupTabParam
  interes?: InterestParam
  intentos?: AttemptsParam
  vencidos?: true
  sin_contacto?: StaleDays
  motivo?: number
  // Actividad
  orden?: string
  persona?: string
  metrica?: MetricParam
  /** Actividad: pestaña «Por persona» (sin el parámetro = «Por sucursal» cuando se ven todas las sucursales). */
  agrupar?: 'persona'
  // Del día (specs/009-reporte-del-dia)
  dia?: string
  origen?: 'referidos'
  referidor?: number
  lista?: 'seguimiento'
}

export type ManageView = 'visitas' | 'seguimiento' | 'actividad' | 'dia'
export type FollowupTabParam = 'sin_contactar' | 'seguimiento' | 'potencial' | 'venta' | 'sin_interes'
export type InterestParam = 'alto' | 'medio' | 'bajo' | 'sin'
export type AttemptsParam = 'ninguno' | '1-2' | '3+'
export type StaleDays = 3 | 7 | 15 | 30
/** `assigned` abre la pestaña «Asignados» del detalle de Actividad (spec 012). */
export type MetricParam = 'all' | 'calls' | 'messages' | 'store' | 'effective' | 'no_answer' | 'visits' | 'sales' | 'assigned'

/** Parámetros propios de Seguimientos y Actividad: se limpian al cambiar de vista. */
export const MONITORING_KEYS = ['estado', 'interes', 'intentos', 'vencidos', 'sin_contacto', 'motivo', 'orden', 'persona', 'metrica', 'agrupar', 'dia', 'origen', 'referidor', 'lista'] as const

const VIEWS: ManageView[] = ['visitas', 'seguimiento', 'actividad', 'dia']
const TABS: FollowupTabParam[] = ['sin_contactar', 'seguimiento', 'potencial', 'venta', 'sin_interes']
const INTERESTS: InterestParam[] = ['alto', 'medio', 'bajo', 'sin']
const ATTEMPTS: AttemptsParam[] = ['ninguno', '1-2', '3+']
const STALE: StaleDays[] = [3, 7, 15, 30]
const METRICS: MetricParam[] = ['all', 'calls', 'messages', 'store', 'effective', 'no_answer', 'visits', 'sales', 'assigned']
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v)
const oneOf = <T>(list: readonly T[], v: unknown): T | undefined => (list.includes(v as T) ? (v as T) : undefined)

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
    canal: raw.canal === 'sin' ? 'sin' : toInt(raw.canal),
    responsable:
      raw.responsable === 'sin' || (typeof raw.responsable === 'string' && /^[0-9a-f-]{36}$/.test(raw.responsable))
        ? (raw.responsable as string)
        : undefined,
    etapa: ['capture', 'recapture', 'followup', 'interested', 'sale', 'lost'].includes(raw.etapa as string) ? (raw.etapa as string) : undefined,
    producto: toInt(raw.producto),
    ver: oneOf(VIEWS, raw.ver),
    pagina: toInt(raw.pagina),
    estado: oneOf(TABS, raw.estado),
    interes: oneOf(INTERESTS, raw.interes),
    intentos: oneOf(ATTEMPTS, raw.intentos),
    vencidos: raw.vencidos === true || raw.vencidos === 1 || raw.vencidos === '1' || raw.vencidos === 'true' ? true : undefined,
    sin_contacto: oneOf(STALE, toInt(raw.sin_contacto)),
    motivo: toInt(raw.motivo),
    orden: typeof raw.orden === 'string' && /^-?[a-z_]+$/.test(raw.orden) ? raw.orden : undefined,
    persona: isUuid(raw.persona) ? raw.persona : undefined,
    metrica: oneOf(METRICS, raw.metrica),
    agrupar: raw.agrupar === 'persona' ? 'persona' : undefined,
    dia: isDate(raw.dia) ? raw.dia : undefined,
    origen: raw.origen === 'referidos' ? 'referidos' : undefined,
    referidor: toInt(raw.referidor),
    lista: raw.lista === 'seguimiento' ? 'seguimiento' : undefined,
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

/** Filtro «Referido por» de Captaciones y Seguimientos (spec 014): un referidor, «solo referidos» o nada. */
export function referrerFilter(s: Pick<ManageSearch, 'origen' | 'referidor'>): 'any' | number | undefined {
  if (s.origen !== 'referidos') return undefined
  return s.referidor ?? 'any'
}
