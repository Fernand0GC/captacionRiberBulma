import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Outlet } from '@tanstack/react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { SsoLanding } from '@/features/auth/SsoLanding'
import {
  CAPTURE_ROLES,
  FOLLOWUP_ROLES,
  MANAGER_ROLES,
  ORG_VIEW_ROLES,
  REFERRAL_ROLES,
  ROLE_LABEL,
  VERIFY_SHARES_ROLES,
  type AppRole,
} from '@/features/auth/types'
import { CaptureForm } from '@/features/capture/CaptureForm'
import { RegisterHome } from '@/features/capture/RegisterHome'
import { PortalProvider } from '@/features/portal/PortalProvider'
import { validateManageSearch } from '@/features/prospects/search'
import { validateReferralSearch } from '@/features/referrals/search'
import { AppShell } from './AppShell'
import { HomeRedirect, RequireRole } from './guards'

// Bundle inicial: login, marco de la app y registro de campo. Lo demás se carga lazy (constitución II, research R2).
const ALL_ROLES = Object.keys(ROLE_LABEL) as AppRole[]
const ManagedOutlet = lazyRouteComponent(() => import('./ManagedOutlet'), 'ManagedOutlet')

// Ruta raíz: el puente con el portal vive acá porque necesita el router (abrir, ruta).
const rootRoute = createRootRoute({
  component: () => (
    <PortalProvider>
      <Outlet />
    </PortalProvider>
  ),
})
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomeRedirect })
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  // ?sso=<motivo>: falla del ingreso con la cuenta única (specs/002-cuenta-unica-portal).
  validateSearch: (s: Record<string, unknown>): { sso?: string } => (typeof s.sso === 'string' ? { sso: s.sso } : {}),
  component: LoginPage,
})
const ssoLandingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ingreso-unico', component: SsoLanding })

// Marco único (barra lateral / barra superior) para todas las secciones.
const shellLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: () => (
    <RequireRole roles={ALL_ROLES}>
      <AppShell />
    </RequireRole>
  ),
})

const captureLayout = createRoute({
  getParentRoute: () => shellLayout,
  id: 'capture',
  component: () => (
    <RequireRole roles={CAPTURE_ROLES}>
      <Outlet />
    </RequireRole>
  ),
})
const registerRoute = createRoute({ getParentRoute: () => captureLayout, path: '/registrar', component: RegisterHome })
const registerNewRoute = createRoute({ getParentRoute: () => captureLayout, path: '/registrar/nuevo', component: CaptureForm })

const followupLayout = createRoute({
  getParentRoute: () => shellLayout,
  id: 'followup',
  component: () => (
    <RequireRole roles={FOLLOWUP_ROLES}>
      <ManagedOutlet />
    </RequireRole>
  ),
})
// Mis registros: la auxiliar ve solo lo que ella registró.
const mineLayout = createRoute({
  getParentRoute: () => shellLayout,
  id: 'mine',
  component: () => (
    <RequireRole roles={['field_assistant']}>
      <ManagedOutlet />
    </RequireRole>
  ),
})
const mineRoute = createRoute({
  getParentRoute: () => mineLayout,
  path: '/mis-registros',
  component: lazyRouteComponent(() => import('@/features/mine/MyCapturesPage'), 'MyCapturesPage'),
})

const followupRoute = createRoute({
  getParentRoute: () => followupLayout,
  path: '/seguimiento',
  component: lazyRouteComponent(() => import('@/features/followup/InboxPage'), 'InboxPage'),
})

// Ficha del cliente: gestores del alcance y el responsable asignado (el servidor decide qué ve cada uno).
const clientLayout = createRoute({
  getParentRoute: () => shellLayout,
  id: 'client',
  component: () => (
    <RequireRole roles={[...new Set([...MANAGER_ROLES, ...FOLLOWUP_ROLES])]}>
      <ManagedOutlet />
    </RequireRole>
  ),
})
const clientRoute = createRoute({
  getParentRoute: () => clientLayout,
  path: '/cliente/$id',
  component: lazyRouteComponent(() => import('@/features/client/ClientPage'), 'ClientPage'),
})

