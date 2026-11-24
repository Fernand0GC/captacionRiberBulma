import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { ROLE_LABEL } from '@/features/auth/types'
import { pendingCount } from '@/features/sync/sender'
import { formatRemaining, remainingMs } from '@/lib/impersonation'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'

/**
 * Banda fija abajo de «Actuar como» (spec 027): siempre visible mientras Sistemas usa la app como otra persona.
 * A los 30 minutos vuelve sola a la cuenta propia.
 */
export function ImpersonationBanner() {
  const { impersonation, endImpersonation } = useAuth()
  const [left, setLeft] = useState(() => (impersonation ? remainingMs(impersonation) : 0))
  const [pending, setPending] = useState(0)

  useEffect(() => {
    if (!impersonation) return
    const tick = () => {
      const ms = remainingMs(impersonation)
      setLeft(ms)
      if (ms === 0) void endImpersonation()
    }
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [impersonation, endImpersonation])

  if (!impersonation) return null
  const { target } = impersonation

  // Sus captaciones sin subir quedan en este navegador y suben la próxima vez que se actúe como esa persona
  // (nunca con la identidad de Sistemas).
  async function requestReturn() {
    const n = await pendingCount(target.id)
    if (n === 0) return endImpersonation()
    setPending(n)
  }

  return (
    <>
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm font-semibold text-ink"
      >
        <span>
          Actuando como {target.full_name} ({ROLE_LABEL[target.role]}) · {formatRemaining(left)}
        </span>
        <button
          type="button"
          onClick={() => void requestReturn()}
          className="min-h-9 rounded-xl bg-ink px-3 text-gold-light"
        >
          Volver a mi cuenta
        </button>
      </div>
      <Dialog open={pending > 0} onOpenChange={(o) => !o && setPending(0)} title="Hay captaciones sin subir">
        <p className="text-sm text-ink/70">
          {pending} {pending === 1 ? 'captación' : 'captaciones'} de {target.full_name} todavía no se
          subieron. Si vuelves ahora quedan guardadas en este navegador y se suben la próxima vez que actúes
          como esta persona.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setPending(0)}>
            Esperar
          </Button>
          <Button className="flex-1" onClick={() => void endImpersonation()}>
            Volver igual
          </Button>
        </div>
      </Dialog>
    </>
  )
}
