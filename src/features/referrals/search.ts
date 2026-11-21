import { laPazDate } from '@/lib/dates'
import { KINDS, type ReferrerKind } from './logic'

// Filtros de /referidos en la URL (spec 014, FR-009). Solo datos no personales: ids, fechas y nombres de columnas.

export type ReferralPeriod = 'hoy' | '7d' | 'mes' | 'mes_pasado' | 'rango'
export type ReferralSection = 'reporte' | 'contactos' | 'quien' | 'referidores'
export type SortDir = 'asc' | 'desc'

export type ReferralSearch = {
  periodo?: ReferralPeriod
  desde?: string
  hasta?: string
  /** Sucursal elegida; sin ella = todas las del alcance (gerencia) o la primera (jefe con una sola). */
  sucursal?: number
  /** «todas»: el jefe de ventas eligió «Todas mis sucursales» (sin el parámetro ve la primera). */
  todas?: true
  seccion?: ReferralSection
  /** Reporte: grilla «Por día» en vez del resumen. */
  vista?: 'dia'
  agrupar?: true
  tipo?: ReferrerKind
  /** Orden de la tabla: columna y sentido («arrived», «conversion»…). */
  orden?: string
  dir?: SortDir
  // Contactos
  referidor?: number
  etapa?: string
  responsable?: string
  producto?: string
  autor?: string
  // Referidores y metas
  mes?: string
}

export const PERIODS: { v: ReferralPeriod; label: string }[] = [
  { v: 'hoy', label: 'Hoy' },
  { v: '7d', label: '7 días' },
  { v: 'mes', label: 'Este mes' },
  { v: 'mes_pasado', label: 'Mes pasado' },
  { v: 'rango', label: 'Rango' },
]

const SECTIONS: ReferralSection[] = ['reporte', 'contactos', 'quien', 'referidores']
const STAGES = ['capture', 'recapture', 'followup', 'interested', 'sale', 'lost', 'sold']
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v)
const toInt = (v: unknown) => (v === undefined || v === '' ? undefined : Number.isInteger(Number(v)) ? Number(v) : undefined)
/** Texto corto para filtros por nombre (producto, responsable, autor): nunca celulares ni datos del cliente. */
const shortText = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 80 ? v : undefined)

export function validateReferralSearch(raw: Record<string, unknown>): ReferralSearch {
  return {
    periodo: PERIODS.some((p) => p.v === raw.periodo) ? (raw.periodo as ReferralPeriod) : undefined,
    desde: isDate(raw.desde) ? raw.desde : undefined,
    hasta: isDate(raw.hasta) ? raw.hasta : undefined,
    sucursal: toInt(raw.sucursal),
    todas: raw.todas === true || raw.todas === 'true' ? true : undefined,
    seccion: SECTIONS.includes(raw.seccion as ReferralSection) ? (raw.seccion as ReferralSection) : undefined,
    vista: raw.vista === 'dia' ? 'dia' : undefined,
    agrupar: raw.agrupar === true || raw.agrupar === 'true' ? true : undefined,
    tipo: KINDS.includes(raw.tipo as ReferrerKind) ? (raw.tipo as ReferrerKind) : undefined,
    orden: typeof raw.orden === 'string' && /^[a-z_]{1,20}$/.test(raw.orden) ? raw.orden : undefined,
    dir: raw.dir === 'asc' || raw.dir === 'desc' ? raw.dir : undefined,
    referidor: toInt(raw.referidor),
    etapa: STAGES.includes(raw.etapa as string) ? (raw.etapa as string) : undefined,
    responsable: shortText(raw.responsable),
    producto: shortText(raw.producto),
    autor: shortText(raw.autor),
    mes: isMonth(raw.mes) ? raw.mes : undefined,
  }
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Días entre dos fechas ISO, contando las dos puntas. */
export const spanDays = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1

/** Rango (La Paz) del período. Por defecto «Este mes». «Hasta» antes de «desde» se corrige; más de 366 días se recorta. */
export function referralRange(s: ReferralSearch, now: Date = new Date()): { from: string; to: string } {
  const today = laPazDate(now)
  switch (s.periodo ?? 'mes') {
    case 'hoy':
      return { from: today, to: today }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case 'mes_pasado': {
      const firstThis = `${today.slice(0, 8)}01`
      const to = addDays(firstThis, -1)
      return { from: `${to.slice(0, 8)}01`, to }
    }
    case 'rango': {
      const from = s.desde ?? today
      let to = s.hasta && s.hasta >= from ? s.hasta : from
      if (spanDays(from, to) > 367) to = addDays(from, 366)
      return { from, to }
    }
    default:
      return { from: `${today.slice(0, 8)}01`, to: today }
  }
}

/** Período anterior del mismo largo, justo antes (FR-006): 1–15 nov → 17–31 oct. */
export function previousRange(r: { from: string; to: string }): { from: string; to: string } {
  const n = spanDays(r.from, r.to)
  return { from: addDays(r.from, -n), to: addDays(r.from, -1) }
}
