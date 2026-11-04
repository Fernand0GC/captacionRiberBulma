import { describe, expect, it } from 'vitest'
import { credentialsText, idleDays, isIdle, similarMember, type Member } from '@/features/team/team'

const NOW = new Date('2026-11-05T15:00:00Z')
const member = (over: Partial<Member>): Member => ({
  id: crypto.randomUUID(),
  username: 'vol.trini.maria',
  full_name: 'María Pérez',
  active: true,
  created_at: '2026-11-01T12:00:00Z',
  deactivated_at: null,
  today: 0,
  total: 0,
  last_capture_at: null,
  ...over,
})

describe('idleDays / isIdle', () => {
  it('cuenta desde la última captación', () => {
    expect(idleDays(member({ last_capture_at: '2026-10-01T12:00:00Z' }), NOW)).toBe(35)
    expect(isIdle(member({ last_capture_at: '2026-10-01T12:00:00Z' }), NOW)).toBe(true)
  })
  it('si nunca captó, cuenta desde que se creó', () => {
    expect(idleDays(member({}), NOW)).toBe(4)
    expect(isIdle(member({ created_at: '2026-09-01T12:00:00Z' }), NOW)).toBe(true)
  })
  it('las inactivas no avisan', () => {
    expect(idleDays(member({ active: false, created_at: '2026-01-01T00:00:00Z' }), NOW)).toBeNull()
  })
})

describe('similarMember', () => {
  const rosa = member({ full_name: 'Rosa Vaca Díez', active: false })
  const team = [member({}), rosa]
  it('reconoce el mismo nombre sin tildes, mayúsculas ni orden', () => {
    expect(similarMember('maria perez', team)?.full_name).toBe('María Pérez')
    expect(similarMember('Pérez María', team)?.full_name).toBe('María Pérez')
  })
  it('reconoce dos palabras contenidas en el nombre', () => {
    expect(similarMember('Rosa Vaca', team)).toBe(rosa)
  })
  it('una sola palabra parecida no alcanza', () => {
    expect(similarMember('Rosa', team)).toBeUndefined()
    expect(similarMember('Rosa Flores', team)).toBeUndefined()
    expect(similarMember('', team)).toBeUndefined()
  })
})

it('credentialsText lleva link, usuario y clave', () => {
  expect(credentialsText('vol.trini.maria', '123456')).toContain('Usuario: vol.trini.maria\nClave: 123456')
})
