import { describe, expect, it } from 'vitest'
import { buildItems, countBy, parsePaste, proposeAssignees, readyRows, rowIssue, type Assignee, type LoadRow, type PhoneHit } from '@/features/referrals/load'

const row = (key: string, full_name: string, phone: string, assigned_to: string | null = null): LoadRow => ({
  key,
  full_name,
  phone,
  product_id: null,
  assigned_to,
})
const none = new Map<string, PhoneHit>()

describe('parsePaste', () => {
  it('saca nombre y celular de cada línea y salta los saludos', () => {
    const text = [
      'Jessica, te paso los contactos que me dieron hoy 🙌',
      'Doña Lucía Mendoza 7654 3210',
      'Gabriela Rojas - 71122334',
      'Tío Fermín: 6 9 8 8 7 7 6 6',
      '+591 72345678 Carmen Ibáñez',
      'Sin número aquí',
    ].join('\n')
    expect(parsePaste(text)).toEqual([
      { full_name: 'Doña Lucía Mendoza', phone: '76543210' },
      { full_name: 'Gabriela Rojas', phone: '71122334' },
      { full_name: 'Tío Fermín', phone: '69887766' },
      { full_name: 'Carmen Ibáñez', phone: '72345678' },
    ])
  })
  it('no toma números cortos ni fijos como celular', () => {
    expect(parsePaste('Pedro 123456\nAna 3345678')).toEqual([])
  })
})

describe('rowIssue', () => {
  it('pide nombre y celular válidos', () => {
    expect(rowIssue(row('a', 'Al', '71234567'), [], none)).toBe('name')
    expect(rowIssue(row('a', 'Alba', '1234'), [], none)).toBe('phone')
    expect(rowIssue(row('a', 'Alba', '7123 4567'), [], none)).toBeNull()
  })
  it('marca el que ya existe y el repetido dentro de la carga (el primero queda)', () => {
    const rows = [row('a', 'Alba', '71234567'), row('b', 'Beto', '7123-4567'), row('c', 'Ceci', '76543210')]
    const hits = new Map([['76543210', { norm: '76543210', branch_name: 'X', full_name: null, assigned_to: null }]])
    expect(rows.map((r) => rowIssue(r, rows, hits))).toEqual([null, 'repeated', 'exists'])
    expect(readyRows([...rows, row('d', '', '')], hits).map((r) => r.key)).toEqual(['a'])
  })
})

const people: Assignee[] = [
  { id: 'isa', full_name: 'Isabel', role: 'field_assistant', pending: 3 },
  { id: 'kat', full_name: 'Katherine', role: 'field_assistant', pending: 0 },
  { id: 'sup', full_name: 'Carmen', role: 'field_supervisor', pending: 0 },
]

describe('proposeAssignees', () => {
  it('reparte parejo entre auxiliares empezando por quien tiene menos pendientes', () => {
    const ready = ['a', 'b', 'c', 'd', 'e'].map((k) => row(k, `Cliente ${k}`, '71234567'))
    // kat 0 → 1,2,3 ; empate 3-3 → isa (primera) → 4 ; luego kat
    expect(proposeAssignees(ready, people, 'even', null)).toEqual(['kat', 'kat', 'kat', 'isa', 'kat'])
  })
  it('respeta las elegidas a mano y cuentan su carga', () => {
    const ready = [row('a', 'A', '1', 'kat'), row('b', 'B', '1', 'kat'), row('c', 'C', '1'), row('d', 'D', '1', 'sup')]
    expect(proposeAssignees(ready, people, 'even', null)).toEqual(['kat', 'kat', 'kat', 'sup'])
  })
  it('«todos a una persona» y sin auxiliares', () => {
    const ready = [row('a', 'A', '1'), row('b', 'B', '1')]
    expect(proposeAssignees(ready, people, 'one', 'sup')).toEqual(['sup', 'sup'])
    expect(proposeAssignees(ready, people, 'one', null)).toEqual(['isa', 'isa'])
    expect(proposeAssignees(ready, [people[2]!], 'even', null)).toEqual([null, null])
  })
  it('ignora un responsable que ya no está en la lista', () => {
    expect(proposeAssignees([row('a', 'A', '1', 'otro')], people, 'even', null)).toEqual(['kat'])
  })
})

describe('buildItems / countBy', () => {
  it('arma los items con el responsable propuesto y limpia el nombre', () => {
    const ready = [row('a', '  Doña   Lucía ', '7654 3210')]
    expect(buildItems(ready, ['kat'], ['id-1'])).toEqual([
      { id: 'id-1', full_name: 'Doña Lucía', phone: '7654 3210', product_id: null, assigned_to: 'kat' },
    ])
    expect([...countBy(['kat', 'kat', null, 'isa'])]).toEqual([
      ['kat', 2],
      ['isa', 1],
    ])
  })
})
