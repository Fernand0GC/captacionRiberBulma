import { useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { MULTI_BRANCH_ROLES, ROLE_LABEL } from '@/features/auth/types'
import { useBranches } from '@/features/prospects/api'
import { PageTitle } from '@/ui/PageTitle'
import { generatePassword } from '@/lib/adminUsers'
import { normalizeText } from '@/lib/search'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useToast } from '@/ui/Toast'
import { useSetCollections, useUserAction, useUsers, type UserRow } from './api'
import { UserForm, type UserFormValues } from './UserForm'

type Modal =
  | { kind: 'create' }
  | { kind: 'edit'; user: UserRow }
  | { kind: 'toggle'; user: UserRow }
  | { kind: 'reset'; user: UserRow; draft: string }
  | { kind: 'password'; user: UserRow; password: string }
  | { kind: 'created'; username: string; password: string }
  | { kind: 'collections'; user: UserRow; branch_ids: number[] }
  | { kind: 'act'; user: UserRow }

function errorText(e: unknown): string {
  const d = (e as { details?: { field?: string; reason?: string } }).details
  if (d?.field === 'username' && d.reason === 'duplicate') return 'Ese usuario ya existe. Elige otro.'
  if (d?.field === 'ci')
    return d.reason === 'duplicate' ? 'Ese CI ya lo tiene otro usuario.' : 'Revisa el CI.'
  if (d?.reason === 'self') return 'No puedes hacer eso con tu propio usuario.'
  return (e as Error).message || 'No se pudo guardar.'
}

