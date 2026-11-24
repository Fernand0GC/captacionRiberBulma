// Lógica pura del reporte del día (spec 009): promedios, textos y lupas de la lista. Sin React ni red, para probarla con Vitest.
import type { ContactResult } from '@/features/followup/api'
import type { KindParam, ResultParam } from '@/features/prospects/search'
import { laPazDate } from '@/lib/dates'
import { matchesNameOrPhone } from '@/lib/search'

export type DailyTotals = {
  /** Registros nuevos del día. */
  new: number
  /** Personas que registraron ese día. */
  new_people: number
  /** Registros de los 7 días que terminan en el día elegido. */
  week_new: number
  /** Clientes distintos con al menos un contacto ese día. */
  followed: number
  /** De esos, con algún contacto efectivo. */
  effective: number
  /** Contactos totales (llamadas, mensajes, atenciones). */
  contacts: number
}

export const WEEK_DAYS = 7

/** Registros por persona que registró; null si nadie registró (no 0 ÷ 0). */
export function perPerson(t: Pick<DailyTotals, 'new' | 'new_people'>): number | null {
  return t.new_people > 0 ? t.new / t.new_people : null
}

/** Promedio de registros por día en los últimos 7 días. */
export function perDay(t: Pick<DailyTotals, 'week_new'>): number {
  return t.week_new / WEEK_DAYS
}

/** «4,8» con una decimal como máximo; «—» si no hay dato. */
export function fmtAvg(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('es-BO', { maximumFractionDigits: 1 })
}

/** «58 % de los clientes» o null si no hubo seguimiento. */
export function effectiveText(t: Pick<DailyTotals, 'followed' | 'effective'>): string | null {
  return t.followed > 0 ? `${Math.round((t.effective / t.followed) * 100)} % de los clientes` : null
}

/** Suma n días a una fecha ISO (YYYY-MM-DD) sin depender de la zona horaria del navegador. */
export function shiftDay(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** «jueves 19 de noviembre». */
export function longDay(iso: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`))
}

/** Lupas de «Clientes con seguimiento»: solo achican la tabla (las tarjetas siguen con los números del servidor). */
export type FollowedLens = { resultado?: ResultParam; tipo?: KindParam; etapa?: string; buscar?: string }

type LensRow = {
  full_name: string
  phone_norm: string | null
  effective: boolean
  last_result: ContactResult
  registered_at: string
  stage: string
}

export const hasLens = (l: FollowedLens): boolean => !!(l.resultado || l.tipo || l.etapa || l.buscar?.trim())

const matchesResult = (r: LensRow, res: ResultParam): boolean =>
  res === 'efectivos' ? r.effective : res === 'no_efectivos' ? !r.effective : r.last_result === res

/** Filas que pasan todas las lupas, en el mismo orden. «Tipo» compara el día de registro en hora de Bolivia. */
export function filterFollowed<T extends LensRow>(rows: readonly T[], l: FollowedLens, day: string): T[] {
  if (!hasLens(l)) return [...rows]
  return rows.filter((r) => {
    if (l.resultado && !matchesResult(r, l.resultado)) return false
    if (l.tipo && (laPazDate(new Date(r.registered_at)) === day) !== (l.tipo === 'nuevos')) return false
    if (l.etapa && r.stage !== l.etapa) return false
    return matchesNameOrPhone(r, l.buscar ?? '')
  })
}
