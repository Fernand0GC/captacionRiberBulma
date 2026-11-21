import { describe, expect, it } from 'vitest'
import {
  actorRows,
  branchRows,
  keptPct,
  motiveOf,
  nextAskOn,
  perAsk,
  proposeNext,
  referrerRows,
  todayList,
  totalsOf,
  type Ask,
  type AskResult,
  type FollowupData,
  type FollowupReferrer,
} from '@/features/referrals/asks'

// Hora de La Paz = UTC-4: mediodía en La Paz es 16:00Z.
const at = (day: string) => `${day}T16:00:00Z`
const TODAY = '2026-11-21'

const ref = (id: number, name: string, n: Partial<FollowupReferrer> = {}): FollowupReferrer => ({
  id,
  branch_id: 5,
  name,
  kind: 'freelance',
  active: true,
  phone: null,
  created_at: at('2026-09-01'),
  created_by: null,
  created_by_name: null,
  last_ask: null,
  last_load_at: null,
  ...n,
})
const last = (day: string, result: AskResult, n: { next_on?: string | null; kept?: boolean } = {}) => ({
  at: at(day),
  method: 'message' as const,
  result,
  next_on: n.next_on ?? null,
  kept: n.kept ?? false,
  actor_name: 'Jessica',
})
let seq = 0
const ask = (referrer_id: number, day: string, result: Ask['result'], n: Partial<Ask> = {}): Ask => ({
  id: ++seq,
  referrer_id,
  at: at(day),
  day,
  method: 'message',
  result,
  next_on: null,
  note: null,
  auto: false,
  kept: result === 'promised' ? false : null,
  actor_id: 'jes',
  actor_name: 'Jessica',
  ...n,
})

describe('cuándo toca pedir', () => {
  it('propone la fecha según la respuesta', () => {
    expect(proposeNext('no_answer', TODAY)).toBe('2026-11-22')
    expect(proposeNext('passed', TODAY)).toBe('2026-11-28')
    expect(proposeNext('quit', TODAY)).toBeNull()
  })
  it('la carga posterior reinicia el plazo a 7 días', () => {
    const r = ref(1, 'Carla', { last_ask: last('2026-11-03', 'promised', { next_on: '2026-11-05' }), last_load_at: at('2026-11-17') })
    expect(nextAskOn(r)).toBe('2026-11-24')
    expect(motiveOf(r, TODAY)).toBeNull()
  })
  it('motivos en orden de urgencia', () => {
    const list = [
      ref(1, 'Atrasado', { last_ask: last('2026-11-10', 'none_now', { next_on: '2026-11-15' }) }),
      ref(2, 'Promesa', { last_ask: last('2026-11-06', 'promised', { next_on: '2026-11-08' }) }),
      ref(3, 'Nuevo', { created_at: at('2026-11-20') }),
      ref(4, 'Viejo'),
      ref(5, 'Hoy', { last_ask: last('2026-11-18', 'no_answer', { next_on: TODAY }) }),
      ref(6, 'Sin fecha', { last_ask: last('2026-11-14', 'passed') }),
      ref(7, 'Al día', { last_ask: last('2026-11-19', 'promised', { next_on: '2026-11-23' }) }),
      ref(8, 'Se fue', { last_ask: last('2026-11-01', 'quit') }),
      ref(9, 'Inactivo', { active: false }),
    ]
    expect(todayList(list, TODAY).map((x) => `${x.r.name}:${x.m.text}`)).toEqual([
      'Promesa:Prometió el 06/11 y no pasó nada',
      'Nuevo:Nuevo · hacer el primer pedido',
      'Viejo:Nunca se le pidió',
      'Atrasado:Tocaba el 15/11',
      'Hoy:Toca hoy',
      'Sin fecha:Toca hoy',
    ])
  })
  it('una promesa cumplida no es vencida', () => {
    expect(motiveOf(ref(1, 'X', { last_ask: last('2026-11-06', 'promised', { next_on: '2026-11-08', kept: true }) }), TODAY)?.text).toBe('Tocaba el 08/11')
  })
})

describe('números del período', () => {
  const data: FollowupData = {
    today: TODAY,
    from: '2026-11-01',
    to: TODAY,
    prev_from: '2026-10-11',
    prev_to: '2026-10-31',
    branches: [
      { id: 5, name: 'VERDOLAGO' },
      { id: 7, name: 'TRINIDAD' },
    ],
    referrers: [
      ref(1, 'Juan'),
      ref(2, 'Carla'),
      ref(3, 'Rosa', { branch_id: 7, created_by: 'jes', created_at: at('2026-11-10') }),
      ref(4, 'Freddy', { last_ask: last('2026-11-12', 'quit') }),
    ],
    asks: [
      ask(1, '2026-11-02', 'no_answer'),
      ask(1, '2026-11-03', 'promised'),
      ask(1, '2026-11-13', 'promised', { actor_id: 'car', actor_name: 'Carmen' }),
      ask(1, '2026-11-18', 'no_answer'),
      ask(2, '2026-11-03', 'promised', { kept: true }),
      ask(2, '2026-11-05', 'passed', { auto: true, method: null }),
      ask(2, '2026-10-20', 'waiting'),
      ask(4, '2026-11-12', 'quit'),
    ],
    arrivals: [
      { referrer_id: 2, day: '2026-11-05', n: 5 },
      { referrer_id: 2, day: '2026-10-21', n: 1 },
      { referrer_id: 3, day: '2026-11-15', n: 2 },
    ],
    staff: [
      { id: 'jes', full_name: 'Jessica', role: 'sales_lead', branch_ids: [5, 7] },
      { id: 'car', full_name: 'Carmen', role: 'sales_lead', branch_ids: [5] },
      { id: 'fab', full_name: 'Fabiola', role: 'sales_lead', branch_ids: [7] },
    ],
  }

  it('totales: la carga automática no cuenta como pedido; cobertura sin los que se fueron', () => {
    const { now, prev } = totalsOf(data)
    expect(now).toEqual({ asks: 6, answered: 4, kept: 1, expired: 2, arrived: 7, active: 3, covered: 2 })
    expect([perAsk(now), keptPct(now)]).toEqual([1.2, 33])
    expect([prev.asks, prev.arrived]).toEqual([1, 1])
  })
  it('por referidor: estado y orden (arriba lo que necesita atención)', () => {
    expect(referrerRows(data).map((x) => `${x.r.name}:${x.verdict}`)).toEqual(['Juan:insiste', 'Rosa:sin_pedir', 'Freddy:quit', 'Carla:rinde'])
  })
  it('por sucursal y por quién pide (con referidores nuevos)', () => {
    expect(branchRows(data).map((b) => [b.name, b.asks, b.arrived, b.covered, b.active])).toEqual([
      ['VERDOLAGO', 6, 5, 2, 2],
      ['TRINIDAD', 0, 2, 0, 1],
    ])
    expect(actorRows(data).map((a) => [a.name, a.asks, a.referrers, a.answered, a.added, a.last_day])).toEqual([
      ['Jessica', 5, 3, 3, 1, '2026-11-18'],
      ['Carmen', 1, 1, 1, 0, '2026-11-13'],
      ['Fabiola', 0, 0, 0, 0, null],
    ])
  })
})
