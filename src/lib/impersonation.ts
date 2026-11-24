import type { AppRole } from '@/features/auth/types'

/**
 * «Actuar como» (spec 027): Sistemas usa la app con la identidad de otra persona. No hay token propio: la app manda
 * `x-actuar-como: <id>` en cada consulta y la base (pre-request `apply_impersonation`) decide si vale. Acá solo vive
 * el estado en el navegador; la autoridad es siempre el servidor (vencida o cerrada → `impersonation_invalid`).
 */
export type ImpersonationTarget = { id: string; username: string; full_name: string; role: AppRole }
export type Impersonation = { id: string; actorId: string; expiresAt: string; target: ImpersonationTarget }

export const IMPERSONATION_HEADER = 'x-actuar-como'
export const IMPERSONATION_KEY = 'captacion.actuarComo'
const KEY = IMPERSONATION_KEY

export function remainingMs(s: Impersonation, now: number = Date.now()): number {
  return Math.max(0, Date.parse(s.expiresAt) - now)
}

export function formatRemaining(ms: number): string {
  const total = Math.floor(ms / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

function readStored(): Impersonation | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Impersonation
    return remainingMs(s) > 0 ? s : null
  } catch {
    return null
  }
}

/** La suplantación vigente de ESTE admin (otra cuenta en el mismo navegador no la hereda). */
export function readImpersonation(actorId: string): Impersonation | null {
  const s = readStored()
  return s && s.actorId === actorId ? s : null
}

export function saveImpersonation(s: Impersonation): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* sin almacenamiento no se puede actuar como otro: la consulta seguirá como el admin */
  }
}

export function clearImpersonation(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nada que limpiar */
  }
}

/** Valor de la cabecera para la próxima consulta, o null si no hay suplantación vigente. */
export function impersonationHeader(): string | null {
  return readStored()?.id ?? null
}

export function isImpersonationInvalid(body: string): boolean {
  return body.includes('"impersonation_invalid"')
}

/** Recarga completa: no queda nada en memoria (React Query, catálogos) de la identidad anterior. */
export function reloadApp(): void {
  location.assign(import.meta.env.BASE_URL)
}
