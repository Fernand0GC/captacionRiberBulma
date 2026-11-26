import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearImpersonation,
  formatRemaining,
  impersonationHeader,
  isImpersonationInvalid,
  readImpersonation,
  remainingMs,
  saveImpersonation,
  staleImpersonationId,
  type Impersonation,
} from '@/lib/impersonation'
import { isTransient, toAppError } from '@/lib/errors'

const NOW = Date.parse('2026-11-25T14:00:00Z')
const ADMIN = '00000000-0000-4000-8000-000000000001'

const sample = (minutes = 30, actorId = ADMIN): Impersonation => ({
  id: 'c5072a87-b62f-498f-9e35-6991346d094d',
  actorId,
  expiresAt: new Date(NOW + minutes * 60_000).toISOString(),
  target: {
    id: '00000000-0000-4000-8000-000000000004',
    username: 'aux.verdolago',
    full_name: 'Auxiliar Verdolago',
    role: 'field_assistant',
  },
})

let store: Record<string, string> = {}

beforeEach(() => {
  store = {}
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => (store[k] = v),
    removeItem: (k: string) => delete store[k],
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('suplantación guardada', () => {
  it('sin nada guardado: no hay suplantación ni cabecera', () => {
    expect(readImpersonation(ADMIN)).toBeNull()
    expect(impersonationHeader()).toBeNull()
  })

  it('vigente y del mismo admin: se lee y manda la cabecera', () => {
    saveImpersonation(sample())
    expect(readImpersonation(ADMIN)?.target.username).toBe('aux.verdolago')
    expect(impersonationHeader()).toBe(sample().id)
  })

  it('de otro admin (otra sesión en el mismo navegador): se ignora', () => {
    saveImpersonation(sample(30, '00000000-0000-4000-8000-0000000000d1'))
    expect(readImpersonation(ADMIN)).toBeNull()
  })

  it('vencida: la pantalla ya no la usa, pero la cabecera SIGUE saliendo para que la base la rechace', () => {
    // Auditoría 2026-11-24 (H1): sin cabecera, la petición correría como el admin antes de que la app vuelva.
    saveImpersonation(sample(30))
    vi.setSystemTime(NOW + 30 * 60_000)
    expect(readImpersonation(ADMIN)).toBeNull()
    expect(impersonationHeader()).toBe(sample().id)
  })

  it('al arrancar: detecta la guardada que ya no vale (vencida o de otro admin) para cerrarla', () => {
    expect(staleImpersonationId(ADMIN)).toBeNull()
    saveImpersonation(sample(30))
    expect(staleImpersonationId(ADMIN)).toBeNull() // vigente y propia: se sigue usando
    vi.setSystemTime(NOW + 30 * 60_000)
    expect(staleImpersonationId(ADMIN)).toBe(sample().id)
    vi.setSystemTime(NOW)
    saveImpersonation(sample(30, '00000000-0000-4000-8000-0000000000d1'))
    expect(staleImpersonationId(ADMIN)).toBe(sample().id)
  })

  it('una captación rechazada por suplantación vencida queda pendiente (error transitorio), no bloqueada', () => {
    expect(isTransient(toAppError({ message: 'impersonation_invalid' }))).toBe(true)
  })

  it('volver: se borra', () => {
    saveImpersonation(sample())
    clearImpersonation()
    expect(readImpersonation(ADMIN)).toBeNull()
  })

  it('guardado roto: se trata como sin suplantación', () => {
    store['captacion.actuarComo'] = '{roto'
    expect(readImpersonation(ADMIN)).toBeNull()
    expect(impersonationHeader()).toBeNull()
  })
})

describe('tiempo restante', () => {
  it('cuenta hacia atrás y nunca es negativo', () => {
    expect(remainingMs(sample(30), NOW)).toBe(30 * 60_000)
    expect(remainingMs(sample(30), NOW + 31 * 60_000)).toBe(0)
  })

  it('se muestra como mm:ss', () => {
    expect(formatRemaining(30 * 60_000)).toBe('30:00')
    expect(formatRemaining(65_500)).toBe('01:05')
    expect(formatRemaining(0)).toBe('00:00')
  })
})

describe('respuesta del servidor', () => {
  it('reconoce el rechazo de una suplantación vencida o cerrada', () => {
    expect(isImpersonationInvalid('{"code":"P0001","message":"impersonation_invalid"}')).toBe(true)
    expect(isImpersonationInvalid('{"code":"P0001","message":"forbidden"}')).toBe(false)
  })
})
