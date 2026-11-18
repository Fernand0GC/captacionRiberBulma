// Edge Function cuenta-unica (contrato cuenta-unica v1, specs/002-cuenta-unica-portal).
// GET …/iniciar → cuenta única (OIDC, cliente confidencial) → GET …/callback → enlace de un solo uso → SPA.
// El secreto del cliente y la service role viven solo acá. verify_jwt = false (la llama un navegador sin sesión).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { parseCi } from '../_shared/ci.ts'
import {
  authorizeUrl,
  failureUrl,
  type Jwk,
  landingUrl,
  randomToken,
  readConfig,
  readCookie,
  safeEqual,
  STATE_COOKIE,
  stateCookie,
  type SsoConfig,
  type SsoReason,
  verifyIdToken,
} from './oidc.ts'

const SERVER_TIMEOUT_MS = 10_000

function redirect(location: string, cookie?: string): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
  if (cookie) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}

/** Falla: vuelve a la pantalla de ingreso con el motivo y borra la cookie. Solo el motivo, sin datos técnicos. */
function fail(c: SsoConfig, reason: SsoReason, detail?: unknown): Response {
  if (detail !== undefined) console.warn(`cuenta-unica: ${reason}`, detail instanceof Error ? detail.message : detail)
  return redirect(failureUrl(c, reason), stateCookie(c, '', 0))
}

function start(c: SsoConfig): Response {
  const state = randomToken()
  const nonce = randomToken()
  return redirect(authorizeUrl(c, state, nonce), stateCookie(c, `${state}.${nonce}`))
}

async function callback(c: SsoConfig, req: Request, url: URL): Promise<Response> {
  // 1. state: el de la URL debe ser el de la cookie (tiempo constante). Sin cookie = venció o es otro navegador.
  const [savedState, nonce] = (readCookie(req.headers.get('Cookie'), STATE_COOKIE) ?? '').split('.')
  const state = url.searchParams.get('state') ?? ''
  if (!savedState || !nonce || !safeEqual(state, savedState)) return fail(c, 'estado')
  const code = url.searchParams.get('code')
  if (!code) return fail(c, 'cuenta', url.searchParams.get('error') ?? 'sin code') // p. ej. canceló en la cuenta única

  // 2. Canje del código de servidor a servidor (client_secret_post) y validación del id_token.
  let idToken: string
  let keys: Jwk[]
  try {
    const tokenRes = await fetch(`${c.internalIssuer}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: c.redirectUri,
        client_id: c.clientId,
        client_secret: c.clientSecret,
      }),
      signal: AbortSignal.timeout(SERVER_TIMEOUT_MS),
    })
    if (!tokenRes.ok) return fail(c, 'cuenta', `token ${tokenRes.status}`)
    idToken = String(((await tokenRes.json()) as { id_token?: string }).id_token ?? '')
    const jwksRes = await fetch(`${c.internalIssuer}/protocol/openid-connect/certs`, {
      signal: AbortSignal.timeout(SERVER_TIMEOUT_MS),
    })
    if (!jwksRes.ok) return fail(c, 'cuenta', `certs ${jwksRes.status}`)
    keys = ((await jwksRes.json()) as { keys?: Jwk[] }).keys ?? []
  } catch (e) {
    return fail(c, 'cuenta', e)
  }
  const claims = await verifyIdToken(idToken, {
    keys,
    issuers: [...new Set([c.issuer, c.internalIssuer])],
    clientId: c.clientId,
    nonce,
  })
  if (!claims) return fail(c, 'cuenta', 'id_token inválido')

  // 3. El usuario de la cuenta única es el CI (7788990-1b → 7788990-1B). Solo perfiles activos; no se crea nadie.
  const ci = parseCi(claims.preferred_username ?? '')
  if (!ci) return fail(c, 'ci', 'preferred_username no es un CI')
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('id')
    .eq('ci', ci)
    .eq('active', true)
    .maybeSingle()
  if (pErr) return fail(c, 'sesion', pErr)
  if (!profile) return fail(c, 'sin-acceso')

  // 4. La misma sesión que el ingreso con clave: enlace mágico de un solo uso que la SPA canjea con verifyOtp.
  const { data: user, error: uErr } = await admin.auth.admin.getUserById(profile.id)
  const email = user?.user?.email
  if (uErr || !email) return fail(c, 'sesion', uErr ?? 'usuario sin email')
  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = link?.properties?.hashed_token
  if (lErr || !tokenHash) return fail(c, 'sesion', lErr ?? 'sin hashed_token')

  return redirect(landingUrl(c, tokenHash), stateCookie(c, '', 0))
}

Deno.serve(async (req) => {
  const config = readConfig((k) => Deno.env.get(k))
  const url = new URL(req.url)
  if (!config || req.method !== 'GET') return new Response('Not found', { status: 404 })
  if (url.pathname.endsWith('/iniciar')) return start(config)
  if (url.pathname.endsWith('/callback')) return await callback(config, req, url)
  return new Response('Not found', { status: 404 })
})
