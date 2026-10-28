import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Outlet } from '@tanstack/react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { CAPTURE_ROLES, FOLLOWUP_ROLES, MANAGER_ROLES } from '@/features/auth/types'
import { CaptureForm } from '@/features/capture/CaptureForm'
import { RegisterHome } from '@/features/capture/RegisterHome'
import { SyncRunner } from '@/features/sync/SyncRunner'
import { validateManageSearch } from '@/features/prospects/search'
import { HomeRedirect, RequireRole } from './guards'

// Bundle inicial: login + registro de campo. El resto se carga lazy (constitución II, research R2).
const rootRoute = createRootRoute({ component: Outlet })

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomeRedirect })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage })

const captureLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'capture',
  component: () => (
    <RequireRole roles={CAPTURE_ROLES}>
      <SyncRunner />
      <Outlet />
    </RequireRole>
  ),
})
const registerRoute = createRoute({
  getParentRoute: () => captureLayout,
  path: '/registrar',
  component: RegisterHome,
})
const registerNewRoute = createRoute({
  getParentRoute: () => captureLayout,
  path: '/registrar/nuevo',
  component: CaptureForm,
})

const ManagedOutlet = lazyRouteComponent(() => import('./ManagedOutlet'), 'ManagedOutlet')

const followupLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'followup',
  component: () => (
    <RequireRole roles={FOLLOWUP_ROLES}>
      <ManagedOutlet />
    </RequireRole>
  ),
})
const followupRoute = createRoute({
  getParentRoute: () => followupLayout,
  path: '/seguimiento',
  component: lazyRouteComponent(() => import('@/app/Placeholder'), 'Placeholder'),
})

const ManageLayout = lazyRouteComponent(() => import('./ManageLayout'), 'ManageLayout')

const manageLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'manage',
  component: () => (
    <RequireRole roles={MANAGER_ROLES}>
      <ManageLayout />
    </RequireRole>
  ),
})
const manageRoute = createRoute({
  getParentRoute: () => manageLayout,
  path: '/gestion',
  validateSearch: validateManageSearch,
  component: lazyRouteComponent(() => import('@/features/prospects/ProspectsPage'), 'ProspectsPage'),
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

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  captureLayout.addChildren([registerRoute, registerNewRoute]),
  followupLayout.addChildren([followupRoute]),
  manageLayout.addChildren([manageRoute, adminLayout.addChildren([usersRoute])]),
])

export const router = createRouter({ routeTree, defaultPreload: false })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
