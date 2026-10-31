import { beforeEach, describe, expect, it } from 'vitest'
import { db, getMeta } from '@/features/sync/db'
import { acceptedKey, applyServerToday, bumpToday, confirmedIds, serverIdsKey, todayTotal } from '@/features/sync/todayCount'

const U = 'user-1'
const now = () => new Date().toISOString()

async function shown(pending: string[] = []): Promise<number> {
  return todayTotal(confirmedIds(await getMeta<string[]>(serverIdsKey(U)), await getMeta<string[]>(acceptedKey(U))), pending)
}

beforeEach(async () => {
  await db.meta.clear()
})

describe('contador de hoy (unión por id)', () => {
  it('suma las confirmadas en el dispositivo', async () => {
    await bumpToday(U, now(), 'a')
    await bumpToday(U, now(), 'b')
    expect(await shown()).toBe(2)
  })

  it('la misma captación confirmada dos veces cuenta una', async () => {
    await bumpToday(U, now(), 'a')
    await bumpToday(U, now(), 'a')
    expect(await shown()).toBe(1)
  })

  it('no suma captaciones de otro día', async () => {
    await bumpToday(U, '2020-01-01T10:00:00-04:00', 'a')
    expect(await shown()).toBe(0)
  })

  it('el servidor suma las de otros dispositivos', async () => {
    await bumpToday(U, now(), 'a')
    await applyServerToday(U, ['x', 'y', 'z', 'a'])
    expect(await shown()).toBe(4)
  })

  it('servidor desactualizado + confirmación local: no se pierde ninguna (bug del máximo)', async () => {
    await applyServerToday(U, ['x', 'y', 'z']) // 3 de antes (otro dispositivo)
    await bumpToday(U, now(), 'a') // confirmada ahora en este dispositivo
    expect(await shown()).toBe(4)
  })

  it('carrera: el servidor ya la tiene y sigue pendiente en el dispositivo → no se cuenta dos veces', async () => {
    await applyServerToday(U, ['a'])
    expect(await shown(['a'])).toBe(1)
  })

  it('pendientes que el servidor todavía no tiene suman', async () => {
    await applyServerToday(U, ['a'])
    expect(await shown(['b', 'c'])).toBe(3)
  })
})
