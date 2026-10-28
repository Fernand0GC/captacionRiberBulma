import type { ReactNode } from 'react'

/** Barra superior oscura con el logo RB dorado. */
export function BrandHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="bg-ink-gradient text-white">
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <img src="/logo-rb-96.webp" alt="Riber Bulma" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold leading-tight text-gold-light">{title}</p>
          {subtitle && <p className="truncate text-sm text-white/60">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}
