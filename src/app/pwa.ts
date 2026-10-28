import { registerSW } from 'virtual:pwa-register'
import { db } from '@/features/sync/db'

const CHECK_MS = 30_000

/**
 * Registra el service worker. Si hay versión nueva, recarga solo cuando es seguro:
 * sin captaciones pendientes y en la pantalla principal (nunca a mitad de un formulario).
 */
export function setupPwa(): void {
  if (!('serviceWorker' in navigator)) return
  void navigator.storage?.persist?.()

  let waiting = false
  const update = registerSW({
    onNeedRefresh() {
      waiting = true
    },
  })

  window.setInterval(async () => {
    if (!waiting) return
    const pending = await db.outbox.count()
    const safePath = location.pathname === '/registrar' || location.pathname === '/gestion'
    if (pending === 0 && safePath) void update(true)
  }, CHECK_MS)
}
