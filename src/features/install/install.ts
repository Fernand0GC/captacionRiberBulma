import { useSyncExternalStore } from 'react'

/** Evento de Chrome/Android para mostrar su propio instalador (no está en los tipos de TS). */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

/**
 * Cómo se instala en este celular:
 * - prompt: Android/Chrome ofreció su instalador, basta un toque.
 * - ios: iPhone, hay que hacerlo a mano desde Compartir.
 * - android: Android sin instalador listo (otro navegador o aún no lo ofreció): desde el menú ⋮.
 * - inapp: abierto dentro de WhatsApp/Facebook/Instagram, desde ahí no se puede instalar.
 * - none: ya instalada, o computadora sin instalador.
 */
export type InstallMode = 'prompt' | 'ios' | 'android' | 'inapp' | 'none'

const HIDE_KEY = 'install-hidden'

let deferred: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Se registra al cargar la app: Chrome lanza el evento una sola vez y muy temprano. */
export function setupInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    notify()
  })
}

function standalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

function hidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

export function installMode(ua = navigator.userAgent): InstallMode {
  if (installed || standalone() || hidden()) return 'none'
  if (deferred) return 'prompt'
  if (/WhatsApp|FBAN|FBAV|FB_IAB|Instagram|; wv\)/i.test(ua)) return 'inapp'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'none'
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => installMode(),
  )
}

/** Abre el instalador de Android. Devuelve true si la persona aceptó. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred
  if (!e) return false
  await e.prompt()
  const { outcome } = await e.userChoice
  deferred = null
  if (outcome === 'accepted') installed = true
  notify()
  return outcome === 'accepted'
}

/** "Ya la tengo": deja de mostrar el aviso en este navegador. */
export function hideInstall(): void {
  try {
    localStorage.setItem(HIDE_KEY, '1')
  } catch {
    // sin almacenamiento: el aviso vuelve a salir la próxima vez
  }
  notify()
}
