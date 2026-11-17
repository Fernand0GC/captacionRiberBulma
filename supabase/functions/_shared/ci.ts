// CI de la persona (contrato cuenta-unica v1). Sin APIs de Deno: lo usan las Edge Functions, la SPA y Vitest.

/** Formato guardado en profiles.ci: número de 4 a 12 dígitos y complemento opcional en mayúsculas (7788990-1B). */
export const CI_PATTERN = /^[0-9]{4,12}(-[0-9A-Z]{1,4})?$/

/**
 * Lleva un CI escrito por una persona o llegado de la cuenta única ('7788990-1b') al formato guardado ('7788990-1B').
 * Devuelve null si no es un CI válido.
 */
export function parseCi(raw: string): string | null {
  const ci = raw.trim().toUpperCase().replace(/\s+/g, '')
  return CI_PATTERN.test(ci) ? ci : null
}
