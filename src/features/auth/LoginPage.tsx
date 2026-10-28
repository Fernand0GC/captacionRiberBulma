import { useState, type FormEvent } from 'react'
import { Navigate } from '@tanstack/react-router'
import { Button } from '@/ui/Button'
import { Field, TextInput } from '@/ui/Field'
import { useAuth } from './AuthProvider'
import { homePath } from './types'

export function LoginPage() {
  const { signIn, status, profile } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  if (status === 'ready' && profile) return <Navigate to={homePath(profile.role)} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(undefined)
    if (!navigator.onLine) {
      setError('Necesitas conexión para iniciar sesión la primera vez.')
      return
    }
    setBusy(true)
    try {
      await signIn(username, password)
    } catch {
      setError('Usuario o contraseña incorrectos.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="bg-ink-gradient flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <img src="/logo-rb-192.webp" alt="Riber Bulma" width={112} height={112} className="h-28 w-28 rounded-full shadow-gold" />
          <div>
            <h1 className="font-display text-3xl font-bold text-gold-light">Captación</h1>
            <p className="text-white/60">Ingresa con tu usuario</p>
          </div>
        </header>
        <form onSubmit={onSubmit} className="flex w-full flex-col gap-4 rounded-3xl bg-cream p-6 shadow-2xl" noValidate>
          <Field label="Usuario" required>
            {(id) => (
              <TextInput
                id={id}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            )}
          </Field>
          <Field label="Contraseña" required error={error}>
            {(id, describedBy) => (
              <TextInput
                id={id}
                type="password"
                autoComplete="current-password"
                aria-describedby={describedBy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            )}
          </Field>
          <Button type="submit" disabled={busy || !username || !password} className="mt-1 min-h-14 font-display text-lg">
            {busy ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
        <p className="text-xs text-white/35">Riber Bulma · Ventas</p>
      </div>
    </main>
  )
}
