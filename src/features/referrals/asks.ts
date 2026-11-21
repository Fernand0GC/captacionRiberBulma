import { laPazDate } from '@/lib/dates'
import type { ReferrerKind } from './logic'
import { addDays, spanDays } from './search'

// Seguimiento a referidores (spec 017): a quién toca pedir hoy, números por referidor y las vistas de la tabla.
// Reglas en specs/017-referidores-seguimiento/spec.md (Clarifications). Probado en tests/unit/referral_asks.test.ts.

export type AskMethod = 'whatsapp_call' | 'message' | 'in_person'
export type AskResult = 'no_answer' | 'waiting' | 'promised' | 'passed' | 'none_now' | 'quit'

export const ASK_METHODS: AskMethod[] = ['whatsapp_call', 'message', 'in_person']
export const ASK_METHOD_LABEL: Record<AskMethod, string> = {
  whatsapp_call: 'Llamada de WhatsApp',
  message: 'Mensaje',
  in_person: 'En persona',
}
export const ASK_RESULT_LABEL: Record<AskResult, string> = {
  no_answer: 'No contestó',
  waiting: 'Enviado, sin respuesta',
  promised: 'Prometió pasar',
  passed: 'Pasó contactos',
  none_now: 'No tiene ahora',
  quit: 'No quiere seguir',
}
/** Botones de resultado agrupados como en «Registrar contacto» de clientes. */
export const ASK_GROUPS: { title: string; tone: 'neutral' | 'good' | 'bad'; results: AskResult[] }[] = [
  { title: 'Sin respuesta', tone: 'neutral', results: ['no_answer', 'waiting'] },
  { title: 'Respondió', tone: 'good', results: ['promised', 'passed', 'none_now'] },
  { title: 'Sin interés', tone: 'bad', results: ['quit'] },
]
/** Días hasta volver a pedir según la respuesta. null = no se vuelve a pedir. */
export const NEXT_AFTER: Record<AskResult, number | null> = { no_answer: 1, waiting: 2, promised: 2, passed: 7, none_now: 7, quit: null }
/** Sin fecha propuesta: se vuelve a pedir a los 7 días del último pedido o de la última carga. */
export const DEFAULT_GAP = 7
/** Un referidor sin pedidos es «Nuevo» durante sus primeros 30 días. */
export const NEW_DAYS = 30

const ANSWERED: AskResult[] = ['promised', 'passed', 'none_now', 'quit']
export const isAnswered = (r: AskResult) => ANSWERED.includes(r)

export type LastAsk = {
  at: string
  method: AskMethod
  result: AskResult
  next_on: string | null
  kept: boolean
  actor_name: string | null
  /** Observación del pedido (lo que dijo). Opcional: la app publicada antes del ajuste no la recibe. */
  note?: string | null
}

/** «En qué quedó» una promesa del último pedido: cumplida, vencida (7 días sin nada) o null si sigue en plazo o no es promesa. */
export function promiseState(l: LastAsk, today: string): 'kept' | 'expired' | null {
  if (l.result !== 'promised') return null
  if (l.kept) return 'kept'
  return today > addDays(dayOf(l.at), DEFAULT_GAP) ? 'expired' : null
}

export type FollowupReferrer = {
  id: number
  branch_id: number
  name: string
  kind: ReferrerKind
  active: boolean
  phone: string | null
  created_at: string
  created_by: string | null
  created_by_name: string | null
  last_ask: LastAsk | null
  last_load_at: string | null
}

export type Ask = {
  id: number
  referrer_id: number
  at: string
  /** Fecha del pedido en La Paz. */
  day: string
  method: AskMethod | null
  result: AskResult
  next_on: string | null
  note: string | null
  /** Anotado al cargar referidos (016): no cuenta como pedido. */
  auto: boolean
  /** Solo para «Prometió pasar»: si en 7 días pasó contactos o llegó un referido suyo. */
  kept: boolean | null
  actor_id: string | null
  actor_name: string | null
}

export type Arrival = { referrer_id: number; day: string; n: number }
export type Staff = { id: string; full_name: string; role: string; branch_ids: number[] }

export type FollowupData = {
  today: string
  from: string
  to: string
  prev_from: string
  prev_to: string
  branches: { id: number; name: string }[]
  referrers: FollowupReferrer[]
  asks: Ask[]
  arrivals: Arrival[]
  staff: Staff[]
}

