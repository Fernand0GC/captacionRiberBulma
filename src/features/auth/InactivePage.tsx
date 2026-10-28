import { Button } from '@/ui/Button'
import { useAuth } from './AuthProvider'

/** Usuario dado de baja (research R9). US1 agrega el vaciado del outbox antes de cerrar sesión. */
export function InactivePage({ pendingSlot }: { pendingSlot?: React.ReactNode }) {
  const { signOut } = useAuth()
  return (
    <main className="bg-ink-gradient flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center text-white">
      <img src="/logo-rb-96.webp" alt="" width={72} height={72} className="h-18 w-18 rounded-full" />
      <h1 className="font-display text-2xl font-semibold text-gold-light">Usuario desactivado</h1>
      <p className="max-w-xs text-white/70">Tu usuario ya no tiene acceso. Si crees que es un error, habla con tu encargado.</p>
      {pendingSlot}
      <Button variant="dark" className="ring-1 ring-gold/40" onClick={() => void signOut()}>
        Salir
      </Button>
    </main>
  )
}
