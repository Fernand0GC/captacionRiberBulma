import { useEffect, useState } from 'react'
import { MdMoreVert, MdWhatsapp } from 'react-icons/md'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBranchScope } from '@/features/auth/useBranchScope'
import { normalizeText } from '@/lib/search'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Field, TextInput } from '@/ui/Field'
import { PageTitle } from '@/ui/PageTitle'
import { useToast } from '@/ui/Toast'
import { useTeam, useTeamAction } from './api'
import { credentialsText, IDLE_DAYS, idleDays, isIdle, similarMember, type Member } from './team'

type Modal =
  | { kind: 'create' }
  | { kind: 'menu'; member: Member }
  | { kind: 'rename'; member: Member }
  | { kind: 'delete'; member: Member }
  | { kind: 'credentials'; title: string; username: string; password: string }

function errorText(e: unknown): string {
  const code = (e as { code?: string }).code
  if (code === 'forbidden') return 'No tienes permiso sobre esta persona.'
  if (code === 'network') return 'Sin conexión. Intenta cuando tengas señal.'
  return (e as Error).message || 'No se pudo guardar.'
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

/** Interruptor activa / inactiva, directo en la tarjeta. */
function ActiveSwitch({ member, disabled, onChange }: { member: Member; disabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={member.active}
      aria-label={`Activa: ${member.full_name}`}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50 ${
        member.active ? 'bg-emerald-500' : 'bg-ink/20'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-150 ${
          member.active ? 'translate-x-6' : ''
        }`}
      />
    </button>
  )
}

function MemberCard({
  member,
  now,
  fresh,
  busy,
  onToggle,
  onMenu,
}: {
  member: Member
  now: Date
  fresh: boolean
  busy: boolean
  onToggle: () => void
  onMenu: () => void
}) {
  const idle = idleDays(member, now)
  return (
    <li
      data-testid={`member-${member.username}`}
      className={`flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5 transition-opacity duration-150 ${
        member.active ? '' : 'opacity-70'
      } ${fresh ? 'animate-arrive' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{member.full_name}</p>
        <p className="truncate text-sm text-ink/50">{member.username}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/70">
          {member.active ? (
            <span>
              Hoy <b className="tabular-nums text-ink">{member.today}</b>
            </span>
          ) : (
            <span>Inactiva</span>
          )}
          <span>
            Total <b className="tabular-nums text-ink">{member.total}</b>
          </span>
          {idle !== null && idle >= IDLE_DAYS && (
            <Badge tone="warning">{member.total === 0 ? `Sin captar desde que entró (${idle} días)` : `Sin captar hace ${idle} días`}</Badge>
          )}
        </p>
      </div>
      <ActiveSwitch member={member} disabled={busy} onChange={onToggle} />
      <button
        type="button"
        aria-label={`Opciones de ${member.full_name}`}
        onClick={onMenu}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl text-ink/60 active:bg-sand"
      >
        <MdMoreVert aria-hidden />
      </button>
    </li>
  )
}

/** Mi equipo: el encargado (o el jefe de ventas) crea, edita, activa/desactiva y elimina a sus volanteras. */
export function TeamPage() {
  const { profile } = useAuth()
  const scope = useBranchScope()
  const toast = useToast()
  const online = useOnline()
  const action = useTeamAction()
  const [branchSel, setBranchSel] = useState<number | undefined>(undefined)
  // Gerencia/Sistemas eligen sucursal; sin elegir, la primera (aquí no existe "todas").
  const branch = scope.canPick ? (branchSel ?? scope.fallback ?? scope.options?.[0]?.id) : (profile?.branch_id ?? undefined)
  const branchName = scope.branches.data?.find((b) => b.id === branch)?.name
  const team = useTeam(branch)
  const [tab, setTab] = useState<'active' | 'inactive'>('active')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState<Modal | null>(null)
  const [fresh, setFresh] = useState<string>()
  const [name, setName] = useState('')
  const now = new Date()

  const members = team.data ?? []
  const actives = members.filter((m) => m.active)
  const inactives = members.filter((m) => !m.active)
  const idle = actives.filter((m) => isIdle(m, now))
  const rows = (tab === 'active' ? actives : inactives).filter(
    (m) => !q || normalizeText(`${m.full_name} ${m.username}`).includes(normalizeText(q)),
  )
  const similar = modal?.kind === 'create' ? similarMember(name, members) : undefined

  const close = () => {
    action.reset()
    setModal(null)
  }
  const run = (p: Promise<unknown>) => p.catch(() => undefined) // el error se muestra en el diálogo

  async function create() {
    const r = await action.mutateAsync({ action: 'team_create', branch_id: branch, full_name: name.trim() })
    setFresh(r.id)
    setTab('active')
    setModal({ kind: 'credentials', title: 'Volantera creada', username: r.username ?? '', password: r.password ?? '' })
  }

  async function setActive(m: Member, active: boolean, undoable = true) {
    try {
      await action.mutateAsync({ action: active ? 'team_reactivate' : 'team_deactivate', id: m.id })
    } catch (e) {
      toast(errorText(e), 'error')
      return
    }
    const first = m.full_name.split(' ')[0]
    if (active) {
      setFresh(m.id)
      toast(`✓ ${first} puede volver a entrar`, 'success')
    } else {
      toast(
        `${first} ya no puede entrar. Lo que registró se conserva.`,
        'info',
        undoable ? { label: 'Deshacer', onClick: () => void setActive(m, true, false) } : undefined,
      )
    }
  }

  async function reactivateSimilar(m: Member) {
    close()
    setTab('active')
    await setActive(m, true, false)
  }

  async function rename(m: Member, fullName: string) {
    await action.mutateAsync({ action: 'team_rename', id: m.id, full_name: fullName })
    toast('✓ Nombre actualizado', 'success')
    close()
  }

  async function newPassword(m: Member) {
    const r = await action.mutateAsync({ action: 'team_password', id: m.id })
    setModal({ kind: 'credentials', title: 'Clave nueva', username: m.username, password: r.password ?? '' })
  }

  async function remove(m: Member) {
    const r = await action.mutateAsync({ action: 'team_delete', id: m.id })
    toast(r.archived ? `${m.full_name} quedó archivada (inactiva)` : `${m.full_name} fue eliminada`, 'success')
    close()
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 pb-28 sm:px-6">
      <PageTitle title="Mi equipo" subtitle={branchName ? `Volanteras de ${branchName}` : 'Volanteras'} />

      {scope.canPick && (
        <select
          aria-label="Sucursal"
          value={branch ?? ''}
          onChange={(e) => setBranchSel(Number(e.target.value))}
          className="min-h-11 rounded-xl border border-ink/15 bg-white px-3"
        >
          {scope.options?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}

      {idle.length > 0 && (
        <div role="status" className="animate-pop rounded-2xl bg-gold/15 p-4 text-ink ring-1 ring-gold/30">
          <p className="font-semibold">
            {idle.length === 1 ? '1 volantera' : `${idle.length} volanteras`} sin captar hace más de {IDLE_DAYS} días
          </p>
          <p className="text-sm text-ink/70">
            Si ya no trabajan, desactívalas con el interruptor: dejan de poder entrar y lo que registraron se conserva.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-sand p-1" role="tablist" aria-label="Estado">
          {(
            [
              ['active', `Activas ${actives.length}`],
              ['inactive', `Inactivas ${inactives.length}`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={tab === v}
              onClick={() => setTab(v)}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors ${
                tab === v ? 'bg-ink text-gold-light' : 'text-ink/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          aria-label="Buscar volantera"
          placeholder="Buscar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
        />
      </div>

      {team.isPending ? (
        <p className="py-8 text-center text-ink/50">Cargando…</p>
      ) : team.isError ? (
        <p className="py-8 text-center text-rb-red">{errorText(team.error)}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-ink/5">
          <p className="font-semibold">
            {q ? 'Nadie con ese nombre' : tab === 'active' ? 'Aún no tienes volanteras activas' : 'No hay volanteras inactivas'}
          </p>
          {!q && tab === 'active' && <p className="mt-1 text-ink/55">Crea la primera con el botón de abajo.</p>}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              now={now}
              fresh={fresh === m.id}
              busy={action.isPending || !online}
              onToggle={() => void setActive(m, !m.active)}
              onMenu={() => setModal({ kind: 'menu', member: m })}
            />
          ))}
        </ul>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-cream via-cream/90 to-transparent px-4 pt-6 pb-4 lg:left-64">
        <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col items-stretch gap-1">
          <Button
            className="min-h-14 text-lg"
            disabled={!online || branch === undefined}
            onClick={() => {
              setName('')
              setModal({ kind: 'create' })
            }}
          >
            ＋ Nueva volantera
          </Button>
          {!online && <p className="text-center text-sm text-ink/60">Necesitas internet para crear o cambiar cuentas.</p>}
        </div>
      </div>

      <Dialog
        open={modal?.kind === 'create'}
        onOpenChange={(o) => !o && close()}
        title="Nueva volantera"
        description={branchName ? `Entra a ${branchName}. El usuario y la clave los arma la app.` : undefined}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim().length >= 3) void run(create())
          }}
        >
          <Field label="Nombre y apellido" required>
            {(id) => (
              <TextInput
                id={id}
                value={name}
                maxLength={120}
                autoComplete="off"
                autoCapitalize="words"
                placeholder="Ej.: María Pérez"
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          {similar && (
            <div className="animate-pop rounded-2xl bg-sand p-3 text-sm" data-testid="similar-member">
              {similar.active ? (
                <p>
                  Ya tienes a <b>{similar.full_name}</b> activa ({similar.username}). Si es otra persona, créala igual.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p>
                    ¿Es <b>{similar.full_name}</b>? Estuvo en el equipo y está inactiva. Reactívala para que use su mismo usuario.
                  </p>
                  <Button variant="dark" disabled={action.isPending} onClick={() => void reactivateSimilar(similar)}>
                    Reactivar a {similar.full_name.split(' ')[0]}
                  </Button>
                </div>
              )}
            </div>
          )}
          {action.isError && <p className="text-sm text-rb-red">{errorText(action.error)}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={action.isPending || name.trim().length < 3}>
              {action.isPending ? 'Creando…' : similar ? 'Crear igual' : 'Crear'}
            </Button>
          </div>
        </form>
      </Dialog>

      {modal?.kind === 'menu' && (
        <Dialog open onOpenChange={(o) => !o && close()} title={modal.member.full_name} description={modal.member.username}>
          <div className="flex flex-col gap-2">
            {action.isError && <p className="text-sm text-rb-red">{errorText(action.error)}</p>}
            <Button variant="secondary" disabled={!online} onClick={() => setModal({ kind: 'rename', member: modal.member })}>
              Cambiar nombre
            </Button>
            <Button variant="secondary" disabled={!online || action.isPending} onClick={() => void run(newPassword(modal.member))}>
              {action.isPending ? 'Generando…' : 'Nueva clave'}
            </Button>
            <Button variant="danger" disabled={!online} onClick={() => setModal({ kind: 'delete', member: modal.member })}>
              Eliminar
            </Button>
            <Button variant="ghost" onClick={close}>
              Cerrar
            </Button>
          </div>
        </Dialog>
      )}

      {modal?.kind === 'rename' && (
        <Dialog open onOpenChange={(o) => !o && close()} title="Cambiar nombre" description="El usuario para entrar no cambia.">
          <RenameForm
            initial={modal.member.full_name}
            busy={action.isPending}
            error={action.isError ? errorText(action.error) : undefined}
            onCancel={close}
            onSave={(n) => void run(rename(modal.member, n))}
          />
        </Dialog>
      )}

      {modal?.kind === 'delete' && (
        <Dialog
          open
          onOpenChange={(o) => !o && close()}
          title={modal.member.total > 0 ? `¿Archivar a ${modal.member.full_name}?` : `¿Eliminar a ${modal.member.full_name}?`}
          description={
            modal.member.total > 0
              ? `Tiene ${modal.member.total} ${modal.member.total === 1 ? 'captación' : 'captaciones'}: no se borra para no perderlas. Queda inactiva y sus números siguen en los reportes.`
              : 'No registró nada: se borra la cuenta. No se puede deshacer.'
          }
        >
          {action.isError && <p className="mb-3 text-sm text-rb-red">{errorText(action.error)}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={close}>
              Cancelar
            </Button>
            <Button variant="danger" className="flex-1" disabled={action.isPending} onClick={() => void run(remove(modal.member))}>
              {modal.member.total > 0 ? 'Archivar' : 'Eliminar'}
            </Button>
          </div>
        </Dialog>
      )}

      {modal?.kind === 'credentials' && (
        <Dialog
          open
          onOpenChange={(o) => !o && close()}
          title={modal.title}
          description="Pásale estos datos. La clave no se vuelve a mostrar."
        >
          <dl className="animate-pop mb-4 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 rounded-2xl bg-white p-4 ring-1 ring-ink/10">
            <dt className="text-ink/55">Usuario</dt>
            <dd className="text-lg font-semibold break-all" data-testid="team-username">
              {modal.username}
            </dd>
            <dt className="text-ink/55">Clave</dt>
            <dd className="font-mono text-3xl font-bold tracking-[0.2em]" data-testid="team-password">
              {modal.password}
            </dd>
          </dl>
          <div className="flex flex-col gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(credentialsText(modal.username, modal.password))}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 font-semibold text-white active:brightness-95"
            >
              <MdWhatsapp aria-hidden className="text-2xl" /> Enviar por WhatsApp
            </a>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  void navigator.clipboard?.writeText(credentialsText(modal.username, modal.password))
                  toast('✓ Copiado', 'success')
                }}
              >
                Copiar
              </Button>
              <Button className="flex-1" onClick={close}>
                Listo
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </main>
  )
}

function RenameForm({
  initial,
  busy,
  error,
  onCancel,
  onSave,
}: {
  initial: string
  busy: boolean
  error?: string
  onCancel: () => void
  onSave: (name: string) => void
}) {
  const [value, setValue] = useState(initial)
  const valid = value.trim().length >= 3 && value.trim() !== initial
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave(value.trim())
      }}
    >
      <Field label="Nombre y apellido" required>
        {(id) => <TextInput id={id} value={value} maxLength={120} autoComplete="off" onChange={(e) => setValue(e.target.value)} />}
      </Field>
      {error && <p className="text-sm text-rb-red">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={busy || !valid}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
