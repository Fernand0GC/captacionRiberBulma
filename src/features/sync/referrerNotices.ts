// Avisos «se guardó sin referidor» (spec 010, research R6): el servidor aceptó la captación pero no pudo aplicar el
// referidor escrito (tope diario o nombre inválido). Se guardan en el celular hasta que la persona los cierra.

export type ReferrerNotice = { id: string; client: string; referrer: string }

const key = (userId: string) => `captacion.${userId}.referrerNotices`
const MAX = 20
const listeners = new Set<() => void>()

export function readReferrerNotices(userId: string): ReferrerNotice[] {
  try {
    const raw = localStorage.getItem(key(userId))
    return raw ? (JSON.parse(raw) as ReferrerNotice[]) : []
  } catch {
    return []
  }
}

function write(userId: string, list: ReferrerNotice[]): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(list.slice(-MAX)))
  } catch {
    /* sin almacenamiento: el aviso no se conserva */
  }
  listeners.forEach((l) => l())
}

export function addReferrerNotice(userId: string, n: ReferrerNotice): void {
  write(userId, [...readReferrerNotices(userId).filter((x) => x.id !== n.id), n])
}

export function dismissReferrerNotice(userId: string, id: string): void {
  write(userId, readReferrerNotices(userId).filter((x) => x.id !== id))
}

export function onReferrerNotices(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
