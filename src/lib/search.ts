/** Minúsculas y sin tildes, para buscar "television" y encontrar "Televisión". */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Todas las palabras de la búsqueda tienen que aparecer (en cualquier orden). */
export function matchesAll(haystack: string, query: string): boolean {
  const words = normalizeText(query).split(/\s+/).filter(Boolean)
  return words.every((w) => haystack.includes(w))
}
