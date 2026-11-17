import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { discardPending, pendingCount } from '@/features/sync/sender'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useAuth } from './AuthProvider'

type LogoutState = { requestLogout: () => Promise<void> }

const LogoutContext = createContext<LogoutState | null>(null)

/**
 * Flujo único de "Salir": no deja cerrar sesión con captaciones sin subir, salvo descarte explícito con doble
 * confirmación (contracts/sync.md). Lo usan el botón Salir y la orden `salir` del portal (mismo efecto, puente.md).
 */
export function LogoutProvider({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const [pending, setPending] = useState(0)
  const [step, setStep] = useState<0 | 1 | 2>(0)

  const requestLogout = useCallback(async () => {
    const n = profile ? await pendingCount(profile.id) : 0
    if (n === 0) return signOut()
    setPending(n)
    setStep(1)
  }, [profile, signOut])

  async function discardAndExit() {
    if (profile) await discardPending(profile.id)
    setStep(0)
    await signOut()
  }

  const plural = pending === 1 ? 'captación' : 'captaciones'
  return (
    <LogoutContext.Provider value={{ requestLogout }}>
      {children}
      <Dialog
        open={step === 1}
        onOpenChange={(o) => !o && setStep(0)}
        title={`Tienes ${pending} ${plural} sin subir`}
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
        description={`Se perderán ${pending} ${plural}. Esto no se puede deshacer.`}
      >
        <div className="flex flex-col gap-2">
          <Button onClick={() => setStep(0)}>No, volver</Button>
          <Button variant="danger" onClick={() => void discardAndExit()}>
            Sí, descartar y salir
          </Button>
        </div>
      </Dialog>
    </LogoutContext.Provider>
  )
}

export function useLogout(): LogoutState {
  const ctx = useContext(LogoutContext)
  if (!ctx) throw new Error('useLogout fuera de LogoutProvider')
  return ctx
}
