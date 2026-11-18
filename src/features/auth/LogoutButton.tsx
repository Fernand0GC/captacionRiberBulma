import { useLogout } from './logout'

/** Botón Salir; el aviso de captaciones sin subir lo maneja LogoutProvider. */
export function LogoutButton({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { requestLogout } = useLogout()
  return (
    <button
      type="button"
      onClick={() => void requestLogout()}
      className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${
        tone === 'dark' ? 'text-gold-light ring-1 ring-gold/40 active:bg-white/10' : 'text-ink/70 ring-1 ring-ink/15 active:bg-ink/5'
      }`}
    >
      Salir
    </button>
  )
}
