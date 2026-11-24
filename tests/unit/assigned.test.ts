import { describe, expect, it } from 'vitest'
import {
  filterAssigned,
  keepKey,
  laPazDay,
  reassignable,
  shouldAskHide,
  singleBranch,
  toSummary,
} from '@/features/monitoring/assigned'
import type { AgentAssignedResult, AgentAssignedRow } from '@/features/monitoring/api'

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
  stage_left: 'capture',
  outcome: 'none',
  counted: true,
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

// El servidor ya calcula si cada fila cuenta, en qué etapa la dejó la persona y el grupo de «A qué proceso pasaron».
const rows = [
  row('a', { contacts: 1, stage_now: 'recapture', stage_left: 'recapture', outcome: 'recapture' }),
  row('b', { contacts: 2, stage_at: 'recapture', stage_now: 'followup', stage_left: 'followup', outcome: 'followup' }),
  row('c', { contacts: 1, stage_at: 'interested', stage_now: 'sale', stage_left: 'sale', outcome: 'sale' }),
  row('d', { contacts: 1, stage_at: 'followup', stage_now: 'followup', stage_left: 'followup', outcome: 'same' }),
  row('e'),
  row('f', { stage_at: 'sale', stage_now: 'sale', stage_left: 'sale' }),
]

// Spec 024: los números de arriba los manda el servidor (cuentan todo el período, no solo las 500 filas que llegan).
describe('toSummary (024)', () => {
  const res: Pick<AgentAssignedResult, 'total' | 'summary'> = {
    total: 180,
    summary: {
      contacted: 143,
      contacted_later: 25,
      by_origin: { capture: { n: 163, contacted: 133 }, recapture: { n: 3, contacted: 3 } },
      by_outcome: { sale: 4, none: 37 },
    },
  }
  const s = toSummary(res)
  it('asignados, contactados y porcentaje del servidor', () => expect([s.total, s.contacted, s.pct]).toEqual([180, 143, 79]))
  it('contactados al día siguiente', () => expect(s.contactedLater).toBe(25))
  it('de dónde vienen: completa con cero las etapas que no vinieron', () => {
    expect(s.byOrigin.capture).toEqual({ n: 163, contacted: 133 })
    expect(s.byOrigin.sale).toEqual({ n: 0, contacted: 0 })
  })
  it('a qué pasaron: completa con cero los grupos que no vinieron', () =>
    expect(s.byOutcome).toEqual({ sale: 4, interested: 0, followup: 0, recapture: 0, lost: 0, same: 0, none: 37 }))
  it('sin asignados: todo en cero, sin dividir por cero', () =>
    expect(toSummary({ total: 0, summary: { contacted: 0, contacted_later: 0, by_origin: {}, by_outcome: {} } }).pct).toBe(0))
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
  it('024: el resultado es la etapa en que la persona lo dejó, no la de hoy', () => {
    const passed = [row('pasó', { contacts: 1, stage_now: 'sale', stage_left: 'followup', outcome: 'followup', reassigned: true })]
    expect(filterAssigned(passed, { ...all, outcome: 'sale' })).toEqual([])
    expect(filterAssigned(passed, { ...all, outcome: 'followup' })).toHaveLength(1)
  })
})

// Spec 024: los reasignados que la persona no contactó no cuentan y solo se ven desde la nota gris.
describe('reasignados sin contactar (024)', () => {
  const list = [
    row('Suyo'),
    row('Contactado y pasó', { contacts: 1, outcome: 'same', reassigned: true, reassigned_to: 'Ana' }),
    row('Pasó sin contactar', { counted: false, reassigned: true, reassigned_to: 'Ana' }),
  ]
  const names = (rs: AgentAssignedRow[]) => rs.map((r) => r.full_name)
  const all = { contact: 'all', origin: null, outcome: null } as const
  it('por defecto la lista solo trae los que cuentan', () =>
    expect(names(filterAssigned(list, all))).toEqual(['Suyo', 'Contactado y pasó']))
  it('«Sin contactar» no incluye a los que ya pasaron a otra persona', () =>
    expect(names(filterAssigned(list, { ...all, contact: 'none' }))).toEqual(['Suyo']))
  it('desde la nota gris se ven solo los reasignados sin contactar', () =>
    expect(names(filterAssigned(list, { ...all, reassignedOnly: true }))).toEqual(['Pasó sin contactar']))
  it('nunca se ofrecen para reasignar', () => expect(names(reassignable(list))).toEqual(['Suyo']))
  it('la nota los muestra aunque alguno se haya ocultado antes de pasar', () => {
    const withHidden = [...list, row('Oculto y pasó', { counted: false, reassigned: true, hidden: true })]
    expect(names(filterAssigned(withHidden, { ...all, reassignedOnly: true }))).toEqual(['Pasó sin contactar', 'Oculto y pasó'])
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
