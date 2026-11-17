// Ingreso con la cuenta única, lado SPA (specs/002-cuenta-unica-portal). Lógica pura: sin red ni React.

/** Motivos que devuelve la función cuenta-unica en /login?sso=<motivo> (contrato cuenta-unica v1). */
export const SSO_MESSAGES = {
  estado: 'El ingreso con la cuenta única se interrumpió o tardó demasiado. Vuelve a intentarlo.',
  cuenta: 'No se pudo confirmar tu cuenta única. Vuelve a intentarlo.',
  ci: 'Tu cuenta única no tiene un CI válido. Pide ayuda a Sistemas.',
  'sin-acceso': 'Tu cuenta única no tiene acceso a Captación. Pide a Sistemas que registre tu CI en tu usuario.',
  sesion: 'No se pudo abrir tu sesión. Vuelve a intentarlo.',
} as const

export type SsoReason = keyof typeof SSO_MESSAGES

/** Mensaje para el motivo recibido; nada si no es uno conocido (no se muestra texto que venga en la URL). */
export function ssoMessage(reason: unknown): string | undefined {
  return typeof reason === 'string' && Object.hasOwn(SSO_MESSAGES, reason) ? SSO_MESSAGES[reason as SsoReason] : undefined
}

/** `#token_hash=…` que deja la función al volver: el enlace de un solo uso para abrir la sesión. */
export function readTokenHash(hash: string): string | null {
  const v = new URLSearchParams(hash.replace(/^#/, '')).get('token_hash')
  return v && /^[A-Za-z0-9_-]{8,256}$/.test(v) ? v : null
}

/** El botón aparece solo con la cuenta única configurada (VITE_CUENTA_UNICA=true). */
export const ssoEnabled = (flag: unknown) => flag === 'true'
