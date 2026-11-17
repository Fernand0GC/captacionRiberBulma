import { beforeAll, describe, expect, it } from 'vitest'
import {
  authorizeUrl,
  failureUrl,
  type Jwk,
  landingUrl,
  randomToken,
  readConfig,
  readCookie,
  safeEqual,
  stateCookie,
  verifyIdToken,
} from '../../supabase/functions/cuenta-unica/oidc'

const env: Record<string, string> = {
  SSO_EMISOR: 'http://localhost:8080/realms/riberbulma/',
  SSO_EMISOR_INTERNO: 'http://host.docker.internal:8080/realms/riberbulma',
  SSO_CLIENTE: 'captacion',
  SSO_SECRETO: 'secreto',
  SSO_REDIRECCION: 'http://localhost:56321/functions/v1/cuenta-unica/callback',
  APP_URL: 'http://localhost:5180/',
}
const config = readConfig((k) => env[k])!

const b64 = (s: string | Uint8Array) => {
  const bytes = typeof s === 'string' ? new TextEncoder().encode(s) : s
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let keys: Jwk[]
let privateKey: CryptoKey

async function sign(claims: Record<string, unknown>, kid = 'k1'): Promise<string> {
  const h = b64(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }))
  const p = b64(JSON.stringify(claims))
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${h}.${p}`))
  return `${h}.${p}.${b64(new Uint8Array(sig))}`
}

const NOW = 1_800_000_000
const good = {
  iss: 'http://host.docker.internal:8080/realms/riberbulma',
  aud: 'captacion',
  azp: 'captacion',
  exp: NOW + 300,
  nonce: 'n-1',
  preferred_username: '7788990-1b',
}
const opts = () => ({ keys, issuers: [config.issuer, config.internalIssuer], clientId: 'captacion', nonce: 'n-1', now: NOW })

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
  privateKey = pair.privateKey
  keys = [{ ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' }]
})

describe('configuración', () => {
  it('sin SSO_EMISOR la cuenta única está apagada', () => {
    expect(readConfig((k) => (k === 'SSO_EMISOR' ? undefined : env[k]))).toBeNull()
  })
  it('quita la barra final y usa el emisor público si no hay interno', () => {
    expect(config.issuer).toBe('http://localhost:8080/realms/riberbulma')
    expect(config.appUrl).toBe('http://localhost:5180')
    expect(readConfig((k) => (k === 'SSO_EMISOR_INTERNO' ? undefined : env[k]))!.internalIssuer).toBe(config.issuer)
  })
})

describe('inicio', () => {
  it('arma la URL de autorización del contrato', () => {
    const u = new URL(authorizeUrl(config, 'st', 'no'))
    expect(u.origin + u.pathname).toBe('http://localhost:8080/realms/riberbulma/protocol/openid-connect/auth')
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: 'captacion',
      response_type: 'code',
      scope: 'openid',
      redirect_uri: env.SSO_REDIRECCION,
      state: 'st',
      nonce: 'no',
    })
  })
  it('state de 32 bytes, distinto cada vez', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(randomToken()).not.toBe(randomToken())
  })
  it('cookie HttpOnly, Lax, 10 min, en la ruta de la función; Secure con https', () => {
    expect(stateCookie(config, 'a.b')).toBe('cu_estado=a.b; Path=/functions/v1/cuenta-unica; Max-Age=600; HttpOnly; SameSite=Lax')
    const https = { ...config, redirectUri: 'https://x.supabase.co/functions/v1/cuenta-unica/callback' }
    expect(stateCookie(https, '', 0)).toMatch(/Max-Age=0; HttpOnly; SameSite=Lax; Secure$/)
  })
  it('lee la cookie entre otras', () => {
    expect(readCookie('x=1; cu_estado=a.b; y=2', 'cu_estado')).toBe('a.b')
    expect(readCookie(null, 'cu_estado')).toBeNull()
  })
  it('compara en tiempo constante', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('id_token', () => {
  it('acepta un token válido con el emisor interno o el público', async () => {
    expect((await verifyIdToken(await sign(good), opts()))?.preferred_username).toBe('7788990-1b')
    expect(await verifyIdToken(await sign({ ...good, iss: config.issuer }), opts())).not.toBeNull()
  })
  it('rechaza firma, emisor, audiencia, vencimiento y nonce incorrectos', async () => {
    const t = await sign(good)
    const [h, p] = t.split('.')
    const forged = `${h}.${b64(JSON.stringify({ ...good, preferred_username: '1111111' }))}.${t.split('.')[2]}`
    expect(p).toBeTruthy()
    expect(await verifyIdToken(forged, opts())).toBeNull()
    expect(await verifyIdToken(await sign(good, 'otra'), opts())).toBeNull()
    expect(await verifyIdToken(await sign({ ...good, iss: 'http://malo' }), opts())).toBeNull()
    expect(await verifyIdToken(await sign({ ...good, aud: 'cobros' }), opts())).toBeNull()
    expect(await verifyIdToken(await sign({ ...good, aud: ['cobros', 'captacion'], azp: 'cobros' }), opts())).toBeNull()
    expect(await verifyIdToken(await sign({ ...good, exp: NOW - 60 }), opts())).toBeNull()
    expect(await verifyIdToken(await sign({ ...good, nonce: 'otro' }), opts())).toBeNull()
    expect(await verifyIdToken('no.es.jwt', opts())).toBeNull()
  })
})

describe('retorno a la SPA', () => {
  it('falla con el motivo y éxito con el token en el fragmento', () => {
    expect(failureUrl(config, 'sin-acceso')).toBe('http://localhost:5180/login?sso=sin-acceso')
    expect(landingUrl(config, 'abc+/=')).toBe('http://localhost:5180/ingreso-unico#token_hash=abc%2B%2F%3D')
  })
})
