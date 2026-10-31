import type { ReactNode } from 'react'

/** Título de sección dentro de la app (con acciones a la derecha). */
export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {/* En celular el nombre de la sección ya está en la barra superior: el título queda solo para lectores de pantalla. */}
        <h1 className="sr-only font-display text-2xl font-semibold text-ink lg:not-sr-only lg:text-3xl">{title}</h1>
        {subtitle && <p className="text-ink/55">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
