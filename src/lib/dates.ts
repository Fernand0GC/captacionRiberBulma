export const BUSINESS_TZ = 'America/La_Paz'
export const DEFAULT_SHIFT_CUTOFF = '13:00'

export type Shift = 'morning' | 'afternoon'

/** Hora local de La Paz en minutos desde medianoche. */
function laPazMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const h = Number(parts.find((p) => p.type === 'hour')?.value)
  const m = Number(parts.find((p) => p.type === 'minute')?.value)
  return h * 60 + m
}

export function shiftFor(date: Date, cutoff: string = DEFAULT_SHIFT_CUTOFF): Shift {
  const [h, m] = cutoff.split(':').map(Number)
  return laPazMinutes(date) < (h ?? 13) * 60 + (m ?? 0) ? 'morning' : 'afternoon'
}

/** Fecha de negocio (YYYY-MM-DD) en La Paz. */
export function laPazDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(date)
}

export const SHIFT_LABEL: Record<Shift, string> = { morning: 'Mañana', afternoon: 'Tarde' }
