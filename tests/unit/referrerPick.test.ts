import { describe, expect, it } from 'vitest'
import {
  canAdd,
  cleanName,
  findExact,
  mergeOptions,
  nextRemembered,
  optionToChoice,
  referrerKey,
  suggest,
  toPayload,
  validName,
  type RememberedReferrer,
} from '@/features/capture/referrerPick'
import type { CatalogReferrer } from '@/features/capture/useCatalogs'

const catalog: CatalogReferrer[] = [
  { id: 1, name: 'Contacto Fernanda', branch_id: 5, kind: 'staff' },
  { id: 2, name: 'Freelance Walker', branch_id: 5, kind: 'freelance' },
  { id: 3, name: 'App', branch_id: 7, kind: 'channel' },
]

describe('referido al registrar (010)', () => {
  it('cleanName y referrerKey: sin espacios de más, sin tildes ni mayúsculas (igual que la base)', () => {
    expect(cleanName('  Doña   Susi ')).toBe('Doña Susi')
    expect(referrerKey('  Doña   SUSÍ ')).toBe('dona susi')
    expect(referrerKey('José')).toBe(referrerKey('JOSE'))
  })
  it('validName: entre 2 y 60 caracteres ya limpio', () => {
    expect(validName(' X ')).toBe(false)
    expect(validName('Xi')).toBe(true)
    expect(validName('a'.repeat(60))).toBe(true)
    expect(validName('a'.repeat(61))).toBe(false)
  })
  it('mergeOptions: solo la sucursal; suma los recién escritos que el catálogo no trae', () => {
    const remembered: RememberedReferrer[] = [
      { name: 'Doña Susi', kind: 'client', branch_id: 5 },
      { name: 'contacto fernanda', kind: 'staff', branch_id: 5 }, // ya está en el catálogo
      { name: 'Otra Sucursal', kind: 'other', branch_id: 7 },
    ]
    expect(mergeOptions(catalog, remembered, 5)).toEqual([
      { id: 1, name: 'Contacto Fernanda', kind: 'staff' },
      { id: 2, name: 'Freelance Walker', kind: 'freelance' },
      { id: null, name: 'Doña Susi', kind: 'client' },
    ])
    expect(mergeOptions(catalog, [], 1)).toEqual([])
    expect(mergeOptions(catalog, remembered, null)).toEqual([])
  })
  it('suggest: todas las palabras, sin tildes; vacío devuelve todas; respeta el máximo', () => {
    const opts = mergeOptions(catalog, [], 5)
    expect(suggest(opts, 'fér').map((o) => o.name)).toEqual(['Contacto Fernanda'])
    expect(suggest(opts, 'walker free').map((o) => o.name)).toEqual(['Freelance Walker'])
    expect(suggest(opts, '')).toHaveLength(2)
    expect(suggest(opts, '', 1)).toHaveLength(1)
    expect(suggest(opts, 'nadie')).toEqual([])
  })
  it('findExact y canAdd: no se ofrece agregar uno que ya existe ni un nombre inválido', () => {
    const opts = mergeOptions(catalog, [], 5)
    expect(findExact(opts, ' contacto  FERNANDA ')?.id).toBe(1)
    expect(findExact(opts, 'Fernanda')).toBeUndefined()
    expect(findExact(opts, '')).toBeUndefined()
    expect(canAdd(opts, 'Contacto Fernandá')).toBe(false)
    expect(canAdd(opts, 'Doña Susi')).toBe(true)
    expect(canAdd(opts, 'D')).toBe(false)
    expect(canAdd([], 'Doña Susi')).toBe(true)
  })
  it('optionToChoice y toPayload: id del catálogo o referidor nuevo dentro de la captación', () => {
    expect(toPayload(optionToChoice({ id: 2, name: 'Freelance Walker', kind: 'freelance' }))).toEqual({ referrer_id: 2 })
    expect(toPayload(optionToChoice({ id: null, name: 'Doña Susi', kind: 'client' }))).toEqual({
      referrer_new: { name: 'Doña Susi', kind: 'client' },
    })
    expect(toPayload({ id: null, name: '  Doña   Susi ', kind: 'client' })).toEqual({ referrer_new: { name: 'Doña Susi', kind: 'client' } })
    // Un tipo desconocido en lo recordado no rompe: va como «otro».
    expect(optionToChoice({ id: null, name: 'Raro', kind: 'channel' })).toEqual({ id: null, name: 'Raro', kind: 'other' })
  })
  it('nextRemembered: agrega sin repetir y descarta lo que el catálogo ya trae', () => {
    const a: RememberedReferrer = { name: 'Doña Susi', kind: 'client', branch_id: 5 }
    expect(nextRemembered([], a, catalog)).toEqual([a])
    expect(nextRemembered([a], { ...a, name: 'doña  susi' }, catalog)).toEqual([{ ...a, name: 'doña susi' }])
    // Mismo nombre en otra sucursal es otro referidor.
    expect(nextRemembered([a], { ...a, branch_id: 7 }, catalog)).toHaveLength(2)
    // El catálogo ya lo trae: se limpia.
    expect(nextRemembered([a], null, [...catalog, { id: 9, name: 'DOÑA SUSI', branch_id: 5, kind: 'client' }])).toEqual([])
    expect(nextRemembered([], { name: 'Contacto Fernanda', kind: 'staff', branch_id: 5 }, catalog)).toEqual([])
  })
})
