import { useState, type ReactNode } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { LogoutButton } from '@/features/auth/LogoutButton'
import { CAPTURE_ROLES, ROLE_LABEL, type AppRole } from '@/features/auth/types'
import { QueryProvider } from './QueryProvider'

type NavItem = { to: string; label: string; icon: string; roles: AppRole[] }

// Solo secciones ya construidas; las demás (seguimiento, agenda, metas, exportar) se suman al estar listas.
const NAV: NavItem[] = [
  { to: '/gestion', label: 'Captaciones', icon: '▤', roles: ['branch_manager', 'general_manager', 'admin'] },
  { to: '/registrar', label: 'Registrar', icon: '＋', roles: CAPTURE_ROLES },
  { to: '/admin/usuarios', label: 'Usuarios', icon: '◎', roles: ['admin'] },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { profile } = useAuth()
  const path = useRouterState({ select: (s) => s.location.pathname })
  return (
    <nav aria-label="Secciones" className="flex flex-col gap-1">
      {NAV.filter((n) => profile && n.roles.includes(profile.role)).map((n) => {
        const active = path === n.to || path.startsWith(`${n.to}/`)
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition ${
              active ? 'bg-gold-gradient text-ink shadow-gold' : 'text-white/75 hover:bg-white/5 active:bg-white/10'
            }`}
          >
            <span aria-hidden className="w-5 text-center text-lg">
              {n.icon}
            </span>
            {n.label}
          </Link>
        )
      })}
    </nav>
  )
}

function UserCard() {
  const { profile } = useAuth()
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{profile?.full_name}</p>
        <p className="truncate text-xs text-white/50">{profile && ROLE_LABEL[profile.role]}</p>
      </div>
      <LogoutButton tone="dark" />
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src="/logo-rb-96.webp" alt="Riber Bulma" width={40} height={40} className="h-10 w-10 rounded-full" />
      <div>
        <p className="font-display text-lg font-semibold leading-tight text-gold-light">Captación</p>
        <p className="text-xs text-white/45">Riber Bulma</p>
      </div>
    </div>
  )
}

/** Barra lateral en escritorio; barra superior con menú ☰ en celular. */
export function ManageLayout({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <QueryProvider>
      <div className="min-h-dvh lg:flex">
        <aside className="bg-ink-gradient sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between p-4 lg:flex">
          <div className="flex flex-col gap-6">
            <Brand />
            <NavLinks />
          </div>
          <UserCard />
        </aside>

        <header className="bg-ink-gradient sticky top-0 z-30 flex items-center justify-between px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
          <Brand />
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-gold-light ring-1 ring-gold/40 active:bg-white/10"
          >
            ☰
          </button>
        </header>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
            <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} />
            <div className="bg-ink-gradient animate-pop absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col justify-between p-4">
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <Brand />
                  <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="h-10 w-10 text-xl text-white/70">
                    ✕
                  </button>
                </div>
                <NavLinks onNavigate={() => setOpen(false)} />
              </div>
              <UserCard />
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">{children ?? <Outlet />}</div>
      </div>
    </QueryProvider>
  )
}

/** Título de página dentro del layout de gestión. */
export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="text-ink/55">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
