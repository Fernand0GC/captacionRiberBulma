import { useState } from 'react'
import { discardPending, pendingCount } from '@/features/sync/sender'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useAuth } from './AuthProvider'

/** No deja cerrar sesión con captaciones sin subir, salvo descarte explícito con doble confirmación (contracts/sync.md). */
export function LogoutButton({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { profile, signOut } = useAuth()
  const [pending, setPending] = useState(0)
  const [step, setStep] = useState<0 | 1 | 2>(0)

  async function onClick() {
    const n = profile ? await pendingCount(profile.id) : 0
    if (n === 0) return void signOut()
    setPending(n)
    setStep(1)
  }

  async function discardAndExit() {
    if (profile) await discardPending(profile.id)
    setStep(0)
    await signOut()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void onClick()}
        className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${
          tone === 'dark' ? 'text-gold-light ring-1 ring-gold/40 active:bg-white/10' : 'text-ink/70 ring-1 ring-ink/15 active:bg-ink/5'
        }`}
      >
        Salir
      </button>
      <Dialog
        open={step === 1}
        onOpenChange={(o) => !o && setStep(0)}
        title={`Tienes ${pending} ${pending === 1 ? 'captación' : 'captaciones'} sin subir`}
        description="Conéctate a internet y espera a que se suban antes de salir."
      >
        <div className="flex flex-col gap-2">
          <Button onClick={() => setStep(0)}>Esperar</Button>
          <Button variant="danger" onClick={() => setStep(2)}>
            Salir y descartar
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={step === 2}
        onOpenChange={(o) => !o && setStep(0)}
        title="¿Descartar definitivamente?"
        description={`Se perderán ${pending} ${pending === 1 ? 'captación' : 'captaciones'}. Esto no se puede deshacer.`}
      >
        <div className="flex flex-col gap-2">
          <Button onClick={() => setStep(0)}>No, volver</Button>
          <Button variant="danger" onClick={() => void discardAndExit()}>
            Sí, descartar y salir
          </Button>
        </div>
      </Dialog>
    </>
  )
}
