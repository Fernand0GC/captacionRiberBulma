import type { TimelineItem } from './api'

// Resumen "Contactos por persona" de la ficha (specs/002-monitoreo-seguimiento FR-030), calculado del historial.

export type ContactSummary = { actor: string; total: number; calls: number; messages: number; store: number }

export function summarizeContacts(timeline: TimelineItem[]): ContactSummary[] {
  const by = new Map<string, ContactSummary>()
  for (const t of timeline) {
    if (t.type !== 'contact') continue
    const s = by.get(t.actor) ?? { actor: t.actor, total: 0, calls: 0, messages: 0, store: 0 }
    s.total++
    if (t.data.method === 'message') s.messages++
    else if (t.data.method === 'store') s.store++
    else s.calls++ // llamada por WhatsApp o telefónica (antigua)
    by.set(t.actor, s)
  }
  return [...by.values()].sort((a, b) => b.total - a.total || a.actor.localeCompare(b.actor, 'es'))
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "3 llamadas · 1 mensaje", sin los ceros. */
export function contactBreakdown(s: ContactSummary): string {
  return [
    s.calls ? plural(s.calls, 'llamada', 'llamadas') : null,
    s.messages ? plural(s.messages, 'mensaje', 'mensajes') : null,
    s.store ? plural(s.store, 'en tienda', 'en tienda') : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
