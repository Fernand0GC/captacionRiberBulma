import { Outlet } from '@tanstack/react-router'
import { QueryProvider } from './QueryProvider'

/** Outlet de las secciones con datos del servidor (gestión, seguimiento). Se carga lazy. */
export function ManagedOutlet() {
  return (
    <QueryProvider>
      <Outlet />
    </QueryProvider>
  )
}