export const dayOf = (iso: string) => laPazDate(new Date(iso))
/** «2026-11-06» → «06/11». */
export const shortDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
export const daysAgo = (day: string, today: string) => spanDays(day, today) - 1
export const agoLabel = (n: number) => (n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`)

/** Fecha propuesta para volver a pedir según la respuesta (null si «No quiere seguir»). */
export function proposeNext(result: AskResult, today: string): string | null {
  const n = NEXT_AFTER[result]
  return n === null ? null : addDays(today, n)
}

const quitOf = (r: FollowupReferrer) => r.last_ask?.result === 'quit'

/** Cuándo volver a pedir: la fecha elegida, o 7 días después del último pedido; si cargó después, 7 días tras la carga. */
export function nextAskOn(r: FollowupReferrer): string | null {
  if (quitOf(r)) return null
  const load = r.last_load_at
  const last = r.last_ask
  if (load && (!last || load >= last.at)) return addDays(dayOf(load), DEFAULT_GAP)
  if (!last) return null
  return last.next_on ?? addDays(dayOf(last.at), DEFAULT_GAP)
}

export type Motive = { rank: number; text: string; tone: 'amber' | 'gold' | 'muted' | 'red' }

/** Motivo para «Para hoy», del más urgente al menos urgente; null = no toca hoy. */
export function motiveOf(r: FollowupReferrer, today: string): Motive | null {
  if (!r.active || quitOf(r)) return null
  const last = r.last_ask
  const loadAfter = r.last_load_at && (!last || r.last_load_at >= last.at)
  if (last && last.result === 'promised' && !last.kept && !loadAfter && today > addDays(dayOf(last.at), DEFAULT_GAP)) {
    return { rank: 0, text: `Prometió el ${shortDate(dayOf(last.at))} y no pasó nada`, tone: 'amber' }
  }
  if (!last && !r.last_load_at) {
    return daysAgo(dayOf(r.created_at), today) < NEW_DAYS
      ? { rank: 1, text: 'Nuevo · hacer el primer pedido', tone: 'gold' }
      : { rank: 2, text: 'Nunca se le pidió', tone: 'muted' }
  }
  const next = nextAskOn(r)
  if (next === null || next > today) return null
  return next < today ? { rank: 3, text: `Tocaba el ${shortDate(next)}`, tone: 'red' } : { rank: 4, text: 'Toca hoy', tone: 'red' }
}

export type TodayItem = { r: FollowupReferrer; m: Motive }

export function todayList(referrers: FollowupReferrer[], today: string): TodayItem[] {
  return referrers
    .flatMap((r) => {
      const m = motiveOf(r, today)
      return m ? [{ r, m }] : []
    })
    .sort((a, b) => a.m.rank - b.m.rank || a.r.name.localeCompare(b.r.name, 'es'))
}

// Números del período ----------------------------------------------------------------------------------------

export type Verdict = 'rinde' | 'regular' | 'insiste' | 'sin_pedir' | 'quit'
export const VERDICT_LABEL: Record<Verdict, string> = {
  insiste: 'Insistes y no llega',
  sin_pedir: 'Sin pedir',
  regular: 'Regular',
  quit: 'No quiere seguir',
  rinde: 'Rinde',
}
/** Orden de la tabla: arriba lo que necesita atención. */
const VERDICT_ORDER: Verdict[] = ['insiste', 'sin_pedir', 'regular', 'quit', 'rinde']

export type Stats = {
  asks: number
  answered: number
  kept: number
  expired: number
  arrived: number
  /** 1 si cuenta para la cobertura (activo y no dijo «No quiere seguir»). */
  active: number
  /** 1 si es activo y se le pidió en el período. */
  covered: number
}

const ZERO: Stats = { asks: 0, answered: 0, kept: 0, expired: 0, arrived: 0, active: 0, covered: 0 }

export function sumStats(list: Stats[]): Stats {
  return list.reduce(
    (acc, s) => ({
      asks: acc.asks + s.asks,
      answered: acc.answered + s.answered,
      kept: acc.kept + s.kept,
      expired: acc.expired + s.expired,
      arrived: acc.arrived + s.arrived,
      active: acc.active + s.active,
      covered: acc.covered + s.covered,
    }),
    ZERO,
  )
}

const inRange = (day: string, from: string, to: string) => day >= from && day <= to

/** Pedidos a mano (sin los automáticos de «Cargar») de un rango. */
export const manualAsks = (asks: Ask[], from: string, to: string) => asks.filter((a) => !a.auto && inRange(a.day, from, to))

export function statsOf(r: FollowupReferrer, d: Pick<FollowupData, 'asks' | 'arrivals' | 'today'>, from: string, to: string): Stats {
  const asks = manualAsks(d.asks, from, to).filter((a) => a.referrer_id === r.id)
  const promised = asks.filter((a) => a.result === 'promised')
  const active = r.active && !quitOf(r) ? 1 : 0
  return {
    asks: asks.length,
    answered: asks.filter((a) => isAnswered(a.result)).length,
    kept: promised.filter((a) => a.kept).length,
    expired: promised.filter((a) => !a.kept && d.today > addDays(a.day, DEFAULT_GAP)).length,
    arrived: d.arrivals.filter((x) => x.referrer_id === r.id && inRange(x.day, from, to)).reduce((n, x) => n + x.n, 0),
    active,
    covered: active && asks.length ? 1 : 0,
  }
}

export function verdictOf(r: FollowupReferrer, s: Stats): Verdict {
  if (quitOf(r)) return 'quit'
  if (s.asks === 0) return 'sin_pedir'
  if (s.asks >= 3 && s.arrived === 0) return 'insiste'
  return s.arrived / s.asks >= 1 ? 'rinde' : 'regular'
}

export const pct = (a: number, b: number) => (b ? Math.round((a * 100) / b) : 0)
/** Llegados por pedido con un decimal (null sin pedidos). */
export const perAsk = (s: Pick<Stats, 'arrived' | 'asks'>) => (s.asks ? Math.round((s.arrived / s.asks) * 10) / 10 : null)
export const keptPct = (s: Pick<Stats, 'kept' | 'expired'>) => (s.kept + s.expired ? pct(s.kept, s.kept + s.expired) : null)

export type RefRow = { r: FollowupReferrer; s: Stats; verdict: Verdict; next: string | null }

export function referrerRows(d: FollowupData): RefRow[] {
  return d.referrers
    .map((r) => {
      const s = statsOf(r, d, d.from, d.to)
      return { r, s, verdict: verdictOf(r, s), next: nextAskOn(r) }
    })
    .filter((x) => x.r.active || x.s.asks > 0 || x.s.arrived > 0)
    .sort((a, b) => VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict) || b.s.asks - a.s.asks || a.r.name.localeCompare(b.r.name, 'es'))
}

/** Totales del período y del anterior (para «vs. período anterior»). */
export function totalsOf(d: FollowupData): { now: Stats; prev: Stats } {
  return {
    now: sumStats(d.referrers.map((r) => statsOf(r, d, d.from, d.to))),
    prev: sumStats(d.referrers.map((r) => statsOf(r, d, d.prev_from, d.prev_to))),
  }
}

export type BranchRow = Stats & { id: number; name: string }

export function branchRows(d: FollowupData): BranchRow[] {
  return d.branches.map((b) => ({
    id: b.id,
    name: b.name,
    ...sumStats(d.referrers.filter((r) => r.branch_id === b.id).map((r) => statsOf(r, d, d.from, d.to))),
  }))
}

export type ActorRow = {
  id: string
  name: string
  role: string
  branch_ids: number[]
  asks: number
  referrers: number
  answered: number
  /** Referidores nuevos que dio de alta en el período. */
  added: number
  last_day: string | null
}

/** «Por quién pide»: jefes del alcance y cualquiera que pidió o sumó referidores en el período. */
export function actorRows(d: FollowupData): ActorRow[] {
  const asks = manualAsks(d.asks, d.from, d.to)
  const ids = new Set(d.referrers.map((r) => r.id))
  return d.staff
    .map((p) => {
      const mine = asks.filter((a) => a.actor_id === p.id && ids.has(a.referrer_id))
      const last = mine.reduce<string | null>((m, a) => (m === null || a.day > m ? a.day : m), null)
      return {
        id: p.id,
        name: p.full_name,
        role: p.role,
        branch_ids: p.branch_ids,
        asks: mine.length,
        referrers: new Set(mine.map((a) => a.referrer_id)).size,
        answered: mine.filter((a) => isAnswered(a.result)).length,
        added: d.referrers.filter((r) => r.created_by === p.id && inRange(dayOf(r.created_at), d.from, d.to)).length,
        last_day: last,
      }
    })
    .sort((a, b) => b.asks - a.asks || a.name.localeCompare(b.name, 'es'))
}
