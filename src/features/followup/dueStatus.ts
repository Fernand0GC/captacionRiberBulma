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

/**
 * Lo único que la regla mira de un cliente. Spec 023: la agenda de recontacto de las jefas usa esta misma regla con filas
 * que pueden estar cerradas hoy (venta o sin interés), por eso `stage` es texto y no solo las etapas abiertas.
 */
export type DueInput = Pick<FollowupRow, 'next_contact_at' | 'visit_at' | 'last_contacted_at' | 'last_result' | 'assigned_at'> & {
  stage: string
  /** Spec 026: la jefa lo marcó como prioridad de hoy para su responsable actual. Falta si la base no tiene la 026. */
  priority_today?: boolean
}

/** Spec 026: tipo de atraso. Las visitas vencidas («¿vino?») cuentan como fecha vencida. */
export type LateType = 'never' | 'overdue'
export type LateInfo = { days: number; type: LateType }

/** Visita agendada cuya hora ya pasó y nadie registró nada desde entonces: toca preguntar "¿vino?". */
export function visitPassed(r: Pick<DueInput, 'visit_at' | 'next_contact_at'>, now: Date): boolean {
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

export function dueStatus(r: DueInput, now: Date): DueStatus {
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
  const s = scheduled(r, now)
  if (!r.priority_today) return freshLater(r, s, today) ? { kind: 'normal', label: newForYou(r) } : s
  // Spec 026: la prioridad lo vuelve trabajo de hoy; el atraso queda como dato (no se borra la fecha).
  const late = lateOf(r, today)
  if (late) return { kind: 'now', label: `Prioridad de hoy · atrasado ${days(late.days)}` }
  return { kind: 'now', label: s.kind === 'now' || s.kind === 'soon' ? `Prioridad de hoy · ${s.label}` : 'Prioridad de hoy' }
}

const CLOSED = new Set(['sale', 'lost'])

/**
 * Spec 028: lo recibió hoy (el responsable actual), sigue abierto y está agendado para más adelante. No le toca hoy
 * (no pide atención ni cuenta como pendiente), pero se ve hoy para que sepa que es suyo y la jefa vea lo que asignó.
 */
function freshLater(r: DueInput, s: DueStatus, today: string): boolean {
  return (
    s.kind === 'normal' &&
    r.next_contact_at !== null &&
    !!r.assigned_at &&
    laPazDate(new Date(r.assigned_at)) === today &&
    !CLOSED.has(r.stage)
  )
}

/** «Nuevo para ti · visita 29/11 10:00» / «Nuevo para ti · contactar 03/12 09:00». */
function newForYou(r: DueInput): string {
  const at = r.next_contact_at!
  const isVisit = r.visit_at !== null && new Date(r.visit_at).getTime() === new Date(at).getTime()
  return `Nuevo para ti · ${isVisit ? 'visita' : 'contactar'} ${shortDate(at)} ${fmtTime(at)}`
}

/** Spec 028: va a «Para más adelante» de la Agenda y primero dentro de su lista en «Mis contactos». */
export function receivedLater(r: DueInput, now: Date): boolean {
  return freshLater(r, dueStatus(r, now), laPazDate(now))
}

/**
 * Spec 026: días de atraso y tipo, solo si hoy cae en «Atrasados» (sin prioridad ni contacto de hoy); si no, null.
 * Es lo que usa el desglose por antigüedad y tipo de la Agenda.
 */
export function lateInfo(r: DueInput, now: Date): LateInfo | null {
  if (dueStatus({ ...r, priority_today: false }, now).kind !== 'late') return null
  const late = lateOf(r, laPazDate(now))
  return late && { days: late.days, type: late.type }
}

/**
 * Atraso desde la fecha más reciente entre lo agendado y el día en que lo recibió el responsable actual: una fecha
 * vencida heredada de otra persona no le suma días a quien la recibió después. Recibido hoy no es atraso.
 */
function lateOf(r: DueInput, today: string): (LateInfo & { label: string }) | null {
  const got = r.assigned_at ? laPazDate(new Date(r.assigned_at)) : null
  if (!r.next_contact_at) {
    // Spec 022: nunca contactado y asignado un día anterior (sin fecha de asignación, no hay cómo saberlo: es de hoy).
    if (r.last_contacted_at || !got || got >= today) return null
    const n = dayDiff(got, today)
    return { days: n, type: 'never', label: `Atrasado · asignado hace ${days(n)}` }
  }
  const due = laPazDate(new Date(r.next_contact_at))
  if (due >= today || got === today) return null
  const received = got !== null && got > due
  const n = dayDiff(received ? got : due, today)
  const was = shortDate(r.next_contact_at)
  const isVisit = r.visit_at !== null && new Date(r.visit_at).getTime() === new Date(r.next_contact_at).getTime()
  const gotLabel = received && r.assigned_at ? shortDate(r.assigned_at) : ''
  const label = isVisit
    ? received
      ? `Recibido el ${gotLabel} · visita era el ${was} · ¿vino?`
      : `Visita era ${n === 1 ? 'ayer' : `hace ${days(n)}`} · ¿vino?`
    : received
      ? `Atrasado ${days(n)} · recibido el ${gotLabel} (tocaba el ${was})`
      : `Atrasado ${days(n)} · tocaba el ${was}`
  return { days: n, type: 'overdue', label }
}

/** Estado según la fecha agendada (visita o próximo contacto), sin mirar si ya se contactó hoy. */
function scheduled(r: DueInput, now: Date): DueStatus {
  const today = laPazDate(now)
  if (!r.next_contact_at) {
    if (r.last_contacted_at) return { kind: 'normal', label: 'Por contactar' }
    // Spec 022: nunca contactado y asignado un día anterior (La Paz) → atrasado; asignado hoy → trabajo del día.
    const late = lateOf(r, today)
    return late ? { kind: 'late', label: late.label } : { kind: 'now', label: 'Nuevo · contactar hoy' }
  }

  const at = new Date(r.next_contact_at)
  // La visita es lo pendiente solo si fue lo último que se agendó (la fecha de visita queda guardada aunque después pase otra cosa).
  const isVisit = r.visit_at !== null && new Date(r.visit_at).getTime() === at.getTime()
  const time = fmtTime(r.next_contact_at)
  const d = dayDiff(today, laPazDate(at))
  const mins = (at.getTime() - now.getTime()) / 60_000
  const verb = r.stage === 'recapture' ? 'Volver a llamar' : 'Contactar'

  if (d < 0) {
    // Se lo pasaron hoy con la fecha que dejó vencida la persona anterior: es trabajo de hoy de quien lo recibe y el
    // atraso queda como dato. Si ya lo contactó hoy cayó antes en «resuelto». Desde mañana, la regla normal.
    // Spec 026: lo atrasado cuenta desde que lo recibió si la fecha vencida era heredada (lateOf).
    const late = lateOf(r, today)
    if (late) return { kind: 'late', label: late.label }
    const was = shortDate(r.next_contact_at)
    return isVisit
      ? { kind: 'now', label: `Recibido hoy · visita era el ${was} · ¿vino?` }
      : { kind: 'now', label: `Recibido hoy · venció el ${was}` }
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
