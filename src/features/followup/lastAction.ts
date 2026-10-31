import type { ContactMethod } from './api'

// Último medio que la auxiliar abrió para cada cliente, para proponerlo al registrar el contacto.
// No se hacen llamadas por teléfono (2026-10-29): por defecto, llamada por WhatsApp.
// El último contacto abierto se guarda también en el celular (solo el id del cliente y el medio): al volver de
// WhatsApp se abre solo el registro, aunque el celular haya cerrado la app mientras tanto.
const last = new Map<string, ContactMethod>()
const KEY = 'captacion.lastContact'
const MAX_AGE = 30 * 60_000

type Pending = { id: string; method: ContactMethod; at: number }

function readPending(): Pending | null {
  try {
    const v = localStorage.getItem(KEY)
    return v ? (JSON.parse(v) as Pending) : null
  } catch {
    return null
  }
}

export function rememberMethod(prospectId: string, method: ContactMethod): void {
  last.set(prospectId, method)
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: prospectId, method, at: Date.now() }))
  } catch {
    /* sin almacenamiento: solo se recuerda mientras la app siga abierta */
  }
}

export function suggestedMethod(prospectId: string): ContactMethod {
  const p = readPending()
  return last.get(prospectId) ?? (p?.id === prospectId ? p.method : 'whatsapp_call')
}

/** Contacto abierto hace menos de 30 minutos y todavía sin registrar; lo consume (se pregunta una sola vez). */
export function takePendingContact(): Pending | null {
  const p = readPending()
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nada que limpiar */
  }
  return p && Date.now() - p.at < MAX_AGE ? p : null
}
