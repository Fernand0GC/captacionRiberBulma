import { AppError, toAppError } from './errors'
import { accessToken, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase'

/** Llama a la Edge Function admin-users (solo Sistemas). La service role nunca llega al navegador. */
export async function adminUsers<T = { id: string }>(body: Record<string, unknown>): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${await accessToken()}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    throw toAppError(e)
  }
  const data = (await res.json().catch(() => ({}))) as { code?: string; details?: { field?: string; reason?: string } }
  if (!res.ok) {
    const err = new AppError((data.code as AppError['code']) ?? 'unknown')
    ;(err as AppError & { details?: unknown }).details = data.details
    throw err
  }
  return data as T
}

/** Contraseña temporal legible (sin 0/O ni 1/l) para entregar al usuario. */
export function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return `Rb-${Array.from(bytes, (b) => chars[b % chars.length]).join('')}`
}
