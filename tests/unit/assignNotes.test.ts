import { describe, expect, it, vi } from 'vitest'
import { assigneeNote } from '@/features/prospects/AssignSelection'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

// Aviso bajo «Asignar a…»: por qué no aparece gente de otra sucursal (pedido de ventas, 24/11).
describe('assigneeNote', () => {
  it('con personal: solo el de esa sucursal', () =>
    expect(assigneeNote('VERDOLAGO', 3)).toBe('Solo aparece el personal activo de VERDOLAGO'))
  it('sin personal disponible: lo dice en vez de una lista vacía', () =>
    expect(assigneeNote('SAN BORJA', 0)).toBe('No hay personal activo en SAN BORJA'))
  it('sin el nombre todavía (lista de sucursales cargando): no inventa', () =>
    expect(assigneeNote(undefined, 3)).toBe('Solo aparece el personal activo de esta sucursal'))
  it('sin saber cuántos hay (personas cargando o con error): no dice que no hay nadie', () =>
    expect(assigneeNote('TRINIDAD', undefined)).toBe('Solo aparece el personal activo de TRINIDAD'))
})
