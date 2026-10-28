import { describe, expect, it } from 'vitest'
import { matchesAll, normalizeText } from '@/lib/search'

describe('buscador de productos', () => {
  it('ignora tildes y mayúsculas', () => expect(normalizeText('Televisión ÁÉ')).toBe('television ae'))
  it('todas las palabras, en cualquier orden', () => {
    const h = normalizeText('Samsung A56 Celulares')
    expect(matchesAll(h, 'a56 samsung')).toBe(true)
    expect(matchesAll(h, 'samsung a15')).toBe(false)
  })
  it('"sillon" encuentra "Sillón ejecutivo"', () => expect(matchesAll(normalizeText('Sillón ejecutivo'), 'sillon')).toBe(true))
})
