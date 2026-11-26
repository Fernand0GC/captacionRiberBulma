import { useAuth } from '@/features/auth/AuthProvider'
import type { Permission } from '@/features/auth/types'
import { PageTitle } from '@/ui/PageTitle'
import { useToast } from '@/ui/Toast'
import { usePermissionsList, useSetPermission } from './api'
import { PERMISSION_INFO, type PermissionRow } from './permissions'

// Permisos por persona (spec 029). Sistemas y gerencia ven a todas las encargadas; el jefe, las de sus sucursales.
// Lo decide el servidor (permissions_list / permission_set); aquí solo se muestra lo que devuelve.

function errorText(e: unknown): string {
  const code = (e as { code?: string }).code
  if (code === 'forbidden') return 'No tienes permiso sobre esta persona.'
  if (code === 'network') return 'Sin conexión. Intenta cuando tengas señal.'
  return (e as Error).message || 'No se pudo guardar.'
}

function PermissionSwitch({
  row,
  permission,
  label,
  disabled,
  onChange,
}: {
  row: PermissionRow
  permission: Permission
  label: string
  disabled: boolean
  onChange: (on: boolean) => void
}) {
  const on = row.permissions.includes(permission)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label}: ${row.full_name}`}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50 ${
        on ? 'bg-emerald-500' : 'bg-ink/20'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-150 ${
          on ? 'translate-x-6' : ''
        }`}
      />
    </button>
  )
}

export function PermissionsPage() {
  const { impersonation } = useAuth()
  const list = usePermissionsList()
  const set = useSetPermission()
  const toast = useToast()
  const rows = list.data ?? []

  async function change(row: PermissionRow, permission: Permission, on: boolean) {
    const name = PERMISSION_INFO.find((p) => p.key === permission)?.label ?? permission
    try {
      await set.mutateAsync({ id: row.id, permission, on })
      toast(`✓ ${row.full_name.split(' ')[0]}: ${name} ${on ? 'activado' : 'quitado'}`, 'success')
    } catch (e) {
      toast(errorText(e), 'error') // la casilla ya volvió a como estaba (useSetPermission)
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 pb-28 sm:px-6">
      <PageTitle title="Permisos" subtitle="Permisos extra para las encargadas, solo en su sucursal" />

      {impersonation && (
        <p role="status" className="rounded-2xl bg-gold/15 p-3 text-sm text-ink ring-1 ring-gold/30">
          Estás actuando como {impersonation.target.full_name}: aquí sigues con los permisos de Sistemas.
        </p>
      )}

      <ul className="flex flex-col gap-1 rounded-2xl bg-white p-4 text-sm text-ink/70 ring-1 ring-ink/10">
        {PERMISSION_INFO.map((p) => (
          <li key={p.key}>
            <span className="font-semibold text-ink">{p.label}:</span> {p.help}
          </li>
        ))}
      </ul>

      {list.isPending ? (
        <p className="py-8 text-center text-ink/60">Cargando…</p>
      ) : list.isError ? (
        <p className="py-8 text-center text-rb-red">{errorText(list.error)}</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-ink/60">No hay encargadas activas en tus sucursales.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-ink/10 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{r.full_name}</p>
                <p className="text-sm text-ink/60">
                  Encargada · {r.branch_name} · {r.username}
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                {PERMISSION_INFO.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-sm text-ink">
                    <PermissionSwitch
                      row={r}
                      permission={p.key}
                      label={p.label}
                      disabled={set.isPending}
                      onChange={(on) => void change(r, p.key, on)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