// Planificación = organización comercial (spec 003). La ven todos menos la volantera; el auxiliar, solo lo suyo.
// Qué puede cargar cada uno lo decide el servidor. La planificación anterior queda en /planificacion/historial.
const planningLayout = createRoute({
  getParentRoute: () => shellLayout,
  id: 'planning',
  component: () => (
    <RequireRole roles={ORG_VIEW_ROLES}>
      <ManagedOutlet />
    </RequireRole>
  ),
})
const planningRoute = createRoute({
  getParentRoute: () => planningLayout,
  path: '/planificacion',
  component: lazyRouteComponent(() => import('@/features/organization/OrganizationPage'), 'OrganizationPage'),
})
const planningHistoryRoute = createRoute({
  getParentRoute: () => planningLayout,
  path: '/planificacion/historial',
  component: lazyRouteComponent(() => import('@/features/agenda/PlanningPage'), 'PlanningPage'),
})

// Verificar compartidas (spec 006): Cobros (sus sucursales), gerencia y Sistemas. La base lo exige (can_verify_shares).
const verifyLayout = createRoute({
  getParentRoute: () => shellLayout,
  id: 'verify',
  component: () => (
    <RequireRole roles={VERIFY_SHARES_ROLES}>
      <ManagedOutlet />
    </RequireRole>
  ),
})
const verifySharesRoute = createRoute({
  getParentRoute: () => verifyLayout,
  path: '/verificar-compartidas',
  component: lazyRouteComponent(() => import('@/features/verification/VerifySharesPage'), 'VerifySharesPage'),
})

const manageLayout = createRoute({
  getParentRoute: () => shellLayout,
  id: 'manage',
  component: () => (
    <RequireRole roles={MANAGER_ROLES}>
      <ManagedOutlet />
    </RequireRole>
  ),
})
const manageRoute = createRoute({
  getParentRoute: () => manageLayout,
  path: '/gestion',
  validateSearch: validateManageSearch,
  component: lazyRouteComponent(() => import('@/features/prospects/ProspectsPage'), 'ProspectsPage'),
})

const dashboardRoute = createRoute({
  getParentRoute: () => manageLayout,
  path: '/panel',
  component: lazyRouteComponent(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage'),
})

const goalsRoute = createRoute({
  getParentRoute: () => manageLayout,
  path: '/metas',
  component: lazyRouteComponent(() => import('@/features/goals/GoalsPage'), 'GoalsPage'),
})

const distributeRoute = createRoute({
  getParentRoute: () => manageLayout,
  path: '/repartir',
  component: lazyRouteComponent(() => import('@/features/distribution/DistributePage'), 'DistributePage'),
})

// Mi equipo: volanteras de la sucursal (el servidor limita a las sucursales que gestiona cada uno).
const teamRoute = createRoute({
  getParentRoute: () => manageLayout,
  path: '/equipo',
  component: lazyRouteComponent(() => import('@/features/team/TeamPage'), 'TeamPage'),
})

// Referidos (spec 005): jefe de ventas, gerencia y Sistemas. El encargado no (el servidor responde forbidden).
const referralsLayout = createRoute({
  getParentRoute: () => manageLayout,
  id: 'referrals',
  component: () => (
    <RequireRole roles={REFERRAL_ROLES}>
      <Outlet />
    </RequireRole>
  ),
})
const referralsRoute = createRoute({
  getParentRoute: () => referralsLayout,
  path: '/referidos',
  validateSearch: validateReferralSearch,
  component: lazyRouteComponent(() => import('@/features/referrals/ReferralsPage'), 'ReferralsPage'),
})

// Sistemas (admin): usuarios y catálogos.
const adminLayout = createRoute({
  getParentRoute: () => manageLayout,
  id: 'admin',
  component: () => (
    <RequireRole roles={['admin']}>
      <Outlet />
    </RequireRole>
  ),
})
const usersRoute = createRoute({
  getParentRoute: () => adminLayout,
  path: '/admin/usuarios',
  component: lazyRouteComponent(() => import('@/features/admin/UsersPage'), 'UsersPage'),
})
const catalogRoute = createRoute({
  getParentRoute: () => adminLayout,
  path: '/admin/catalogo',
  component: lazyRouteComponent(() => import('@/features/organization/CatalogPage'), 'CatalogPage'),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  ssoLandingRoute,
  shellLayout.addChildren([
    captureLayout.addChildren([registerRoute, registerNewRoute]),
    followupLayout.addChildren([followupRoute]),
    mineLayout.addChildren([mineRoute]),
    clientLayout.addChildren([clientRoute]),
    planningLayout.addChildren([planningRoute, planningHistoryRoute]),
    verifyLayout.addChildren([verifySharesRoute]),
    manageLayout.addChildren([dashboardRoute, manageRoute, distributeRoute, goalsRoute, teamRoute, referralsLayout.addChildren([referralsRoute]), adminLayout.addChildren([usersRoute, catalogRoute])]),
  ]),
])

export const router = createRouter({ routeTree, defaultPreload: false })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
