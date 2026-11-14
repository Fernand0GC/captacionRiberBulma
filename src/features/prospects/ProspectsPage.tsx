import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { groupChannels } from '@/features/capture/channelGroups'
import { ROLE_LABEL } from '@/features/auth/types'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useToast } from '@/ui/Toast'
import { followupRowOf, useClient } from '@/features/client/api'
import { ResultDialog } from '@/features/followup/ResultDialog'
import {
  fetchAllProspects,
  PAGE_SIZE,
  useAssign,
  useAssignees,
  useBranches,
  useChannels,
  useProspects,
  type ProspectRow,
} from './api'
import { fmtDate, fmtTime, INTEREST_LABEL, STAGE_LABEL } from './format'
import { MdFileDownload } from 'react-icons/md'
import { PageTitle } from '@/ui/PageTitle'
import { fmtDay, ManageFilterBar, useDebounced, useManageScope, ViewSwitch } from './ManageFilterBar'

// Vistas de monitoreo (specs/002-monitoreo-seguimiento): se cargan solo al entrar.
const FollowupStatusView = lazy(() => import('@/features/monitoring/FollowupStatusView'))
const ActivityView = lazy(() => import('@/features/monitoring/ActivityView'))

const viewFallback = <p className="px-4 py-8 text-center text-ink/50">Cargando…</p>

export function ProspectsPage() {
  const scope = useManageScope()
  if (scope.search.ver === 'seguimiento')
    return (
      <Suspense fallback={viewFallback}>
        <FollowupStatusView scope={scope} />
      </Suspense>
    )
  if (scope.search.ver === 'actividad')
    return (
      <Suspense fallback={viewFallback}>
        <ActivityView scope={scope} />
      </Suspense>
    )
  return <CapturesView scope={scope} />
}

