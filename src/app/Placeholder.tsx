import { useAuth } from '@/features/auth/AuthProvider'
import { ROLE_LABEL } from '@/features/auth/types'
import { Button } from '@/ui/Button'

/** Pantalla temporal para rutas de historias aún no implementadas. */
export function Placeholder({ title = location.pathname }: { title?: string }) {
  const { profile, signOut } = useAuth()
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-ink/60">
        {profile?.full_name} · {profile && ROLE_LABEL[profile.role]} — en construcción.
      </p>
      <Button variant="secondary" onClick={() => void signOut()}>
        Salir
      </Button>
    </main>
  )
}
