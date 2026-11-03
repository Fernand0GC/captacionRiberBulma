import { describe, expect, it } from 'vitest'
import { groupChannels, totalsByGroup } from '@/features/capture/channelGroups'

const channels = [
  { id: 1, name: 'Convenio', group: 'street' as const },
  { id: 2, name: 'TikTok', group: 'store' as const },
  { id: 3, name: 'Activación', group: 'street' as const },
  { id: 4, name: 'Otro', group: null },
]

describe('groupChannels', () => {
  it('ordena Calle, Tienda y Otros, conservando el orden dentro de cada grupo', () => {
    const blocks = groupChannels(channels)
    expect(blocks.map((b) => b.label)).toEqual(['Calle', 'Tienda', 'Otros'])
    expect(blocks[0]?.items.map((c) => c.name)).toEqual(['Convenio', 'Activación'])
  })

  it('no muestra bloques vacíos', () => {
    expect(groupChannels(channels.slice(0, 1)).map((b) => b.label)).toEqual(['Calle'])
  })
})

describe('totalsByGroup', () => {
  it('suma por grupo; lo que no está en el catálogo (inactivo o sin canal) va a Otros', () => {
    const rows = [
      { name: 'Convenio', n: 4 },
      { name: 'Activación', n: 3 },
      { name: 'TikTok', n: 2 },
      { name: 'E-commerce', n: 1 },
      { name: 'Sin canal', n: 1 },
    ]
    const groupOf = (r: { name: string }) => channels.find((c) => c.name === r.name)?.group ?? null
    expect(totalsByGroup(rows, groupOf)).toEqual([
      { label: 'Calle', value: 7 },
      { label: 'Tienda', value: 2 },
      { label: 'Otros', value: 2 },
    ])
  })
})
