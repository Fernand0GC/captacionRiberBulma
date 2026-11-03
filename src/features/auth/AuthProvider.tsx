import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/auth-js'
import { supabase, usernameToEmail } from '@/lib/supabase'
import type { Profile } from './types'

type Status = 'loading' | 'anonymous' | 'ready' | 'inactive'

type AuthState = {
  status: Status
  session: Session | null
  profile: Profile | null
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
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
    .select('id, username, full_name, role, branch_id, contract_type, active, deactivated_at, profile_branches(branch_id)')
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
export function toProfile({ profile_branches, ...p }: Record<string, unknown> & { profile_branches?: { branch_id: number }[] }): Profile {
  return { ...(p as unknown as Profile), branch_ids: (profile_branches ?? []).map((b) => b.branch_id) }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null)
      setStatus('anonymous')
      return
    }
    const apply = (p: Profile | null) => {
      setProfile(p)
      setStatus(!p ? 'anonymous' : p.active ? 'ready' : 'inactive')
    }
    // Con perfil en caché la app abre al instante (sin señal o con WiFi sin internet, SC-004)
    // y se actualiza en segundo plano; sin caché hay que esperar al servidor.
    const cached = readCachedProfile(s.user.id)
    if (cached) apply(cached)
    if (!navigator.onLine) {
      if (!cached) apply(null)
      return
    }
    try {
      const fresh = await fetchProfile(s.user.id)
      if (fresh || !cached) apply(fresh)
    } catch {
      if (!cached) apply(null)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      void loadProfile(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void loadProfile(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const signIn = useCallback(async (username: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' })
  }, [])

  const refreshProfile = useCallback(() => loadProfile(session), [loadProfile, session])

  return (
    <AuthContext.Provider value={{ status, session, profile, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}
