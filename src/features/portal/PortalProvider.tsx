import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { useLogout } from '@/features/auth/logout'
import { FOLLOWUP_ROLES } from '@/features/auth/types'
import { crearPuenteSistema, type Bridge } from './bridge'
import { PortalModeContext } from './portalMode'

/** Origen exacto del portal; sin él (o fuera de un marco) la app se comporta como siempre y no envía nada. */
const PORTAL_ORIGIN = (import.meta.env.VITE_PORTAL_ORIGEN as string | undefined)?.trim().replace(/\/+$/, '')
const NOTICES_EVERY_MS = 60_000

/**
 * Modo portal (contracts/puente.md, specs/002-cuenta-unica-portal). Va en la ruta raíz para tener el router.
 * Tema: Captación tiene un solo aspecto, así que `tema` se recibe y se ignora (decisión documentada en la spec).
 */
export function PortalProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { status, profile } = useAuth()
  const { requestLogout } = useLogout()
  const [active, setActive] = useState(false)
  const bridge = useRef<Bridge | null>(null)
  // `salir` usa siempre el flujo de Salir vigente (depende del perfil) sin rehacer el saludo.
  const logout = useRef(requestLogout)
  useEffect(() => {
    logout.current = requestLogout
  }, [requestLogout])

  useEffect(() => {
    if (!PORTAL_ORIGIN || window.top === window.self) return
    const b = crearPuenteSistema({
      sistema: 'captacion',
      origenPortal: PORTAL_ORIGIN,
      win: window,
      alBienvenida: () => setActive(true),
      alTema: () => undefined,
      alAbrir: (ruta) => void router.navigate({ href: ruta }),
      alSalir: () => void logout.current(),
    })
    bridge.current = b
    return () => {
      b.detener()
      bridge.current = null
    }
  }, [router])

  // ruta: pantalla interna + filtros (no personales por diseño, prospects/search.ts); nunca el fragmento.
  const route = useRouterState({ select: (s) => `${s.location.pathname}${s.location.searchStr}` })
  useEffect(() => {
    if (active && !route.startsWith('/ingreso-unico')) bridge.current?.enviarRuta(route)
  }, [active, route])

  // sesion-cerrada: cuando la sesión pasa a cerrada (Salir, `salir` del portal o vencimiento).
  const prevStatus = useRef(status)
  useEffect(() => {
    const prev = prevStatus.current
    prevStatus.current = status
    if (active && status === 'anonymous' && (prev === 'ready' || prev === 'inactive')) bridge.current?.avisarSesionCerrada()
  }, [active, status])

  // avisos: Mis contactos que piden atención; para quien no tiene Mis contactos (o sin sesión), lista vacía.
  const followsUp = status === 'ready' && !!profile && FOLLOWUP_ROLES.includes(profile.role)
  useEffect(() => {
    if (!active) return
    if (!followsUp) return void bridge.current?.enviarAvisos([])
    let cancelled = false
    const refresh = async () => {
      const { loadNotices } = await import('./notices')
      const notices = await loadNotices()
      if (!cancelled && notices) bridge.current?.enviarAvisos(notices)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), NOTICES_EVERY_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, followsUp])

  return <PortalModeContext.Provider value={active}>{children}</PortalModeContext.Provider>
}
