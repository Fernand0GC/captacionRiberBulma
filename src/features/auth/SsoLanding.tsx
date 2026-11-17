import { useEffect, useRef, useState } from 'react'
import { Navigate } from '@tanstack/react-router'
import { FullScreenMessage } from '@/app/guards'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'
import { readTokenHash } from './sso'
import { homePath } from './types'

/**
 * /ingreso-unico#token_hash=… — vuelta de la cuenta única (Edge Function cuenta-unica).
 * Canjea el enlace de un solo uso por la misma sesión que el ingreso con clave y va al inicio del rol.
 */
export function SsoLanding() {
  const { status, profile } = useAuth()
  const [state, setState] = useState<'verifying' | 'done' | 'failed'>('verifying')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return // StrictMode corre el efecto dos veces; el enlace sirve una sola vez
    started.current = true
    const tokenHash = readTokenHash(location.hash)
    // Fuera de la barra de direcciones y del historial en cuanto se lee.
    history.replaceState(history.state, '', location.pathname)
    const verify = async () => {
      if (!tokenHash) return setState('failed')
      const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
      setState(error ? 'failed' : 'done')
    }
    void verify()
  }, [])

  if (state === 'failed') return <Navigate to="/login" search={{ sso: 'sesion' }} replace />
  if (state === 'done' && status === 'ready' && profile) return <Navigate to={homePath(profile.role)} replace />
  if (state === 'done' && status === 'inactive') return <Navigate to="/" replace />
  return <FullScreenMessage text="Ingresando…" />
}
