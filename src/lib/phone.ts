// Mismas reglas que public.normalize_phone / public.is_valid_phone (research R10).

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '')
  return /^591\d{7,8}$/.test(digits) ? digits.slice(3) : digits
}

export function isValidPhone(raw: string): boolean {
  return /^([567]\d{7}|[234]\d{6,7})$/.test(normalizePhone(raw))
}

/** 71234567 → 7123••67. Para avisos: nunca mostrar el número completo de otra ficha. */
export function maskPhone(norm: string): string {
  if (norm.length < 6) return '••••'
  return `${norm.slice(0, 4)}••${norm.slice(-2)}`
}
