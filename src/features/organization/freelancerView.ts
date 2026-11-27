import { normalizeText } from '@/lib/search'

export type FreelancerItem = { id: number; name: string; checked: boolean }

export function freelancerView(
  options: { id: number; name: string }[], picked: number[], query: string,
): { items: FreelancerItem[]; pickedText: string | null; addName: string | null; emptyText: string | null } {
  const normalize = (text: string) => normalizeText(text).replace(/\s+/g, ' ')
  const search = normalize(query)
  const cleanQuery = query.trim().replace(/\s+/g, ' ')
  const selected = new Set(picked)
  const items = options
    .map(({ id, name }) => ({ id, name, checked: selected.has(id) }))
    .filter((item) => item.checked || normalize(item.name).includes(search))
    .sort((a, b) => Number(b.checked) - Number(a.checked) || a.name.localeCompare(b.name, 'es'))

  return {
    items,
    pickedText: selected.size === 0 ? null : `${selected.size} ${selected.size === 1 ? 'marcado' : 'marcados'}`,
    addName: cleanQuery.length >= 2 && !options.some((item) => normalize(item.name) === search)
      ? cleanQuery
      : null,
    emptyText: search && items.length === 0 ? `Ningún freelancer coincide con «${query}».` : null,
  }
}
