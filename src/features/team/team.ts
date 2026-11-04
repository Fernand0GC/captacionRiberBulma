import { normalizeText } from '@/lib/search'

export type Member = {
  id: string
  username: string
  full_name: string
  active: boolean
  created_at: string
  deactivated_at: string | null
  today: number
  total: number
  last_capture_at: string | null
}

/** Días sin captar para el aviso del encargado (sin desactivar sola a nadie). */
export const IDLE_DAYS = 30

const DAY = 86_400_000

/** Días desde su última captación (o desde que se creó, si nunca captó). Solo cuenta para las activas. */
export function idleDays(m: Member, now: Date): number | null {
  if (!m.active) return null
  const since = new Date(m.last_capture_at ?? m.created_at).getTime()
  return Math.floor((now.getTime() - since) / DAY)
}

export const isIdle = (m: Member, now: Date) => (idleDays(m, now) ?? 0) >= IDLE_DAYS

/**
 * Persona del equipo con el mismo nombre (sin importar tildes, mayúsculas ni el orden de las palabras),
 * para ofrecer reactivarla en vez de crear una cuenta repetida cuando una volantera vuelve.
 */
export function similarMember(name: string, members: Member[]): Member | undefined {
  const words = normalizeText(name).split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.join('').length < 3) return undefined
  const key = [...words].sort().join(' ')
  return members.find((m) => {
    const theirs = normalizeText(m.full_name).split(/\s+/).filter(Boolean)
    // Mismo nombre completo, o el escrito está contenido en el suyo ("Rosa" ⊂ "Rosa Vaca") con 2+ palabras
    return [...theirs].sort().join(' ') === key || (words.length >= 2 && words.every((w) => theirs.includes(w)))
  })
}

/** Mensaje para pasarle a la volantera sus datos de ingreso. */
export function credentialsText(username: string, password: string): string {
  return `Riber Captación\nhttps://captacion-riberbulma.pages.dev\nUsuario: ${username}\nClave: ${password}`
}
