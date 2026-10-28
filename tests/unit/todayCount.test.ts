import { beforeEach, describe, expect, it } from 'vitest'
import { db, getMeta } from '@/features/sync/db'
import { applyServerToday, bumpToday, todayKey } from '@/features/sync/todayCount'

const U = 'user-1'

beforeEach(async () => {
  await db.meta.clear()
})

describe('conteo de hoy', () => {
  it('suma al confirmar una captación de hoy', async () => {
    await bumpToday(U, new Date().toISOString())
    await bumpToday(U, new Date().toISOString())
    expect(await getMeta(todayKey(U))).toBe(2)
  })

  it('no suma captaciones de otro día', async () => {
    await bumpToday(U, '2020-01-01T10:00:00-04:00')
    expect(await getMeta(todayKey(U))).toBeUndefined()
  })

  it('el servidor corrige hacia arriba', async () => {
    await bumpToday(U, new Date().toISOString())
    await applyServerToday(U, 5)
    expect(await getMeta(todayKey(U))).toBe(5)
  })

  it('una respuesta vieja del servidor no baja el conteo (carrera con una confirmación)', async () => {
    await bumpToday(U, new Date().toISOString())
    await applyServerToday(U, 0)
    expect(await getMeta(todayKey(U))).toBe(1)
  })
})
