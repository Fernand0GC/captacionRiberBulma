import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearPuenteSistema, esRutaInterna, leerMensajePortal, type BridgeWindow } from '@/features/portal/bridge'
import type { Aviso } from '@/features/portal/contract'

const PORTAL = 'http://localhost:5185'
const P = 'rb-puente/1'

function fakeWindow() {
  const sent: { message: unknown; origin: string }[] = []
  let listener: ((e: MessageEvent) => void) | null = null
  const parent = { postMessage: (message: unknown, origin: string) => void sent.push({ message, origin }) }
  const win: BridgeWindow = {
    parent,
    addEventListener: (_t, fn) => void (listener = fn),
    removeEventListener: (_t, fn) => void (listener === fn && (listener = null)),
  }
  const receive = (data: unknown, origin = PORTAL, source: unknown = parent) =>
    listener?.({ data, origin, source } as MessageEvent)
  return { win, sent, receive, listening: () => listener !== null }
}

function setup() {
  const w = fakeWindow()
  const calls = { bienvenida: vi.fn(), tema: vi.fn(), abrir: vi.fn(), salir: vi.fn() }
  const bridge = crearPuenteSistema({
    sistema: 'captacion',
    origenPortal: PORTAL,
    win: w.win,
    alBienvenida: calls.bienvenida,
    alTema: calls.tema,
    alAbrir: calls.abrir,
    alSalir: calls.salir,
  })
  return { ...w, calls, bridge }
}

const aviso = (n: number): Aviso => ({ id: `a${n}`, texto: `${n}`, sistema: 'captacion', fecha: '2026-11-16T08:00:00-04:00' })

beforeEach(() => void vi.useFakeTimers())
afterEach(() => void vi.useRealTimers())

describe('saludo', () => {
  it('envía listo solo al origen del portal', () => {
    const { sent } = setup()
    expect(sent).toEqual([{ message: { protocolo: P, tipo: 'listo', sistema: 'captacion' }, origin: PORTAL }])
  })

  it('entra en modo portal con bienvenida y aplica el tema', () => {
    const { receive, calls } = setup()
    receive({ protocolo: P, tipo: 'bienvenida', tema: 'oscuro' })
    expect(calls.bienvenida).toHaveBeenCalledWith('oscuro')
  })

  it('sin bienvenida en 3 s deja de escuchar (modo normal)', () => {
    const { receive, calls, listening } = setup()
    vi.advanceTimersByTime(3_000)
    expect(listening()).toBe(false)
    receive({ protocolo: P, tipo: 'bienvenida', tema: 'claro' })
    expect(calls.bienvenida).not.toHaveBeenCalled()
  })

  it('ignora otro origen, otra ventana y otro protocolo', () => {
    const { receive, calls } = setup()
    receive({ protocolo: P, tipo: 'bienvenida', tema: 'claro' }, 'http://malo.test')
    receive({ protocolo: P, tipo: 'bienvenida', tema: 'claro' }, PORTAL, {})
    receive({ protocolo: 'rb-puente/2', tipo: 'bienvenida', tema: 'claro' })
    expect(calls.bienvenida).not.toHaveBeenCalled()
  })

  it('antes de la bienvenida no atiende órdenes ni envía nada', () => {
    const { receive, calls, bridge, sent } = setup()
    receive({ protocolo: P, tipo: 'salir' })
    receive({ protocolo: P, tipo: 'abrir', ruta: '/panel' })
    bridge.enviarRuta('/panel')
    bridge.enviarAvisos([aviso(1)])
    bridge.avisarSesionCerrada()
    expect(calls.salir).not.toHaveBeenCalled()
    expect(calls.abrir).not.toHaveBeenCalled()
    expect(sent).toHaveLength(1) // solo listo
  })
})

describe('en modo portal', () => {
  function connected() {
    const s = setup()
    s.receive({ protocolo: P, tipo: 'bienvenida', tema: 'claro' })
    s.sent.length = 0
    return s
  }

  it('atiende tema, abrir y salir', () => {
    const { receive, calls } = connected()
    receive({ protocolo: P, tipo: 'tema', tema: 'oscuro' })
    receive({ protocolo: P, tipo: 'abrir', ruta: '/planificacion' })
    receive({ protocolo: P, tipo: 'abrir', ruta: 'https://malo.test' })
    receive({ protocolo: P, tipo: 'abrir', ruta: '//malo.test/x' })
    receive({ protocolo: P, tipo: 'salir' })
    expect(calls.tema).toHaveBeenCalledWith('oscuro')
    expect(calls.abrir).toHaveBeenCalledTimes(1)
    expect(calls.abrir).toHaveBeenCalledWith('/planificacion')
    expect(calls.salir).toHaveBeenCalledTimes(1)
  })

  it('una segunda bienvenida solo cambia el tema', () => {
    const { receive, calls } = connected()
    receive({ protocolo: P, tipo: 'bienvenida', tema: 'oscuro' })
    expect(calls.bienvenida).toHaveBeenCalledTimes(1)
    expect(calls.tema).toHaveBeenCalledWith('oscuro')
  })

  it('envía ruta solo cuando cambia y solo rutas internas', () => {
    const { bridge, sent } = connected()
    bridge.enviarRuta('/panel')
    bridge.enviarRuta('/panel')
    bridge.enviarRuta('//otro')
    bridge.enviarRuta('/gestion?periodo=hoy')
    expect(sent.map((s) => (s.message as { ruta: string }).ruta)).toEqual(['/panel', '/gestion?periodo=hoy'])
    expect(sent.every((s) => s.origin === PORTAL)).toBe(true)
  })

  it('avisos: máximo 1 cada 5 s, con la lista más nueva y sin repetir la misma', () => {
    const { bridge, sent } = connected()
    bridge.enviarAvisos([aviso(1)])
    expect(sent).toHaveLength(1)
    bridge.enviarAvisos([aviso(2)])
    bridge.enviarAvisos([aviso(3)])
    expect(sent).toHaveLength(1)
    vi.advanceTimersByTime(5_000)
    expect(sent).toHaveLength(2)
    expect((sent[1]!.message as { avisos: Aviso[] }).avisos).toEqual([aviso(3)])
    vi.advanceTimersByTime(10_000)
    bridge.enviarAvisos([aviso(3)])
    expect(sent).toHaveLength(2)
  })

  it('avisa sesión cerrada y deja de escuchar al detenerse', () => {
    const { bridge, sent, listening } = connected()
    bridge.avisarSesionCerrada()
    expect(sent[0]!.message).toEqual({ protocolo: P, tipo: 'sesion-cerrada', sistema: 'captacion' })
    bridge.detener()
    expect(listening()).toBe(false)
  })
})

describe('validación', () => {
  it('rutas internas', () => {
    expect(esRutaInterna('/')).toBe(true)
    expect(esRutaInterna('/cliente/1?x=1')).toBe(true)
    for (const bad of ['', 'panel', '//x', '/\\x', 'javascript:alert(1)', 3]) expect(esRutaInterna(bad)).toBe(false)
  })
  it('mensajes del portal', () => {
    expect(leerMensajePortal({ protocolo: P, tipo: 'tema', tema: 'auto' })).toBeNull()
    expect(leerMensajePortal({ protocolo: P, tipo: 'otro' })).toBeNull()
    expect(leerMensajePortal('salir')).toBeNull()
    expect(leerMensajePortal({ protocolo: P, tipo: 'salir', extra: 1 })).toEqual({ protocolo: P, tipo: 'salir' })
  })
})
