// Piezas puras del ingreso con la cuenta única (contrato cuenta-unica v1, specs/002-cuenta-unica-portal).
// Sin APIs de Deno ni imports: las usa index.ts (Deno) y las prueba Vitest (Node) con WebCrypto.

export type SsoConfig = {
  /** Emisor público: el navegador va ahí y es el `iss` esperado. */
  issuer: string
  /** Emisor para llamadas de servidor a servidor (desde Docker `localhost` no es Keycloak). */
  internalIssuer: string
  clientId: string
  clientSecret: string
  /** `redirect_uri` registrado en la cuenta única: la URL pública de …/cuenta-unica/callback. */
  redirectUri: string
  /** Origen de la SPA (a dónde vuelve el navegador). */
  appUrl: string
}

/** Motivos de falla del contrato: la SPA los muestra en /login?sso=<motivo>. */
export type SsoReason = 'estado' | 'cuenta' | 'ci' | 'sin-acceso' | 'sesion'

export const STATE_COOKIE = 'cu_estado'
export const STATE_MAX_AGE = 600

const trimSlash = (s: string) => s.replace(/\/+$/, '')

/** Sin SSO_EMISOR la cuenta única está apagada (las rutas responden 404). Faltando otra variable, también. */
export function readConfig(env: (key: string) => string | undefined): SsoConfig | null {
  const issuer = env('SSO_EMISOR')?.trim()
  const clientId = env('SSO_CLIENTE')?.trim()
  const clientSecret = env('SSO_SECRETO')?.trim()
  const redirectUri = env('SSO_REDIRECCION')?.trim()
  const appUrl = env('APP_URL')?.trim()
  if (!issuer || !clientId || !clientSecret || !redirectUri || !appUrl) return null
  return {
    issuer: trimSlash(issuer),
    internalIssuer: trimSlash(env('SSO_EMISOR_INTERNO')?.trim() || issuer),
    clientId,
    clientSecret,
    redirectUri,
    appUrl: trimSlash(appUrl),
  }
}

const b64url = (bytes: Uint8Array) => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** 32 bytes aleatorios en base64url (el contrato pide ≥ 32 para `state`). */
export const randomToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)))

export function authorizeUrl(c: SsoConfig, state: string, nonce: string): string {
  const q = new URLSearchParams({
    client_id: c.clientId,
    response_type: 'code',
    scope: 'openid',
    redirect_uri: c.redirectUri,
    state,
    nonce,
  })
  return `${c.issuer}/protocol/openid-connect/auth?${q}`
}

/** La cookie vive solo en la ruta de la función y solo 10 min. `Secure` si la callback es https. */
export function stateCookie(c: SsoConfig, value: string, maxAge = STATE_MAX_AGE): string {
  const url = new URL(c.redirectUri)
  const path = url.pathname.replace(/\/callback\/?$/, '') || '/'
  const secure = url.protocol === 'https:' ? '; Secure' : ''
  return `${STATE_COOKIE}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`
}

export function readCookie(header: string | null, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

/** Comparación en tiempo constante (no corta en el primer carácter distinto). */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

export type IdTokenClaims = {
  iss: string
  aud: string | string[]
  azp?: string
  exp: number
  nonce?: string
  preferred_username?: string
}

export type Jwk = JsonWebKey & { kid?: string }

/**
 * Valida el id_token recibido de servidor a servidor: firma RS256 con el JWKS del emisor, `iss` (público o interno),
 * `aud`/`azp` = cliente, `exp` vigente (30 s de tolerancia) y `nonce`. Devuelve los claims o null.
 */
export async function verifyIdToken(
  token: string,
  opts: { keys: Jwk[]; issuers: string[]; clientId: string; nonce: string; now?: number },
): Promise<IdTokenClaims | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, s] = parts as [string, string, string]
  let header: { alg?: string; kid?: string }
  let claims: IdTokenClaims
  try {
    header = JSON.parse(new TextDecoder().decode(fromB64url(h)))
    claims = JSON.parse(new TextDecoder().decode(fromB64url(p)))
  } catch {
    return null
  }
  if (header.alg !== 'RS256') return null
  const jwk = opts.keys.find((k) => k.kid === header.kid && (k.kty === 'RSA'))
  if (!jwk) return null
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64url(s), new TextEncoder().encode(`${h}.${p}`))
  if (!ok) return null

  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!opts.issuers.includes(claims.iss)) return null
  if (!aud.includes(opts.clientId)) return null
  if (aud.length > 1 && claims.azp !== opts.clientId) return null
  if (typeof claims.exp !== 'number' || claims.exp + 30 < now) return null
  if (!claims.nonce || !safeEqual(claims.nonce, opts.nonce)) return null
  return claims
}

export const failureUrl = (c: SsoConfig, reason: SsoReason) => `${c.appUrl}/login?sso=${reason}`

/** El token va en el fragmento: el navegador no lo manda a ningún servidor ni queda en logs. */
export const landingUrl = (c: SsoConfig, tokenHash: string) =>
  `${c.appUrl}/ingreso-unico#token_hash=${encodeURIComponent(tokenHash)}`
