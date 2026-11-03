export type ChannelGroup = 'street' | 'store'

export const CHANNEL_GROUP_LABEL: Record<ChannelGroup, string> = { street: 'Calle', store: 'Tienda' }

const ORDER: (ChannelGroup | null)[] = ['street', 'store', null]

/** Agrupa una lista (ya ordenada) en Calle, Tienda y "Otros" (sin grupo), sin bloques vacíos. */
export function groupChannels<T extends { group: ChannelGroup | null }>(
  items: T[],
): { group: ChannelGroup | null; label: string; items: T[] }[] {
  return ORDER.map((g) => ({
    group: g,
    label: g ? CHANNEL_GROUP_LABEL[g] : 'Otros',
    items: items.filter((i) => (i.group ?? null) === g),
  })).filter((b) => b.items.length > 0)
}

/** Suma por grupo una lista de conteos por canal; el grupo se busca por nombre o id en el catálogo (inactivos van a "Otros"). */
export function totalsByGroup<T extends { n: number }>(
  rows: T[],
  groupOf: (row: T) => ChannelGroup | null,
): { label: string; value: number }[] {
  const sum = (g: ChannelGroup | null) => rows.filter((r) => groupOf(r) === g).reduce((a, r) => a + r.n, 0)
  return ORDER.map((g) => ({ label: g ? CHANNEL_GROUP_LABEL[g] : 'Otros', value: sum(g) })).filter(
    (t) => t.value > 0,
  )
}
