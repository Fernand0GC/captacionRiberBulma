import { AuthClient } from '@supabase/auth-js'
import { PostgrestClient } from '@supabase/postgrest-js'
import {
  clearImpersonation,
  IMPERSONATION_HEADER,
  impersonationHeader,
  isImpersonationInvalid,
  reloadApp,
} from './impersonation'

// Solo auth + rest (sin realtime/storage/functions de supabase-js): ~20 KB menos en el bundle inicial
// (constitución II). La API usada (`auth`, `from`, `rpc`) es la misma de supabase-js.
// `__HOST__` (modo LAN de desarrollo) = el host con el que se abrió la app, para probar desde el celular
// sin depender de la IP de la red. `__ORIGIN__` (modo túnel) = la misma dirección de la app; Vite hace de proxy.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  ?.replace('__ORIGIN__', location.origin)
  .replace('__HOST__', location.hostname)
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Corta cualquier consulta a los 8 s: con WiFi sin internet la app no puede quedar esperando (constitución I). */
const REQUEST_TIMEOUT_MS = 8_000
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) })

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (ver .env.example)')
}

export const SUPABASE_URL = url
export const SUPABASE_ANON_KEY = anonKey

const auth = new AuthClient({
  url: `${url}/auth/v1`,
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  storageKey: 'captacion-auth',
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: false,
  fetch: fetchWithTimeout,
})

/** Token vigente (refrescado si hace falta) o la anon key si no hay sesión. */
export async function accessToken(): Promise<string> {
  const { data } = await auth.getSession()
  return data.session?.access_token ?? anonKey!
}

const rest = new PostgrestClient(`${url}/rest/v1`, {
  headers: { apikey: anonKey },
  // Sin reintentos automáticos: sin red tardaban ~7 s en fallar y bloqueaban el arranque offline.
  // Los reintentos de captaciones los maneja el outbox (contracts/sync.md).
  retry: false,
  fetch: async (input, init) => {
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${await accessToken()}`)
    // «Actuar como» (spec 027): la base valida la cabecera; si la rechaza (vencida o cerrada), se vuelve a la propia cuenta.
    const acting = impersonationHeader()
    if (acting) headers.set(IMPERSONATION_HEADER, acting)
    const res = await fetchWithTimeout(input, { ...init, headers })
    if (acting && !res.ok && isImpersonationInvalid(await res.clone().text())) {
      clearImpersonation()
      reloadApp()
    }
    return res
  },
})

export const supabase = {
  auth,
  from: rest.from.bind(rest),
  rpc: rest.rpc.bind(rest),
}

/** Dominio sintético: el personal entra con usuario, sin email (research R7). */
export const USERNAME_DOMAIN = 'captacion.riberbulma.local'

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`
}