function CapturesView({ scope }: { scope: ReturnType<typeof useManageScope> }) {
  const { profile, isGlobal, search, setSearch, from, to, sucursal, branchId } = scope

  // La búsqueda por nombre/celular vive solo en el estado de la pantalla, nunca en la URL (constitución IV).
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q.trim())

  const page = search.pagina ?? 1
  // React Query compara la clave por valor: no hace falta memoizar.
  const filters = {
    from,
    to,
    branch_id: isGlobal ? sucursal : undefined,
    created_by: search.autor,
    channel_id: search.canal === 'sin' ? ('none' as const) : search.canal,
    q: qDebounced.length >= 2 ? qDebounced : undefined,
    assigned: search.responsable === 'sin' ? 'none' : search.responsable,
    stage: search.etapa,
    view: search.ver === 'visitas' ? ('visits' as const) : undefined,
  }

  const prospects = useProspects(filters, page)
  const branches = useBranches()
  const channels = useChannels()

  const branchName = branches.data?.find((b) => b.id === profile?.branch_id)?.name
  const total = prospects.data?.total ?? 0

  // Selección para asignar responsable (FR-035). Se asigna dentro de una sucursal.
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  async function onExport() {
    setExporting(true)
    try {
      const { exportProspects } = await import('@/features/export/exportProspects')
      const scope = isGlobal
        ? (branches.data?.find((b) => b.id === sucursal)?.name ?? 'TODAS')
        : (branchName ?? 'sucursal')
      const n = await exportProspects(filters, scope)
      toast(`✓ Excel descargado: ${n} captaciones`, 'success')
    } catch (e) {
      toast((e as Error).message || 'No se pudo exportar', 'error')
    } finally {
      setExporting(false)
    }
  }
  const assign = useAssign()
  const assignees = useAssignees(branchId)
  const [assignTo, setAssignTo] = useState('')
  const [contactId, setContactId] = useState<string | null>(null)
  const closeContact = () => setContactId(null)
  const rowsOnPage = prospects.data?.rows ?? []
  // Modo "Seleccionar": recién ahí salen las casillas y la barra para asignar.
  const [selecting, setSelecting] = useState(false)
  // La selección vale para los filtros en que se hizo (se mantiene al cambiar de página; al cambiar filtros se limpia sola).
  // Guarda el responsable actual de cada una para avisar a quién se le quitan al reasignar.
  const selectionKey = JSON.stringify(filters)
  const [selection, setSelection] = useState<{ key: string; ids: Selection }>({ key: selectionKey, ids: new Map() })
  const selected = selection.key === selectionKey ? selection.ids : (new Map() as Selection)
  const setSelected = (ids: Selection) => setSelection({ key: selectionKey, ids })
  const toggle = (id: string) =>
    setSelection((cur) => {
      const n: Selection = new Map(cur.key === selectionKey ? cur.ids : [])
      const r = rowsOnPage.find((x) => x.id === id)
      if (n.has(id)) n.delete(id)
      else if (r) n.set(id, ownerOf(r))
      return { key: selectionKey, ids: n }
    })
  const [confirming, setConfirming] = useState(false)
  const [loadingAll, setLoadingAll] = useState(false)
  const stopSelecting = () => {
    setSelecting(false)
    setSelection({ key: selectionKey, ids: new Map() })
    setAssignTo('')
    setConfirming(false)
  }
  useEffect(() => {
    if (!selecting) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelecting(false)
        setSelection((s) => ({ ...s, ids: new Map() }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selecting])
  const allOnPage = rowsOnPage.length > 0 && rowsOnPage.every((r) => selected.has(r.id))
  const toggleAll = () => {
    const n: Selection = new Map(selected)
    for (const r of rowsOnPage) {
      if (allOnPage) n.delete(r.id)
      else n.set(r.id, ownerOf(r))
    }
    setSelected(n)
  }
  // La casilla "todas" de la tabla marca solo la página (50) y en celular no hay: esto trae todas las del filtro.
  async function selectAllMatching() {
    setLoadingAll(true)
    try {
      const rows = await fetchAllProspects(filters)
      setSelected(new Map(rows.map((r) => [r.id, ownerOf(r)])))
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setLoadingAll(false)
    }
  }
  const allMatching = total > 0 && selected.size >= total
  // Reparto de la tarde (FR-039b): en partes iguales entre las auxiliares de la sucursal.
  const auxiliaries = (assignees.data ?? []).filter((a) => a.role === 'field_assistant')
  // Las que hoy son de otra persona: se le quitan (reasignar). Se confirma antes.
  const taken = [...selected.values()].filter((o) => o.id !== null && o.id !== assignTo)
  const isReassign = assignTo !== '' && taken.length > 0
  const targetLabel =
    assignTo === 'split'
      ? `repartirlas entre las ${auxiliaries.length} auxiliares`
      : assignTo === 'none'
        ? 'dejarlas sin responsable'
        : `pasarlas a ${assignees.data?.find((a) => a.id === assignTo)?.full_name ?? ''}`
  async function doAssign() {
    setConfirming(false)
    try {
      if (assignTo === 'split') {
        const ids = [...selected.keys()]
        const buckets = auxiliaries.map((a, i) => ({
          to: a.id,
          ids: ids.filter((_, j) => j % auxiliaries.length === i),
        }))
        for (const b of buckets) if (b.ids.length) await assign.mutateAsync({ ids: b.ids, to: b.to })
        toast(`✓ ${ids.length} ${isReassign ? 'reasignadas' : 'repartidas'} entre ${auxiliaries.length} auxiliares`, 'success')
        stopSelecting()
        return
      }
      const n = await assign.mutateAsync({ ids: [...selected.keys()], to: assignTo === 'none' ? null : assignTo })
      toast(assignTo === 'none' ? `✓ ${n} sin responsable` : `✓ ${n} ${isReassign ? 'reasignadas' : 'asignadas'}`, 'success')
      stopSelecting()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <main className={`mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 ${selecting ? 'pb-36' : ''}`}>
      <PageTitle
        title={search.ver === 'visitas' ? 'Visitas pactadas' : 'Captaciones'}
        subtitle={isGlobal ? (branches.data?.find((b) => b.id === sucursal)?.name ?? 'Todas las sucursales') : branchName}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={selecting}
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
              disabled={!rowsOnPage.length}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold ring-1 disabled:opacity-50 ${
                selecting ? 'bg-ink text-gold-light ring-ink' : 'bg-white text-ink ring-ink/15 active:bg-sand'
              }`}
            >
              {selecting ? 'Cancelar selección' : 'Seleccionar'}
            </button>
            <button
              type="button"
              onClick={() => void onExport()}
              disabled={exporting || !prospects.data?.total}
              className="bg-gold-gradient flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink shadow-sm disabled:opacity-50"
            >
              <MdFileDownload className="text-lg" aria-hidden />
              {exporting ? 'Exportando…' : 'Exportar Excel'}
            </button>
            <ViewSwitch search={search} setSearch={setSearch} />
          </div>
        }
      />
      <ManageFilterBar
        scope={scope}
        q={q}
        setQ={setQ}
        show={{ search: true, author: true, assignee: true, stage: true, channel: true }}
      />

      {/* Cantidad por canal: chips que además filtran (con todos los demás filtros aplicados). */}
      {prospects.data && prospects.data.by_channel.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Por canal">
          <button
            type="button"
            aria-pressed={search.canal === undefined}
            onClick={() => setSearch({ canal: undefined })}
            className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${
              search.canal === undefined
                ? 'bg-ink text-gold-light'
                : 'bg-white text-ink/70 ring-1 ring-ink/10'
            }`}
          >
            Todos{' '}
            <span className="tabular-nums opacity-70">
              {prospects.data.by_channel.reduce((a, c) => a + c.n, 0)}
            </span>
          </button>
          {groupChannels(
            prospects.data.by_channel.map((c) => ({
              ...c,
              group: channels.data?.find((x) => x.id === c.channel_id)?.group ?? null,
            })),
          ).map((block) => (
            <span key={block.label} className="contents" data-testid={`group-${block.label}`}>
              <span className="flex min-h-10 items-center pl-2 text-xs font-bold uppercase tracking-widest text-ink/55">
                {block.label}{' '}
                <span className="ml-1 tabular-nums">{block.items.reduce((a, c) => a + c.n, 0)}</span>
              </span>
              {block.items.map((c) => {
                const value = c.channel_id ?? ('sin' as const)
                const active = search.canal === value
                return (
                  <button
                    key={c.name}
                    type="button"
                    aria-pressed={active}
                    data-testid={`chip-${c.name}`}
                    onClick={() => setSearch({ canal: active ? undefined : value })}
                    className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${
                      active
                        ? 'bg-gold-gradient text-ink shadow-gold'
                        : 'bg-white text-ink/70 ring-1 ring-ink/10 active:bg-sand'
                    }`}
                  >
                    {c.name} <span className="tabular-nums opacity-70">{c.n}</span>
                  </button>
                )
              })}
            </span>
          ))}
        </div>
      )}

      {/* Resumen */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <p className="text-ink/60">
          <span className="font-display text-3xl font-bold text-ink" data-testid="total">
            {total}
          </span>{' '}
          {total === 1 ? 'captación' : 'captaciones'} ·{' '}
          {from === to ? fmtDay(from) : `${fmtDay(from)} al ${fmtDay(to)}`}
        </p>
        {prospects.isFetching && <span className="text-sm text-ink/40">Actualizando…</span>}
      </div>

      {prospects.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">
          No se pudo cargar. {(prospects.error as Error).message}
        </p>
      ) : prospects.data && prospects.data.rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">
          No hay captaciones con estos filtros.
        </p>
      ) : (
        <>
          <ProspectsTable
            rows={rowsOnPage}
            showBranch={isGlobal}
            selecting={selecting}
            selected={selected}
            onToggle={toggle}
            onContact={setContactId}
            allSelected={allOnPage}
            onToggleAll={toggleAll}
          />
          <ProspectsCards rows={rowsOnPage} showBranch={isGlobal} selecting={selecting} selected={selected} onToggle={toggle} onContact={setContactId} />
        </>
      )}

      {contactId && <ContactDialog id={contactId} onClose={closeContact} />}

      {selecting && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-white shadow-2xl lg:left-64"
          role="region"
          aria-label="Asignar"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
            <span className="flex flex-col">
              <span className="font-semibold" data-testid="selected-count">
                {selected.size === 0
                  ? 'Marca las captaciones'
                  : allMatching
                    ? `Las ${selected.size} del filtro`
                    : `${selected.size} ${selected.size === 1 ? 'seleccionada' : 'seleccionadas'}`}
              </span>
              {selected.size > 0 && (
                <span className="text-xs text-white/70" data-testid="selected-owners">
                  {ownersSummary(selected)}
                </span>
              )}
            </span>
            {!allMatching && total > 0 && (
              <button
                type="button"
                onClick={() => void selectAllMatching()}
                disabled={loadingAll}
                className="min-h-11 rounded-xl px-3 text-sm font-semibold text-gold-light underline disabled:opacity-60"
              >
                {loadingAll ? 'Marcando…' : `Seleccionar las ${total} del filtro`}
              </button>
            )}
            {branchId === undefined ? (
              <span className="text-sm text-white/70">Elige una sucursal en el filtro para asignar.</span>
            ) : (
              <>
                <select
                  aria-label="Asignar a"
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  className="min-h-11 rounded-xl bg-white px-3 text-ink"
                >
                  <option value="">Asignar a…</option>
                  {auxiliaries.length > 1 && <option value="split">Repartir entre las {auxiliaries.length} auxiliares</option>}
                  {assignees.data?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name} ({ROLE_LABEL[a.role]})
                    </option>
                  ))}
                  <option value="none">— Quitar responsable</option>
                </select>
                <button
                  type="button"
                  disabled={!assignTo || selected.size === 0 || assign.isPending}
                  onClick={() => (isReassign ? setConfirming(true) : void doAssign())}
                  className="bg-gold-gradient min-h-11 rounded-xl px-5 font-semibold text-ink disabled:opacity-50"
                >
                  {assign.isPending ? 'Asignando…' : isReassign ? 'Reasignar' : 'Asignar'}
                </button>
              </>
            )}
            <button type="button" onClick={stopSelecting} className="ml-auto min-h-11 px-2 text-sm text-white/70 underline">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <Dialog open onOpenChange={(o) => !o && setConfirming(false)} title="¿Reasignar?" description={`Vas a ${targetLabel}.`}>
          <p className="text-sm text-ink/80">
            Se les quitan a quien las tiene hoy: <b>{ownersSummary(new Map(taken.map((o, i) => [String(i), o])))}</b>. Queda en el historial de cada ficha.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={() => void doAssign()}>
              Reasignar {selected.size}
            </Button>
          </div>
        </Dialog>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Páginas">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setSearch({ pagina: page - 1 > 1 ? page - 1 : undefined })}
            className="min-h-11 rounded-full px-5 font-semibold ring-1 ring-ink/15 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-ink/60">
            Página {page} de {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setSearch({ pagina: page + 1 })}
            className="min-h-11 rounded-full px-5 font-semibold ring-1 ring-ink/15 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </nav>
      )}
    </main>
  )
}

function Interest({ v }: { v: ProspectRow['interest'] }) {
  if (!v) return <span className="text-ink/30">—</span>
  return (
    <Badge tone={v === 'high' ? 'success' : v === 'medium' ? 'warning' : 'neutral'}>
      {INTEREST_LABEL[v]}
    </Badge>
  )
}

type Owner = { id: string | null; name: string | null }
type Selection = Map<string, Owner>
const ownerOf = (r: ProspectRow): Owner => ({ id: r.assigned_to, name: r.assigned_to_name })

/** "5 sin responsable · 8 de Ana · 3 de Luis" (los 3 con más; el resto como "otros"). */
function ownersSummary(sel: ReadonlyMap<string, Owner>): string {
  const by = new Map<string, number>()
  for (const o of sel.values()) {
    const k = o.id === null ? '' : (o.name ?? '¿?')
    by.set(k, (by.get(k) ?? 0) + 1)
  }
  const parts = [...by.entries()].sort((a, b) => b[1] - a[1])
  const text = parts.slice(0, 3).map(([k, n]) => (k === '' ? `${n} sin responsable` : `${n} de ${k}`))
  const rest = parts.slice(3).reduce((t, [, n]) => t + n, 0)
  return [...text, ...(rest ? [`${rest} de otros`] : [])].join(' · ')
}

type SelectProps = { selecting: boolean; selected: ReadonlyMap<string, Owner>; onToggle: (id: string) => void; onContact: (id: string) => void }

/** Sin responsable: directo el botón "Seguimiento" (abre el registro de contacto; quien lo registra queda como responsable). */
function Assigned({ r, onContact }: { r: ProspectRow; onContact?: (id: string) => void }) {
  if (r.assigned_to_name) return <span>{r.assigned_to_name}</span>
  if (!onContact || r.stage === 'sale' || r.stage === 'lost') return <span className="text-ink/30">—</span>
  return (
    <button
      type="button"
      onClick={() => onContact(r.id)}
      aria-label={`Seguimiento a ${r.full_name}`}
      className="inline-flex whitespace-nowrap rounded-full bg-ink px-3 py-1 text-xs font-semibold text-gold-light active:bg-charcoal"
    >
      Seguimiento
    </button>
  )
}

/** Registro de contacto sobre la misma tabla: trae la ficha y abre el mismo modal que en Mis contactos. */
function ContactDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useClient(id)
  const toast = useToast()
  const failed = q.isError ? (q.error as Error).message : null
  useEffect(() => {
    if (!failed) return
    toast(failed, 'error')
    onClose()
  }, [failed, toast, onClose])
  if (!q.data) return null
  return <ResultDialog row={followupRowOf(q.data.prospect)} onClose={onClose} />
}

function StageCell({ r }: { r: ProspectRow }) {
  return (
    <span className="whitespace-nowrap">
      {STAGE_LABEL[r.stage] ?? r.stage}
      {r.contact_attempts > 0 && r.stage !== 'lost' && (
        <span className="text-xs text-ink/45"> · {r.contact_attempts}/3</span>
      )}
      {r.visit_at && (
        <span className="block text-xs font-semibold text-gold-dark">
          Pasará {fmtDate(r.visit_at)} {fmtTime(r.visit_at)}
        </span>
      )}
    </span>
  )
}

function ProspectsTable({
  rows,
  showBranch,
  selecting,
  selected,
  onToggle,
  onContact,
  allSelected,
  onToggleAll,
}: {
  rows: ProspectRow[]
  showBranch: boolean
  allSelected: boolean
  onToggleAll: () => void
} & SelectProps) {
  const headers = ['Fecha', 'Cliente', 'Producto', 'Canal', ...(showBranch ? ['Sucursal'] : []), 'Registrado por', 'Etapa', 'Responsable']
  return (
    <div className="hidden overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5 md:block">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="bg-ink text-gold-light">
          <tr>
            {selecting && (
              <th scope="col" className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todas"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="h-4 w-4 accent-gold"
                />
              </th>
            )}
            {headers.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={selecting ? () => onToggle(r.id) : undefined}
              className={`border-t border-ink/5 align-top ${selected.has(r.id) ? 'bg-gold/10' : 'even:bg-cream/60'} ${selecting ? 'cursor-pointer' : ''}`}
            >
              {selecting && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${r.full_name}`}
                    checked={selected.has(r.id)}
                    onChange={() => onToggle(r.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 accent-gold"
                  />
                </td>
              )}
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                {fmtDate(r.client_created_at)}
                <span className="block text-xs text-ink/50">{fmtTime(r.client_created_at)}</span>
              </td>
              <td className="px-4 py-3">
                {selecting ? (
                  <span className="font-semibold">{r.full_name}</span>
                ) : (
                  <Link to="/cliente/$id" params={{ id: r.id }} className="font-semibold hover:text-gold-dark hover:underline">
                    {r.full_name}
                  </Link>
                )}
                <span className="block tabular-nums text-ink/60">{r.phone_raw}</span>
              </td>
              <td className="px-4 py-3">
                {r.product_name ?? <span className="text-ink/30">—</span>}
                {r.interest && (
                  <span className="mt-1 block">
                    <Interest v={r.interest} />
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                {r.channel_name ?? <span className="text-ink/30">—</span>}
                {r.channel_detail && <span className="block text-xs text-ink/55">{r.channel_detail}</span>}
              </td>
              {showBranch && <td className="px-4 py-3">{r.branch_name}</td>}
              <td className="px-4 py-3">
                <span className="font-medium">{r.created_by_name}</span>
                <span className="block text-xs text-ink/45">{ROLE_LABEL[r.created_by_role]}</span>
              </td>
              <td className="px-4 py-3">
                <StageCell r={r} />
              </td>
              <td className="px-4 py-3">
                <Assigned r={r} onContact={selecting ? undefined : onContact} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProspectsCards({
  rows,
  showBranch,
  selecting,
  selected,
  onToggle,
  onContact,
}: { rows: ProspectRow[]; showBranch: boolean } & SelectProps) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {rows.map((r) => (
        <li
          key={r.id}
          onClick={selecting ? () => onToggle(r.id) : undefined}
          className={`rounded-3xl p-4 shadow-sm ring-1 ${selected.has(r.id) ? 'bg-gold/10 ring-gold/40' : 'bg-white ring-ink/5'} ${selecting ? 'cursor-pointer' : ''}`}
        >
          <div className="flex items-start justify-between gap-3">
            {selecting && (
              <input
                type="checkbox"
                aria-label={`Seleccionar ${r.full_name}`}
                checked={selected.has(r.id)}
                onChange={() => onToggle(r.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 h-5 w-5 shrink-0 accent-gold"
              />
            )}
            <div className="min-w-0 flex-1">
              {selecting ? (
                <p className="font-semibold">{r.full_name}</p>
              ) : (
                <Link to="/cliente/$id" params={{ id: r.id }} className="font-semibold hover:text-gold-dark hover:underline">
                  {r.full_name}
                </Link>
              )}
              <p className="tabular-nums text-ink/70">{r.phone_raw}</p>
            </div>
            <Interest v={r.interest} />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink/60">
            <span
              className={`rounded-full px-3 py-0.5 font-semibold ${r.channel_name ? 'bg-ink text-gold-light' : 'bg-sand text-ink/45'}`}
            >
              Canal: {r.channel_name ?? 'sin canal'}
            </span>
            {r.channel_detail && <span className="text-ink/70">{r.channel_detail}</span>}
            {[r.product_name, showBranch ? r.branch_name : null].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-2 border-t border-ink/5 pt-2 text-sm text-ink/55">
            <span className="tabular-nums">
              {fmtDate(r.client_created_at)} {fmtTime(r.client_created_at)}
            </span>{' '}
            · {r.created_by_name} ({ROLE_LABEL[r.created_by_role]})
          </p>
          <div className="mt-1 flex flex-wrap justify-between gap-2 text-sm">
            <StageCell r={r} />
            <Assigned r={r} onContact={selecting ? undefined : onContact} />
          </div>
        </li>
      ))}
    </ul>
  )
}
