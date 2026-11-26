import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/auth-js'
import {
  clearImpersonation,
  IMPERSONATION_KEY,
  readImpersonation,
  reloadApp,
  saveImpersonation,
  staleImpersonationId,
  type Impersonation,
  type ImpersonationTarget,
} from '@/lib/impersonation'
import { supabase, usernameToEmail } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { Profile } from './types'

type Status = 'loading' | 'anonymous' | 'ready' | 'inactive'

type AuthState = {
  status: Status
  session: Session | null
  profile: Profile | null
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  /** «Actuar como» (spec 027): con suplantación vigente, `profile` es el de la persona suplantada. */
  impersonation: Impersonation | null
  startImpersonation: (targetId: string) => Promise<void>
  endImpersonation: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// El perfil (rol, sucursal, nombre) se cachea para poder abrir /registrar sin señal.
const cacheKey = (uid: string) => `captacion.profile.${uid}`

function readCachedProfile(uid: string): Profile | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid))
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

async function fetchProfile(uid: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, username, full_name, role, branch_id, contract_type, active, deactivated_at, profile_branches(branch_id)',
    )
    .eq('id', uid)
    .maybeSingle()
  if (error) throw error
  const profile = data ? toProfile(data) : null
  if (profile) {
    try {
      localStorage.setItem(cacheKey(uid), JSON.stringify(profile))
    } catch {
      /* almacenamiento lleno o bloqueado: seguimos sin caché */
    }
  }
  return profile
}

/** La relación profile_branches llega anidada: se aplana a branch_ids (jefe de ventas). */
export function toProfile({
  profile_branches,
  ...p
}: Record<string, unknown> & { profile_branches?: { branch_id: number }[] }): Profile {
  return { ...(p as unknown as Profile), branch_ids: (profile_branches ?? []).map((b) => b.branch_id) }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [impersonation, setImpersonation] = useState<Impersonation | null>(null)

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null)
      setStatus('anonymous')
      return
    }
    // Una suplantación guardada que ya no vale (venció con la app cerrada, u otro admin en este navegador) se cierra
    // y se borra ANTES de cargar nada: si no, la cabecera haría rechazar cada consulta. Sin red, igual se borra
    // (la base ya no la acepta, y la próxima que se empiece la cierra como vencida).
    if (staleImpersonationId(s.user.id)) {
      if (navigator.onLine) await supabase.rpc('impersonation_end') // sin red no se espera: arranque offline al instante
      clearImpersonation()
    }
    // Actuando como otro, la app entera usa el perfil de esa persona (la base ya la ve como ella por la cabecera).
    const acting = readImpersonation(s.user.id)
    setImpersonation(acting)
    const uid = acting?.target.id ?? s.user.id
    const apply = (p: Profile | null) => {
      setProfile(p)
      setStatus(!p ? 'anonymous' : p.active ? 'ready' : 'inactive')
    }
    // Con perfil en caché la app abre al instante (sin señal o con WiFi sin internet, SC-004)
    // y se actualiza en segundo plano; sin caché hay que esperar al servidor.
    const cached = readCachedProfile(uid)
    if (cached) apply(cached)
    if (!navigator.onLine) {
      if (!cached) apply(null)
      return
    }
    try {
      const fresh = await fetchProfile(uid)
      if (fresh || !cached) apply(fresh)
    } catch {
      if (!cached) apply(null)
    }
  }, [])

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      await loadProfile(data.session)
    }
    void loadSession()
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void loadProfile(s)
    })
    // Otra pestaña empezó o terminó de actuar como alguien: esta se recarga para no mezclar identidades.
    const onStorage = (e: StorageEvent) => {
      if (e.key === IMPERSONATION_KEY) reloadApp()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener('storage', onStorage)
    }
  }, [loadProfile])

  const signIn = useCallback(async (username: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password })
    if (error) throw error
  }, [])

  // Volver a mi cuenta: se cierra en el servidor. La cabecera sale hasta el final, también vencida: la base deja pasar
  // solo /rpc/impersonation_end como el admin y rechaza cualquier otra consulta (auditoría 2026-11-24, H1).
  const endImpersonation = useCallback(async () => {
    await supabase.rpc('impersonation_end') // devuelve { error } sin lanzar: si falla, igual se vuelve
    clearImpersonation()
    reloadApp()
  }, [])

  const startImpersonation = useCallback(
    async (targetId: string) => {
      if (!session) return
      const { data, error } = await supabase.rpc('impersonation_start', { p_target: targetId })
      if (error) throw toAppError(error)
      const r = data as { id: string; expires_at: string; target: ImpersonationTarget }
      saveImpersonation({ id: r.id, actorId: session.user.id, expiresAt: r.expires_at, target: r.target })
      reloadApp()
    },
    [session],
  )

  const signOut = useCallback(async () => {
    if (impersonation) {
      await supabase.rpc('impersonation_end')
      clearImpersonation()
    }
    await supabase.auth.signOut({ scope: 'local' })
  }, [impersonation])

  const refreshProfile = useCallback(() => loadProfile(session), [loadProfile, session])

  return (
    <AuthContext.Provider
      value={{
        status,
        session,
        profile,
        signIn,
        signOut,
        refreshProfile,
        impersonation,
        startImpersonation,
        endImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}
