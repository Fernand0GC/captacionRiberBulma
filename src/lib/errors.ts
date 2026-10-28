// code estable de las RPC (contracts/rpc.md) → mensaje en español.
export type RpcErrorCode =
  | 'forbidden'
  | 'invalid_input'
  | 'invalid_phone'
  | 'invalid_transition'
  | 'not_found'
  | 'rate_limited'

const MESSAGES: Record<RpcErrorCode, string> = {
  forbidden: 'No tienes permiso para esta acción.',
  invalid_input: 'Revisa los datos ingresados.',
  invalid_phone: 'El teléfono no es válido. Usa un celular de 8 dígitos (6 o 7…) o un fijo con código de área.',
  invalid_transition: 'Ese cambio de etapa no está permitido.',
  not_found: 'No se encontró el registro.',
  rate_limited: 'Demasiados intentos seguidos. Espera un momento.',
}

export class AppError extends Error {
  constructor(
    public code: RpcErrorCode | 'network' | 'unknown',
    message?: string,
  ) {
    super(message ?? (code in MESSAGES ? MESSAGES[code as RpcErrorCode] : 'Ocurrió un error. Intenta de nuevo.'))
  }
}

/** Las RPC lanzan `raise exception '<code>'` con errcode P0001; PostgREST lo devuelve en `message`. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  const e = err as { message?: string; code?: string; status?: number } | null
  const msg = e?.message ?? ''
  if (msg in MESSAGES) return new AppError(msg as RpcErrorCode)
  if (e?.code === '42501') return new AppError('forbidden')
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || e?.status === 0) return new AppError('network')
  return new AppError('unknown')
}

export function isTransient(err: AppError): boolean {
  return err.code === 'network' || err.code === 'rate_limited' || err.code === 'unknown'
}
