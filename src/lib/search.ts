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

/** Solo dígitos y separadores de celular («7123 4567», «712-345», «+591 7…»). */
const PHONE_QUERY = /^[\d\s+\-().]+$/

/**
 * Lupa de «Clientes asignados» y «Mis contactos» (spec 020). Si se escribe un celular, compara solo dígitos (sin el
 * 591 de adelante) contra `phone_norm`; si no, todas las palabras en el nombre, sin tildes ni mayúsculas.
 */
export function matchesNameOrPhone(r: { full_name: string; phone_norm: string | null }, query: string): boolean {
  const q = query.trim()
  if (!q) return true
  if (PHONE_QUERY.test(q)) {
    let digits = q.replace(/\D/g, '')
    if (digits.length > 8 && digits.startsWith('591')) digits = digits.slice(3)
    return !!r.phone_norm && r.phone_norm.includes(digits)
  }
  return matchesAll(normalizeText(r.full_name), q)
}
