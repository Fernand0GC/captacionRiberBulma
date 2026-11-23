import { describe, expect, it } from 'vitest'
import {
  filterAssigned,
  keepKey,
  laPazDay,
  outcomeOf,
  reassignable,
  shouldAskHide,
  singleBranch,
  summarizeAssigned,
} from '@/features/monitoring/assigned'
import type { AgentAssignedRow } from '@/features/monitoring/api'

const row = (full_name: string, n: Partial<AgentAssignedRow> = {}): AgentAssignedRow => ({
  prospect_id: full_name,
  full_name,
  phone_raw: '7000 0000',
  phone_norm: '70000000',
  branch_id: 5,
  assigned_at: '2026-11-20T18:10:00Z', // 14:10 La Paz
  self_assigned: false,
  assigned_by: 'Enc. Isabel',
  stage_at: 'capture',
  stage_now: 'capture',
  contacts: 0,
  first_at: null,
  last_at: null,
  last_method: null,
  last_result: null,
  last_note: null,
  reassigned: false,
  reassigned_to: null,
  reassigned_at: null,
  hidden: false,
  ...n,
})

const rows = [
  row('a', { contacts: 1, stage_now: 'recapture', first_at: '2026-11-20T20:00:00Z' }),
  row('b', { contacts: 2, stage_at: 'recapture', stage_now: 'followup', first_at: '2026-11-21T13:15:00Z' }), // al otro día
  row('c', { contacts: 1, stage_at: 'interested', stage_now: 'sale', first_at: '2026-11-20T21:00:00Z' }),
  row('d', { contacts: 1, stage_at: 'followup', stage_now: 'followup', first_at: '2026-11-20T21:00:00Z' }),
  row('e'),
  row('f', { stage_at: 'sale', stage_now: 'sale' }),
]

describe('outcomeOf', () => {
  it('sin contactos: «Sin contactar» aunque otro le haya cambiado la etapa', () =>
    expect(outcomeOf({ contacts: 0, stage_at: 'capture', stage_now: 'followup' })).toBe('none'))
  it('contactado y en la misma etapa: «Sin cambio»', () =>
    expect(outcomeOf({ contacts: 1, stage_at: 'followup', stage_now: 'followup' })).toBe('same'))
  it('contactado y cambió: la etapa de hoy', () =>
    expect(outcomeOf({ contacts: 1, stage_at: 'capture', stage_now: 'lost' })).toBe('lost'))
})

describe('summarizeAssigned', () => {
  const s = summarizeAssigned(rows)
  it('asignados, contactados y porcentaje', () => expect([s.total, s.contacted, s.pct]).toEqual([6, 4, 67]))
  it('de dónde vienen, con cuántos contactó de cada etapa', () => {
    expect(s.byOrigin.capture).toEqual({ n: 2, contacted: 1 })
    expect(s.byOrigin.recapture).toEqual({ n: 1, contacted: 1 })
    expect(s.byOrigin.sale).toEqual({ n: 1, contacted: 0 })
  })
  it('a qué pasaron: suma el total', () => {
    expect(s.byOutcome).toMatchObject({ recapture: 1, followup: 1, sale: 1, same: 1, none: 2 })
    expect(Object.values(s.byOutcome).reduce((a, n) => a + n, 0)).toBe(6)
  })
  it('cuenta los contactados al día siguiente (hora La Paz)', () => expect(s.contactedLater).toBe(1))
  it('sin filas: todo en cero, sin dividir por cero', () => expect(summarizeAssigned([]).pct).toBe(0))
})

describe('filterAssigned', () => {
  const all = { contact: 'all', origin: null, outcome: null } as const
  it('sin filtros: todos', () => expect(filterAssigned(rows, all)).toHaveLength(6))
  it('sin contactar', () => expect(filterAssigned(rows, { ...all, contact: 'none' }).map((r) => r.full_name)).toEqual(['e', 'f']))
  it('por origen y resultado combinados', () => {
    expect(filterAssigned(rows, { ...all, origin: 'capture' }).map((r) => r.full_name)).toEqual(['a', 'e'])
    expect(filterAssigned(rows, { contact: 'done', origin: 'capture', outcome: null }).map((r) => r.full_name)).toEqual(['a'])
    expect(filterAssigned(rows, { ...all, outcome: 'sale' }).map((r) => r.full_name)).toEqual(['c'])
  })
})

