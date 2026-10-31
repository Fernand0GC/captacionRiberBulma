import { fmtDate, fmtTime } from '@/features/prospects/format'
import { laPazDate } from '@/lib/dates'
import { RESULT_LABEL, type FollowupRow } from './api'

/**
 * done = resuelto hoy · late = se pasó el día · now = toca hoy · soon = visita mañana (confirmar hoy) · normal = más adelante.
 * late, now y soon piden atención: van arriba y suman al ⚠ del menú.
 */
export type DueKind = 'done' | 'late' | 'now' | 'soon' | 'normal'
/** `next`: en lo resuelto hoy, cuándo toca el siguiente contacto (para que no se pierda la cuenta regresiva). */
export type DueStatus = { kind: DueKind; label: string; next?: DueStatus }

export const DUE_ORDER: Record<DueKind, number> = { late: 0, now: 1, soon: 2, normal: 3, done: 4 }

export const needsAttention = (s: DueStatus) => s.kind === 'late' || s.kind === 'now' || s.kind === 'soon'

/** Visita agendada cuya hora ya pasó y nadie registró nada desde entonces: toca preguntar "¿vino?". */
export function visitPassed(r: FollowupRow, now: Date): boolean {
  if (!r.visit_at || !r.next_contact_at) return false
  const at = new Date(r.visit_at).getTime()
  return at === new Date(r.next_contact_at).getTime() && at <= now.getTime()
}

/** Días entre dos fechas YYYY-MM-DD (b − a). */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

/** "45 min", "3 h", "2 h 30 min". */
function inTime(mins: number): string {
  if (mins < 60) return `${Math.max(1, Math.round(mins))} min`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

/** dd/mm, sin el año: la etiqueta tiene que entrar en una línea. */
const shortDate = (iso: string) => fmtDate(iso).slice(0, 5)

const days = (n: number) => (n === 1 ? '1 día' : `${n} días`)

export function dueStatus(r: FollowupRow, now: Date): DueStatus {
  const today = laPazDate(now)
  // Contactado hoy = resuelto, salvo que se haya quedado en volver a hablar más tarde el mismo día.
  const laterToday =
    r.next_contact_at !== null &&
    r.last_contacted_at !== null &&
    laPazDate(new Date(r.next_contact_at)) === today &&
    new Date(r.next_contact_at) > new Date(r.last_contacted_at)
  if (r.last_contacted_at && laPazDate(new Date(r.last_contacted_at)) === today && !laterToday) {
    const label = `Resuelto hoy · ${r.last_result ? RESULT_LABEL[r.last_result] : ''}`
    if (!r.next_contact_at) return { kind: 'done', label }
    const next = scheduled(r, now)
    // Si la visita de mañana se agendó hoy, ya está confirmada: se muestra como dato, sin pedir confirmar.
    return {
      kind: 'done',
      label,
      next:
        next.kind === 'soon' ? { kind: 'normal', label: next.label.replace(' · confirmar hoy', '') } : next,
    }
  }
  return scheduled(r, now)
}

/** Estado según la fecha agendada (visita o próximo contacto), sin mirar si ya se contactó hoy. */
function scheduled(r: FollowupRow, now: Date): DueStatus {
  const today = laPazDate(now)
  // Asignado y nunca contactado: es el trabajo del día, cuenta como "toca hoy".
  if (!r.next_contact_at) return r.last_contacted_at ? { kind: 'normal', label: 'Por contactar' } : { kind: 'now', label: 'Nuevo · contactar hoy' }

  const at = new Date(r.next_contact_at)
  // La visita es lo pendiente solo si fue lo último que se agendó (la fecha de visita queda guardada aunque después pase otra cosa).
  const isVisit = r.visit_at !== null && new Date(r.visit_at).getTime() === at.getTime()
  const time = fmtTime(r.next_contact_at)
  const d = dayDiff(today, laPazDate(at))
  const mins = (at.getTime() - now.getTime()) / 60_000
  const verb = r.stage === 'recapture' ? 'Volver a llamar' : 'Contactar'

  if (d < 0) {
    return isVisit
      ? { kind: 'late', label: `Visita era ${d === -1 ? 'ayer' : `hace ${days(-d)}`} · ¿vino?` }
      : { kind: 'late', label: `Atrasado ${days(-d)} · tocaba el ${shortDate(r.next_contact_at)}` }
  }
  if (d === 0) {
    if (mins > 0) {
      return isVisit
        ? { kind: 'now', label: `Pasa en ${inTime(mins)} (${time}) · confirmar` }
        : { kind: 'now', label: `${verb} en ${inTime(mins)} (${time})` }
    }
    return isVisit
      ? { kind: 'now', label: `Debía pasar a las ${time} · ¿vino?` }
      : { kind: 'now', label: `${verb} ya · desde las ${time}` }
  }
  if (d === 1) {
    return isVisit
      ? { kind: 'soon', label: `Visita mañana ${time} · confirmar hoy` }
      : { kind: 'normal', label: `Mañana ${time}` }
  }
  return {
    kind: 'normal',
    label: `${isVisit ? 'Visita en' : 'En'} ${days(d)} · ${shortDate(r.next_contact_at)} ${time}`,
  }
}
