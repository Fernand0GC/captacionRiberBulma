import type { ReactNode } from 'react'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LogoutProvider } from '@/features/auth/logout'
import { ToastProvider } from '@/ui/Toast'

// React Query solo se carga en gestión/seguimiento (QueryProvider, lazy): el registro de campo no lo usa.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LogoutProvider>
        <ToastProvider>{children}</ToastProvider>
      </LogoutProvider>
    </AuthProvider>
  )
}