// Spec 020: lupa y reasignación en el modal «Clientes asignados».
describe('filterAssigned con búsqueda (020)', () => {
  const people = [
    row('Juan Pérez', { phone_raw: '7123 4567', phone_norm: '71234567' }),
    row('María Peña', { phone_raw: '6987-6543', phone_norm: '69876543', contacts: 1, stage_now: 'followup', first_at: '2026-11-20T20:00:00Z' }),
    row('Pedro Juárez', { phone_raw: '71110000', phone_norm: '71110000' }),
  ]
  const all = { contact: 'all', origin: null, outcome: null } as const
  it('por nombre: todas las palabras, sin tildes', () =>
    expect(filterAssigned(people, { ...all, q: 'perez juan' }).map((r) => r.full_name)).toEqual(['Juan Pérez']))
  it('por dígitos del celular', () =>
    expect(filterAssigned(people, { ...all, q: '9876' }).map((r) => r.full_name)).toEqual(['María Peña']))
  it('se combina con «Sin contactar»', () =>
    expect(filterAssigned(people, { ...all, contact: 'none', q: 'pe' }).map((r) => r.full_name)).toEqual(['Juan Pérez', 'Pedro Juárez']))
  it('búsqueda vacía o con espacios: no filtra', () => expect(filterAssigned(people, { ...all, q: '  ' })).toHaveLength(3))
})

describe('reassignable (020)', () => {
  it('solo sin contactar y que siguen a cargo de la persona', () => {
    const list = [
      row('libre'),
      row('contactado', { contacts: 1 }),
      row('ya pasó', { reassigned: true, reassigned_to: 'Otra' }),
      row('sin responsable', { reassigned: true }),
    ]
    expect(reassignable(list).map((r) => r.full_name)).toEqual(['libre'])
  })
})

describe('singleBranch (020)', () => {
  it('todas de una sucursal: esa', () => expect(singleBranch([row('a'), row('b')])).toBe(5))
  it('de varias sucursales: ninguna', () => expect(singleBranch([row('a'), row('b', { branch_id: 7 })])).toBeUndefined())
  it('sin filas: ninguna', () => expect(singleBranch([])).toBeUndefined())
})

describe('ocultos (021)', () => {
  const list = [
    row('Ana visible', { contacts: 1 }),
    row('Beto oculto', { contacts: 2, hidden: true }),
    row('Carla oculta', { hidden: true }),
    row('Dino'),
  ]
  const names = (rs: AgentAssignedRow[]) => rs.map((r) => r.full_name)
  const all = { contact: 'all', origin: null, outcome: null } as const

  it('por defecto la lista no muestra ocultos', () =>
    expect(names(filterAssigned(list, all))).toEqual(['Ana visible', 'Dino']))
  it('«Ver ocultos» los incluye', () =>
    expect(names(filterAssigned(list, { ...all, showHidden: true }))).toHaveLength(4))
  it('la lupa y los filtros tampoco devuelven ocultos sin «Ver ocultos»', () => {
    expect(names(filterAssigned(list, { ...all, q: 'beto' }))).toEqual([])
    expect(names(filterAssigned(list, { ...all, contact: 'done' }))).toEqual(['Ana visible'])
    expect(names(filterAssigned(list, { ...all, contact: 'done', showHidden: true }))).toEqual(['Ana visible', 'Beto oculto'])
  })
  it('un oculto nunca se ofrece para reasignar', () => expect(names(reassignable(list))).toEqual(['Dino']))
})

describe('aviso «¿ocultar los contactados?» (021)', () => {
  it('pregunta si hay contactados visibles y no eligió «Mantener» hoy', () => {
    expect(shouldAskHide(3, null, '2026-11-23')).toBe(true)
    expect(shouldAskHide(3, '2026-11-22', '2026-11-23')).toBe(true) // eligió Mantener ayer: hoy vuelve a preguntar
  })
  it('no pregunta si eligió «Mantener» hoy', () => expect(shouldAskHide(3, '2026-11-23', '2026-11-23')).toBe(false))
  it('no pregunta sin contactados visibles', () => expect(shouldAskHide(0, null, '2026-11-23')).toBe(false))
  it('la clave es por quien mira y por persona del modal', () => {
    expect(keepKey('viewer-1', 'agent-1')).toBe('rb.assigned-keep.viewer-1.agent-1')
    expect(keepKey('viewer-1', 'agent-1')).not.toBe(keepKey('viewer-2', 'agent-1'))
    expect(keepKey('viewer-1', 'agent-1')).not.toBe(keepKey('viewer-1', 'agent-2'))
  })
  it('el día es el de La Paz (UTC−4)', () => {
    expect(laPazDay(new Date('2026-11-24T03:30:00Z'))).toBe('2026-11-23') // 23:30 del 23 en La Paz
    expect(laPazDay(new Date('2026-11-24T04:30:00Z'))).toBe('2026-11-24')
  })
})
