// Puente portal ↔ sistema, lado sistema (contracts/puente.md `rb-puente/1`). Lógica pura sin React ni router:
// recibe la ventana por parámetro para probarla con una falsa.
import { PROTOCOLO, type Aviso, type IdSistema, type MensajePortal, type MensajeSistema, type TemaPuente } from './contract'

/** Lo mínimo de `window` que usa el puente. */
export type BridgeWindow = {
  parent: { postMessage: (message: unknown, targetOrigin: string) => void }
  addEventListener: (type: 'message', fn: (e: MessageEvent) => void) => void
  removeEventListener: (type: 'message', fn: (e: MessageEvent) => void) => void
}

export type BridgeOptions = {
  sistema: IdSistema
  /** Origen exacto del portal (PORTAL_ORIGEN). */
  origenPortal: string
  win: BridgeWindow
  alBienvenida: (tema: TemaPuente) => void
  alTema: (tema: TemaPuente) => void
  alAbrir: (ruta: string) => void
  alSalir: () => void
  /** Sin `bienvenida` en este tiempo el sistema sigue en modo normal (contrato: 3 s). */
  esperaMs?: number
  /** Máximo un envío de avisos cada tanto (contrato: 5 s). */
  intervaloAvisosMs?: number
}

export type Bridge = {
  enviarAvisos: (avisos: Aviso[]) => void
  enviarRuta: (ruta: string) => void
  avisarSesionCerrada: () => void
  detener: () => void
}

const esTema = (t: unknown): t is TemaPuente => t === 'claro' || t === 'oscuro'

/** Ruta interna: relativa y que empieza con "/" (no "//", que sería otro sitio, ni barras invertidas). */
export const esRutaInterna = (r: unknown): r is string =>
  typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') && !r.includes('\\') && r.length <= 2000

/** Mensaje del portal bien formado, o null (se ignora en silencio). */
export function leerMensajePortal(data: unknown): MensajePortal | null {
  if (!data || typeof data !== 'object') return null
  const m = data as Record<string, unknown>
  if (m.protocolo !== PROTOCOLO) return null
  switch (m.tipo) {
    case 'bienvenida':
    case 'tema':
      return esTema(m.tema) ? { protocolo: PROTOCOLO, tipo: m.tipo, tema: m.tema } : null
    case 'abrir':
      return esRutaInterna(m.ruta) ? { protocolo: PROTOCOLO, tipo: 'abrir', ruta: m.ruta } : null
    case 'salir':
      return { protocolo: PROTOCOLO, tipo: 'salir' }
    default:
      return null
  }
}

/**
 * Saluda al portal (`listo`) y espera `bienvenida`. Hasta recibirla no envía ni atiende nada más; si no llega a tiempo
 * deja de escuchar (modo normal). Solo se usa dentro de un marco y con PORTAL_ORIGEN configurado.
 */
export function crearPuenteSistema(o: BridgeOptions): Bridge {
  const espera = o.esperaMs ?? 3_000
  const intervalo = o.intervaloAvisosMs ?? 5_000
  let conectado = false
  let ultimaRuta: string | null = null
  let ultimosAvisos: string | null = null
  let ultimoEnvioAvisos = -Infinity
  let pendientes: Aviso[] | null = null
  let timerAvisos: ReturnType<typeof setTimeout> | undefined

  const enviar = (m: MensajeSistema) => o.win.parent.postMessage(m, o.origenPortal)

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== o.origenPortal || e.source !== o.win.parent) return
    const m = leerMensajePortal(e.data)
    if (!m) return
    if (m.tipo === 'bienvenida') {
      if (conectado) return o.alTema(m.tema) // el portal volvió a saludar: solo puede cambiar el tema
      conectado = true
      clearTimeout(timerEspera)
      return o.alBienvenida(m.tema)
    }
    if (!conectado) return
    if (m.tipo === 'tema') o.alTema(m.tema)
    else if (m.tipo === 'abrir') o.alAbrir(m.ruta)
    else o.alSalir()
  }

  const detener = () => {
    o.win.removeEventListener('message', onMessage)
    clearTimeout(timerEspera)
    clearTimeout(timerAvisos)
  }

  o.win.addEventListener('message', onMessage)
  const timerEspera = setTimeout(() => {
    if (!conectado) detener()
  }, espera)
  enviar({ protocolo: PROTOCOLO, tipo: 'listo', sistema: o.sistema })

  const soltarAvisos = () => {
    timerAvisos = undefined
    if (!pendientes) return
    const avisos = pendientes
    pendientes = null
    const clave = JSON.stringify(avisos)
    if (clave === ultimosAvisos) return
    ultimosAvisos = clave
    ultimoEnvioAvisos = Date.now()
    enviar({ protocolo: PROTOCOLO, tipo: 'avisos', sistema: o.sistema, avisos })
  }

  return {
    enviarAvisos(avisos) {
      if (!conectado) return
      pendientes = avisos
      if (timerAvisos !== undefined) return // ya hay un envío programado: saldrá con la lista más nueva
      const falta = ultimoEnvioAvisos + intervalo - Date.now()
      if (falta <= 0) soltarAvisos()
      else timerAvisos = setTimeout(soltarAvisos, falta)
    },
    enviarRuta(ruta) {
      if (!conectado || !esRutaInterna(ruta) || ruta === ultimaRuta) return
      ultimaRuta = ruta
      enviar({ protocolo: PROTOCOLO, tipo: 'ruta', sistema: o.sistema, ruta })
    },
    avisarSesionCerrada() {
      if (conectado) enviar({ protocolo: PROTOCOLO, tipo: 'sesion-cerrada', sistema: o.sistema })
    },
    detener,
  }
}
