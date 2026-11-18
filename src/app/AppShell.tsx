import { lazy, Suspense, useState } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  MdDashboard,
  MdPeopleAlt,
  MdSwapHoriz,
  MdFlag,
  MdPhone,
  MdPersonAdd,
  MdManageAccounts,
  MdEventNote,
  MdCategory,
  MdGroups,
  MdListAlt,
  MdShare,
  MdFactCheck,
} from 'react-icons/md'
import { useAuth } from '@/features/auth/AuthProvider'
import { LogoutButton } from '@/features/auth/LogoutButton'
import { InstallCard } from '@/features/install/InstallCard'
import { usePortalMode } from '@/features/portal/portalMode'
import { CAPTURE_ROLES, FOLLOWUP_ROLES, GLOBAL_ROLES, MANAGER_ROLES, REFERRAL_ROLES, ROLE_LABEL, type AppRole } from '@/features/auth/types'
import { SyncRunner } from '@/features/sync/SyncRunner'

type NavItem = { to: string; label: string; icon: React.ReactNode; roles: AppRole[] }

// Una sola app para todos los roles: cada uno ve solo sus secciones. Gestión primero para quien gestiona;
// para el personal de campo, Mis contactos primero (si hace seguimiento) y luego Registrar.
const MANAGE_NAV: NavItem[] = [
  { to: '/panel', label: 'Panel', icon: <MdDashboard />, roles: MANAGER_ROLES },
  { to: '/gestion', label: 'Captaciones', icon: <MdPeopleAlt />, roles: MANAGER_ROLES },
  { to: '/repartir', label: 'Repartir', icon: <MdSwapHoriz />, roles: MANAGER_ROLES },
  { to: '/planificacion', label: 'Planificación', icon: <MdEventNote />, roles: MANAGER_ROLES },
  { to: '/metas', label: 'Metas', icon: <MdFlag />, roles: MANAGER_ROLES },
  { to: '/equipo', label: 'Mi equipo', icon: <MdGroups />, roles: MANAGER_ROLES },
  { to: '/referidos', label: 'Referidos', icon: <MdShare />, roles: REFERRAL_ROLES },
  { to: '/verificar-compartidas', label: 'Verificar compartidas', icon: <MdFactCheck />, roles: GLOBAL_ROLES },
  { to: '/seguimiento', label: 'Mis contactos', icon: <MdPhone />, roles: FOLLOWUP_ROLES },
  { to: '/registrar', label: 'Registrar', icon: <MdPersonAdd />, roles: CAPTURE_ROLES },
  { to: '/admin/usuarios', label: 'Usuarios', icon: <MdManageAccounts />, roles: ['admin'] },
  { to: '/admin/catalogo', label: 'Catálogo', icon: <MdCategory />, roles: ['admin'] },
]
const FIELD_NAV: NavItem[] = [
  { to: '/seguimiento', label: 'Mis contactos', icon: <MdPhone />, roles: FOLLOWUP_ROLES },
  { to: '/registrar', label: 'Registrar', icon: <MdPersonAdd />, roles: CAPTURE_ROLES },
  { to: '/mis-registros', label: 'Mis registros', icon: <MdListAlt />, roles: ['field_assistant'] },
  // Organización (spec 003): el supervisor la gestiona; el auxiliar ve solo lo suyo; la volantera no la ve.
  { to: '/planificacion', label: 'Planificación', icon: <MdEventNote />, roles: ['field_supervisor'] },
  { to: '/planificacion', label: 'Mi plan', icon: <MdEventNote />, roles: ['field_assistant'] },
  // Cobros (spec 006): solo esta pantalla.
  { to: '/verificar-compartidas', label: 'Verificar compartidas', icon: <MdFactCheck />, roles: ['collections'] },
]

// El contador de Mis contactos trae React Query: se carga aparte para no pesar en Registrar.
const LazyContactsBadge = lazy(() => import('@/features/followup/ContactsBadge').then((m) => ({ default: m.ContactsBadge })))
function ContactsBadge({ className }: { className: string }) {
  return (
    <Suspense fallback={null}>
      <LazyContactsBadge className={className} />
    </Suspense>
  )
}

function useNav(): NavItem[] {
  const { profile } = useAuth()
  if (!profile) return []
  const base = MANAGER_ROLES.includes(profile.role) ? MANAGE_NAV : FIELD_NAV
  return base.filter((n) => n.roles.includes(profile.role))
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const items = useNav()
  const path = useRouterState({ select: (s) => s.location.pathname })
  return (
    <nav aria-label="Secciones" className="flex flex-col gap-1">
      {items.map((n) => {
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
            <span aria-hidden className="w-5 text-center text-xl">
              {n.icon}
            </span>
            {n.label}
            {n.to === '/seguimiento' && <ContactsBadge className="ml-auto" />}
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

/**
 * Marco único de la app (responsive): barra lateral en escritorio; barra superior con menú ☰ en celular.
 * Va en el bundle inicial (sin React Query) para que /registrar abra sin señal.
 */
export function AppShell() {
  const { profile } = useAuth()
  // Dentro del portal su barra reemplaza la marca, la cuenta y Salir; las secciones de la app se quedan (puente.md).
  const portal = usePortalMode()
  const [open, setOpen] = useState(false)
  const items = useNav()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const current = items.find((n) => path === n.to || path.startsWith(`${n.to}/`))

  return (
    <div className="min-h-dvh lg:flex">
      {/* El envío de captaciones pendientes sigue activo en cualquier sección (p. ej. la auxiliar en Mis contactos). */}
      {profile && CAPTURE_ROLES.includes(profile.role) && <SyncRunner />}

      <aside className="bg-ink-gradient sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between p-4 lg:flex">
        <div className="flex flex-col gap-6">
          {!portal && <Brand />}
          <NavLinks />
        </div>
        {!portal && <UserCard />}
      </aside>

      <header className="bg-ink-gradient sticky top-0 z-30 flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          {!portal && (
            <img src="/logo-rb-96.webp" alt="Riber Bulma" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full" />
          )}
          <p className="truncate font-display text-lg font-semibold text-gold-light">{current?.label ?? 'Captación'}</p>
        </div>
        <button
          type="button"
          aria-label="Abrir menú"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl text-gold-light ring-1 ring-gold/40 active:bg-white/10"
        >
          ☰
          {profile && FOLLOWUP_ROLES.includes(profile.role) && <ContactsBadge className="absolute -right-1 -top-1" />}
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} />
          <div className="bg-ink-gradient absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col justify-between gap-4 overflow-y-auto p-4">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                {portal ? <span /> : <Brand />}
                <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="h-10 w-10 text-xl text-white/70">
                  ✕
                </button>
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            {!portal && (
              <div className="flex flex-col gap-3">
                <InstallCard />
                <UserCard />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
