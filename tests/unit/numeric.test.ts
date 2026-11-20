import { describe, expect, it } from 'vitest'
import { digits, NUMERIC_INPUT } from '@/lib/numeric'

// Spec 011: los campos de enteros son de texto (la rueda del mouse no cambia el valor) y solo aceptan cifras.
describe('digits', () => {
  it('deja el número tal cual', () => {
    expect(digits('6')).toBe('6')
    expect(digits('9999')).toBe('9999')
    expect(digits('')).toBe('')
  })
  it('quita lo que no es cifra (signos, letras, espacios, decimales)', () => {
    expect(digits('-3')).toBe('3')
    expect(digits('1 2')).toBe('12')
    expect(digits('12a')).toBe('12')
    expect(digits('1.5')).toBe('15')
  })
  it('corta en 4 cifras (máximo 9999)', () => {
    expect(digits('123456')).toBe('1234')
  })
})

describe('NUMERIC_INPUT', () => {
  it('no usa type="number" y pide el teclado numérico', () => {
    expect(NUMERIC_INPUT.type).toBe('text')
    expect(NUMERIC_INPUT.inputMode).toBe('numeric')
  })
})