export function UsersPage() {
  const { profile } = useAuth()
  const users = useUsers()
  const branches = useBranches()
  const action = useUserAction()
  const setCollections = useSetCollections()
  const toast = useToast()
  const [modal, setModal] = useState<Modal | null>(null)
  const [q, setQ] = useState('')
  const [branch, setBranch] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')

  const branchName = (id: number | null) => branches.data?.find((b) => b.id === id)?.name ?? '—'
  const rows = (users.data ?? []).filter(
    (u) =>
      (status === 'all' || (status === 'active' ? u.active : !u.active)) &&
      (!branch || String(u.branch_id) === branch) &&
      (!q || normalizeText(`${u.full_name} ${u.username} ${u.ci ?? ''}`).includes(normalizeText(q))),
  )
  const close = () => {
    action.reset()
    setCollections.reset()
    setModal(null)
  }

  async function create(v: UserFormValues) {
    await action.mutateAsync({ action: 'create', ...v })
    setModal({ kind: 'created', username: v.username, password: v.password ?? '' })
  }
  async function update(user: UserRow, v: UserFormValues) {
    // Cobros que sigue siendo Cobros: la Edge Function no conoce el rol, así que no se le manda y después se
    // vuelven a poner sus sucursales (la función las borra a quien no es jefe de ventas). Ver research R9.
    const keepsCollections = user.role === 'collections' && v.role === 'collections'
    await action.mutateAsync({
      action: 'update',
      id: user.id,
      full_name: v.full_name,
      role: keepsCollections ? undefined : v.role,
      branch_id: keepsCollections ? undefined : v.branch_id,
      branch_ids: v.role === 'sales_lead' ? v.branch_ids : undefined,
      contract_type: v.contract_type,
      ci: v.ci,
    })
    if (keepsCollections && (user.branch_ids ?? []).length > 0)
      await setCollections.mutateAsync({ id: user.id, branch_ids: user.branch_ids ?? [] })
    toast('✓ Usuario actualizado', 'success')
    close()
  }
  async function toggle(user: UserRow) {
    await action.mutateAsync({ action: user.active ? 'deactivate' : 'reactivate', id: user.id })
    toast(user.active ? 'Usuario dado de baja' : '✓ Usuario reactivado', 'success')
    close()
  }
  async function makeCollections(user: UserRow, branchIds: number[]) {
    await setCollections.mutateAsync({ id: user.id, branch_ids: branchIds })
    toast(
      user.role === 'collections'
        ? '✓ Sucursales de Cobros actualizadas'
        : `✓ ${user.full_name} ahora es de Cobros`,
      'success',
    )
    close()
  }
  async function resetPassword(user: UserRow, password: string) {
    await action.mutateAsync({ action: 'reset_password', id: user.id, password })
    setModal({ kind: 'password', user, password })
  }

  const run = (p: Promise<unknown>) => p.catch(() => undefined) // el error se muestra en el diálogo

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <PageTitle
        title="Usuarios"
        subtitle="Alta, baja y contraseñas del personal"
        actions={<Button onClick={() => setModal({ kind: 'create' })}>＋ Nuevo usuario</Button>}
      />

      <section
        className="grid grid-cols-1 gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5 sm:grid-cols-3"
        aria-label="Filtros"
      >
        <input
          type="search"
          aria-label="Buscar usuario"
          placeholder="Buscar nombre o usuario…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-h-11 rounded-xl border border-ink/15 px-3 outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
        />
        <select
          aria-label="Sucursal"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="min-h-11 rounded-xl border border-ink/15 bg-white px-3"
        >
          <option value="">Todas las sucursales</option>
          {branches.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Estado"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="min-h-11 rounded-xl border border-ink/15 bg-white px-3"
        >
          <option value="active">Activos</option>
          <option value="inactive">Dados de baja</option>
          <option value="all">Todos</option>
        </select>
      </section>

      <p className="px-1 text-ink/60">
        <span className="font-display text-2xl font-bold text-ink">{rows.length}</span>{' '}
        {rows.length === 1 ? 'usuario' : 'usuarios'}
      </p>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((u) => (
          <li
            key={u.id}
            className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5"
            data-testid={`user-${u.username}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{u.full_name}</p>
                <p className="truncate text-sm text-ink/50">
                  @{u.username}
                  {u.ci && <> · CI {u.ci}</>}
                </p>
              </div>
              {u.active ? <Badge tone="success">Activo</Badge> : <Badge tone="danger">Baja</Badge>}
            </div>
            <p className="text-sm text-ink/70">
              {ROLE_LABEL[u.role]} ·{' '}
              {u.branch_id
                ? branchName(u.branch_id)
                : MULTI_BRANCH_ROLES.includes(u.role)
                  ? (u.branch_ids ?? []).map(branchName).join(', ') || 'Sin sucursales'
                  : 'Todas las sucursales'}{' '}
              · {u.contract_type === 'temporary' ? 'Temporal' : 'Con contrato'}
            </p>
            <div className="flex flex-wrap gap-2 border-t border-ink/5 pt-3">
              <button
                type="button"
                onClick={() => setModal({ kind: 'edit', user: u })}
                className="min-h-10 rounded-full px-3 text-sm font-semibold ring-1 ring-ink/15 active:bg-sand"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => setModal({ kind: 'reset', user: u, draft: generatePassword() })}
                className="min-h-10 rounded-full px-3 text-sm font-semibold ring-1 ring-ink/15 active:bg-sand"
              >
                Nueva contraseña
              </button>
              {u.id !== profile?.id && (
                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      kind: 'collections',
                      user: u,
                      branch_ids: u.role === 'collections' ? (u.branch_ids ?? []) : [],
                    })
                  }
                  className="min-h-10 rounded-full px-3 text-sm font-semibold ring-1 ring-ink/15 active:bg-sand"
                >
                  {u.role === 'collections' ? 'Sucursales de Cobros' : 'Hacer Cobros'}
                </button>
              )}
              {u.active && u.role !== 'admin' && u.id !== profile?.id && (
                <button
                  type="button"
                  onClick={() => setModal({ kind: 'act', user: u })}
                  className="min-h-10 rounded-full px-3 text-sm font-semibold ring-1 ring-gold/60 active:bg-sand"
                >
                  Actuar como
                </button>
              )}
              {u.id !== profile?.id && (
                <button
                  type="button"
                  onClick={() => setModal({ kind: 'toggle', user: u })}
                  className={`min-h-10 rounded-full px-3 text-sm font-semibold ring-1 ${u.active ? 'text-rb-red ring-rb-red/40' : 'text-emerald-700 ring-emerald-300'}`}
                >
                  {u.active ? 'Dar de baja' : 'Reactivar'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {modal?.kind === 'act' && <ActAsDialog user={modal.user} onClose={close} />}

      <Dialog open={modal?.kind === 'create'} onOpenChange={(o) => !o && close()} title="Nuevo usuario">
        <UserForm
          branches={branches.data ?? []}
          busy={action.isPending}
          error={action.isError ? errorText(action.error) : undefined}
          onSubmit={(v) => run(create(v))}
          onCancel={close}
        />
      </Dialog>

      {modal?.kind === 'edit' && (
        <Dialog open onOpenChange={(o) => !o && close()} title={`Editar a ${modal.user.full_name}`}>
          <UserForm
            initial={modal.user}
            branches={branches.data ?? []}
            busy={action.isPending}
            error={action.isError ? errorText(action.error) : undefined}
            onSubmit={(v) => run(update(modal.user, v))}
            onCancel={close}
          />
        </Dialog>
      )}

      {modal?.kind === 'toggle' && (
        <Dialog
          open
          onOpenChange={(o) => !o && close()}
          title={
            modal.user.active
              ? `¿Dar de baja a ${modal.user.full_name}?`
              : `¿Reactivar a ${modal.user.full_name}?`
          }
          description={
            modal.user.active
              ? 'Ya no podrá entrar. Lo que registró se conserva, y lo que haya guardado sin señal antes de la baja todavía puede subir.'
              : 'Podrá volver a entrar con su usuario y contraseña.'
          }
        >
          {action.isError && <p className="mb-3 text-sm text-rb-red">{errorText(action.error)}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={close}>
              Cancelar
            </Button>
            <Button
              variant={modal.user.active ? 'danger' : 'primary'}
              className="flex-1"
              disabled={action.isPending}
              onClick={() => run(toggle(modal.user))}
            >
              {modal.user.active ? 'Dar de baja' : 'Reactivar'}
            </Button>
          </div>
        </Dialog>
      )}

      {modal?.kind === 'collections' && (
        <Dialog
          open
          onOpenChange={(o) => !o && close()}
          title={
            modal.user.role === 'collections'
              ? `Sucursales de Cobros de ${modal.user.full_name}`
              : `¿Hacer Cobros a ${modal.user.full_name}?`
          }
          description="Cobros solo ve «Verificar compartidas» de estas sucursales: anota cuántas compartidas verificó. No ve datos de clientes."
        >
          <fieldset className="mb-4 flex flex-col gap-2" aria-label="Sucursales de Cobros">
            <div className="grid grid-cols-2 gap-2">
              {(branches.data ?? []).map((b) => {
                const on = modal.branch_ids.includes(b.id)
                return (
                  <label
                    key={b.id}
                    className={`flex min-h-11 items-center gap-2 rounded-xl px-3 ring-1 ${on ? 'bg-gold/10 ring-gold/50' : 'bg-white ring-ink/15'}`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-gold"
                      checked={on}
                      onChange={() =>
                        setModal({
                          ...modal,
                          branch_ids: on
                            ? modal.branch_ids.filter((x) => x !== b.id)
                            : [...modal.branch_ids, b.id],
                        })
                      }
                    />
                    {b.name}
                  </label>
                )
              })}
            </div>
          </fieldset>
          {setCollections.isError && (
            <p className="mb-3 text-sm text-rb-red">{(setCollections.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={close}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={setCollections.isPending || modal.branch_ids.length === 0}
              onClick={() => void run(makeCollections(modal.user, modal.branch_ids))}
            >
              {setCollections.isPending
                ? 'Guardando…'
                : modal.user.role === 'collections'
                  ? 'Guardar'
                  : 'Hacer Cobros'}
            </Button>
          </div>
        </Dialog>
      )}

      {modal?.kind === 'reset' && (
        <Dialog
          open
          onOpenChange={(o) => !o && close()}
          title={`Nueva contraseña para ${modal.user.full_name}`}
          description="Escribe la que quieras (mínimo 8 caracteres) o usa la generada."
        >
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (modal.draft.trim().length >= 8) void run(resetPassword(modal.user, modal.draft.trim()))
            }}
          >
            <div className="flex gap-2">
              <input
                aria-label="Contraseña nueva"
                value={modal.draft}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(e) => setModal({ ...modal, draft: e.target.value })}
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-ink/15 bg-white px-3 font-mono text-lg outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
              />
              <button
                type="button"
                onClick={() => setModal({ ...modal, draft: generatePassword() })}
                className="min-h-12 rounded-xl px-3 text-sm font-semibold ring-1 ring-ink/15 active:bg-sand"
              >
                Generar
              </button>
            </div>
            {modal.draft.trim().length < 8 && (
              <p className="text-sm text-ink/55">Faltan {8 - modal.draft.trim().length} caracteres.</p>
            )}
            {action.isError && <p className="text-sm text-rb-red">{errorText(action.error)}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={close}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={action.isPending || modal.draft.trim().length < 8}
              >
                {action.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {(modal?.kind === 'created' || modal?.kind === 'password') && (
        <Dialog
          open
          onOpenChange={(o) => !o && close()}
          title={modal.kind === 'created' ? 'Usuario creado' : 'Contraseña nueva'}
          description="Entrégale estos datos. La contraseña no se vuelve a mostrar."
        >
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-white p-4 ring-1 ring-ink/10">
            <dt className="text-ink/55">Usuario</dt>
            <dd className="font-semibold" data-testid="new-username">
              {modal.kind === 'created' ? modal.username : modal.user.username}
            </dd>
            <dt className="text-ink/55">Contraseña</dt>
            <dd className="font-mono text-lg font-semibold" data-testid="new-password">
              {modal.password}
            </dd>
          </dl>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                const u = modal.kind === 'created' ? modal.username : modal.user.username
                void navigator.clipboard?.writeText(`Usuario: ${u}\nContraseña: ${modal.password}`)
                toast('Copiado', 'success')
              }}
            >
              Copiar
            </Button>
            <Button className="flex-1" onClick={close}>
              Listo
            </Button>
          </div>
        </Dialog>
      )}
    </main>
  )
}

/** Confirmación de «Actuar como» (spec 027). Al aceptar, la app se recarga con la identidad de esa persona. */
function ActAsDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { startImpersonation } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setBusy(true)
    setError(null)
    try {
      await startImpersonation(user.id)
    } catch (e) {
      setError((e as Error).message || 'No se pudo actuar como esta persona.')
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`¿Actuar como ${user.full_name}?`}
      description="Vas a ver y usar la app con su menú, su sucursal y sus permisos durante 30 minutos. Lo que guardes queda registrado a su nombre y, en la auditoría, a nombre tuyo como autor real."
    >
      {error && <p className="mb-3 text-sm text-rb-red">{error}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={() => void start()} disabled={busy}>
          {busy ? 'Entrando…' : 'Actuar como'}
        </Button>
      </div>
    </Dialog>
  )
}
