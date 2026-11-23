import { describe, expect, it } from 'vitest'
import { matchesAll, matchesNameOrPhone, normalizeText } from '@/lib/search'

describe('buscador de productos', () => {
  it('ignora tildes y mayúsculas', () => expect(normalizeText('Televisión ÁÉ')).toBe('television ae'))
  it('todas las palabras, en cualquier orden', () => {
    const h = normalizeText('Samsung A56 Celulares')
    expect(matchesAll(h, 'a56 samsung')).toBe(true)
    expect(matchesAll(h, 'samsung a15')).toBe(false)
  })
  it('"sillon" encuentra "Sillón ejecutivo"', () => expect(matchesAll(normalizeText('Sillón ejecutivo'), 'sillon')).toBe(true))
})

// Spec 020: lupa de «Clientes asignados» y «Mis contactos».
describe('matchesNameOrPhone', () => {
  const juan = { full_name: 'Juan Pérez Mamani', phone_norm: '71234567' }
  it('vacío: todos', () => expect(matchesNameOrPhone(juan, '   ')).toBe(true))
  it('nombre: palabras en cualquier orden, sin tildes ni mayúsculas', () => {
    expect(matchesNameOrPhone(juan, 'mamani PEREZ')).toBe(true)
    expect(matchesNameOrPhone(juan, 'juan quispe')).toBe(false)
  })
  it('celular: parte de los dígitos', () => {
    expect(matchesNameOrPhone(juan, '3456')).toBe(true)
    expect(matchesNameOrPhone(juan, '9999')).toBe(false)
  })
  it('celular con espacios, guiones o +591', () => {
    expect(matchesNameOrPhone(juan, '712-345')).toBe(true)
    expect(matchesNameOrPhone(juan, '7123 4567')).toBe(true)
    expect(matchesNameOrPhone(juan, '+591 71234567')).toBe(true)
  })
  it('sin celular cargado: solo por nombre', () =>
    expect(matchesNameOrPhone({ full_name: 'Ana', phone_norm: null }, '7123')).toBe(false))
})
