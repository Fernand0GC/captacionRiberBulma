import { registerSW } from 'virtual:pwa-register'
import { db } from '@/features/sync/db'

const CHECK_MS = 30_000
/** Cada cuánto se pregunta al servidor si hay versión nueva (además de al abrir y al volver a la app). */
const UPDATE_MS = 5 * 60_000

/**
 * Nunca recargar a mitad de algo: formulario de captación, un diálogo abierto o escribiendo en un campo.
 * En cualquier otra pantalla (Panel, Mi equipo, Metas…) la recarga es segura.
 */
function busy(): boolean {
  if (location.pathname === '/registrar/nuevo') return true
  if (document.querySelector('dialog[open]')) return true
  const el = document.activeElement
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
}

/**
 * Registra el service worker. Si hay versión nueva, recarga solo cuando es seguro:
 * sin captaciones pendientes y sin nada a medio llenar.
 */
export function setupPwa(): void {
  if (!('serviceWorker' in navigator)) return
  void navigator.storage?.persist?.()

  let waiting = false
  const update = registerSW({
    onNeedRefresh() {
      waiting = true
    },
    // La app queda abierta días en el celular: sin esto solo se enteraba de versiones nuevas al abrirse.
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => undefined)
      }
      window.setInterval(check, UPDATE_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })

  window.setInterval(async () => {
    if (!waiting || busy()) return
    if ((await db.outbox.count()) === 0) void update(true)
  }, CHECK_MS)
}
