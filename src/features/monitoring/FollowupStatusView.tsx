import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/ui/Badge'
import { PageTitle } from '@/ui/PageTitle'
import { METHOD_LABEL, RESULT_LABEL } from '@/features/followup/api'
import { fmtDate, fmtTime, INTEREST_LABEL, STAGE_LABEL } from '@/features/prospects/format'
import {
  fmtDay,
  ManageFilterBar,
  selectCls,
  useDebounced,
  ViewSwitch,
  type ManageScope,
} from '@/features/prospects/ManageFilterBar'
import type { AttemptsParam, InterestParam, StaleDays } from '@/features/prospects/search'
import { MONITORING_PAGE, useFollowupStatus, useLostReasons, type FollowupStatusFilters, type FollowupStatusRow } from './api'
import { FOLLOWUP_TABS, TAB_EMPTY } from './labels'
import { ExportButton } from './ExportButton'

const INTEREST_PARAM: Record<InterestParam, NonNullable<FollowupStatusFilters['interest']>> = {
  alto: 'high',
  medio: 'medium',
  bajo: 'low',
  sin: 'none',
}
const ATTEMPTS_PARAM: Record<AttemptsParam, NonNullable<FollowupStatusFilters['attempts']>> = {
  ninguno: '0',
  '1-2': '1-2',
  '3+': '3+',
}
const STALE_OPTIONS: StaleDays[] = [3, 7, 15, 30]

/** Vista Seguimientos de /gestion (FR-010…FR-018): en qué punto está cada cliente. */
export function FollowupStatusView({ scope }: { scope: ManageScope }) {
  const { search, setSearch, from, to, isGlobal, sucursal, scopeName } = scope
  // La búsqueda por nombre/celular vive solo en el estado de la pantalla, nunca en la URL (constitución IV).
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q.trim())
  const page = search.pagina ?? 1

  const filters: FollowupStatusFilters = {
    from,
    to,
    branch_id: isGlobal ? sucursal : undefined,
    created_by: search.autor,
    channel_id: search.canal === 'sin' ? 'none' : search.canal,
    assigned: search.responsable === 'sin' ? 'none' : search.responsable,
    q: qDebounced.length >= 2 ? qDebounced : undefined,
    tab: search.estado,
    interest: search.interes ? INTEREST_PARAM[search.interes] : undefined,
    attempts: search.intentos ? ATTEMPTS_PARAM[search.intentos] : undefined,
    overdue: search.vencidos,
    stale_days: search.sin_contacto,
    lost_reason_id: search.estado === 'sin_interes' ? search.motivo : undefined,
  }
  const status = useFollowupStatus(filters, page)
  const lostReasons = useLostReasons()
  const total = status.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / MONITORING_PAGE))
  const rows = status.data?.rows ?? []

  const emptyText = search.vencidos ? 'No hay clientes vencidos con estos filtros.' : TAB_EMPTY[search.estado ?? 'todos']

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <PageTitle
        title="Seguimientos"
        subtitle={scopeName}
        actions={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <ExportButton
              disabled={!total}
              run={async () => {
                const { exportFollowups } = await import('./exportFollowups')
                const n = await exportFollowups(filters, scopeName)
                return `✓ Excel descargado: ${n} clientes`
              }}
            />
            <ViewSwitch search={search} setSearch={setSearch} />
          </div>
        }
      />

      <ManageFilterBar
        scope={scope}
        q={q}
        setQ={setQ}
        show={{ search: true, author: true, assignee: true, channel: true }}
      >
        <select
          aria-label="Interés"
          className={selectCls}
          value={search.interes ?? ''}
          onChange={(e) => setSearch({ interes: (e.target.value || undefined) as InterestParam | undefined })}
        >
          <option value="">Interés: todos</option>
          <option value="alto">Alto</option>
          <option value="medio">Medio</option>
          <option value="bajo">Bajo</option>
          <option value="sin">Sin dato</option>
        </select>
        <select
          aria-label="No contestó seguidos"
          className={selectCls}
          value={search.intentos ?? ''}
          onChange={(e) => setSearch({ intentos: (e.target.value || undefined) as AttemptsParam | undefined })}
        >
          <option value="">No contestó: todos</option>
          <option value="ninguno">Ninguno</option>
          <option value="1-2">1 o 2 veces</option>
          <option value="3+">3 o más</option>
        </select>
        <select
          aria-label="Sin contacto hace más de"
          className={selectCls}
          value={search.sin_contacto ?? ''}
          onChange={(e) =>
            setSearch({ sin_contacto: e.target.value ? (Number(e.target.value) as StaleDays) : undefined })
          }
        >
          <option value="">Sin contacto: cualquiera</option>
          {STALE_OPTIONS.map((d) => (
            <option key={d} value={d}>
              Sin contacto hace más de {d} días
            </option>
          ))}
        </select>
        {search.estado === 'sin_interes' && (
          <select
            aria-label="Motivo"
            className={selectCls}
            value={search.motivo ?? ''}
            onChange={(e) => setSearch({ motivo: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">Motivo: todos</option>
            {lostReasons.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          aria-pressed={!!search.vencidos}
          onClick={() => setSearch({ vencidos: search.vencidos ? undefined : true })}
          className={`min-h-11 rounded-xl px-4 text-sm font-semibold ring-1 transition ${
            search.vencidos ? 'bg-gold-gradient text-ink ring-gold' : 'bg-white text-ink/70 ring-ink/15 active:bg-sand'
          }`}
        >
          Solo vencidos
        </button>
      </ManageFilterBar>

      {/* Pestañas por estado, con la cantidad según los demás filtros */}
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex w-max gap-2" role="tablist" aria-label="Estado del cliente">
          {[{ tab: undefined, label: 'Todos' }, ...FOLLOWUP_TABS].map((t) => {
            const active = search.estado === t.tab
            const n = status.data?.by_tab[t.tab ?? 'todos']
            return (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSearch({ estado: t.tab, motivo: undefined })}
                className={`min-h-10 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition ${
                  active ? 'bg-ink text-gold-light' : 'bg-white text-ink/70 ring-1 ring-ink/10 active:bg-sand'
                }`}
              >
                {t.label} <span className="tabular-nums opacity-70">{n ?? '…'}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <p className="text-ink/60">
          <span className="font-display text-3xl font-bold text-ink" data-testid="total">
            {total}
          </span>{' '}
          {total === 1 ? 'cliente' : 'clientes'} · registrados {from === to ? `el ${fmtDay(from)}` : `del ${fmtDay(from)} al ${fmtDay(to)}`}
        </p>
        {status.isFetching && <span className="text-sm text-ink/40">Actualizando…</span>}
      </div>

      {status.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">No se pudo cargar. {(status.error as Error).message}</p>
      ) : status.data && rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">{emptyText}</p>
      ) : (
        <>
          <StatusTable rows={rows} showBranch={isGlobal && sucursal === undefined} />
          <StatusCards rows={rows} />
        </>
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

export default FollowupStatusView

const dash = <span className="text-ink/30">—</span>

function Interest({ v }: { v: FollowupStatusRow['interest'] }) {
  if (!v) return dash
  return <Badge tone={v === 'high' ? 'success' : v === 'medium' ? 'warning' : 'neutral'}>{INTEREST_LABEL[v]}</Badge>
}

function daysLabel(n: number): string {
  if (n <= 0) return 'Hoy'
  return n === 1 ? '1 día' : `${n} días`
}

/** Observación del último contacto; si no dejó ninguna, el resultado (para que no quede un vacío engañoso). */
function NoteText({ r, clamp }: { r: FollowupStatusRow; clamp: 'one' | 'two' }) {
  const cls = clamp === 'one' ? 'block max-w-[18rem] truncate' : 'line-clamp-2'
  if (r.last_note) return <span className={cls} title={r.last_note}>{r.last_note}</span>
  if (r.last_result) return <span className={`${cls} italic text-ink/45`}>{RESULT_LABEL[r.last_result]}</span>
  return dash
}

function LastContact({ r }: { r: FollowupStatusRow }) {
  if (!r.last_contacted_at) return <span className="text-ink/40">Nunca</span>
  return (
    <span className="whitespace-nowrap">
      <span className="tabular-nums">
        {fmtDate(r.last_contacted_at)} {fmtTime(r.last_contacted_at)}
      </span>
      <span className="block text-xs text-ink/55">
        {r.last_method ? METHOD_LABEL[r.last_method] : ''}
        {r.last_result ? ` · ${RESULT_LABEL[r.last_result]}` : ''}
      </span>
    </span>
  )
}

function NextContact({ r }: { r: FollowupStatusRow }) {
  if (!r.next_contact_at) return dash
  return (
    <span className={`whitespace-nowrap tabular-nums ${r.overdue ? 'font-semibold text-gold-dark' : ''}`}>
      {fmtDate(r.next_contact_at)} {fmtTime(r.next_contact_at)}
      {r.overdue && <span className="block text-xs font-bold uppercase tracking-wide">Vencido</span>}
    </span>
  )
}

function StatusTable({ rows, showBranch }: { rows: FollowupStatusRow[]; showBranch: boolean }) {
  const headers = [
    'Cliente',
    ...(showBranch ? ['Sucursal'] : []),
    'Responsable',
    'Etapa',
    'Interés',
    'No contestó',
    'Contactos',
    'Último contacto',
    'Observación',
    'Próximo',
    'Sin contacto',
  ]
  return (
    <div className="hidden overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5 md:block">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <thead className="bg-ink text-gold-light">
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col" className="px-3 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              data-testid="status-row"
              className={`border-t border-ink/5 align-top ${r.overdue ? 'bg-gold/10' : 'even:bg-cream/60'}`}
            >
              <td className="px-3 py-3">
                <Link to="/cliente/$id" params={{ id: r.id }} className="font-semibold hover:text-gold-dark hover:underline">
                  {r.full_name}
                </Link>
              </td>
              {showBranch && <td className="px-3 py-3">{r.branch_name}</td>}
              <td className="px-3 py-3">{r.assigned_to_name ?? <span className="text-ink/40">Sin asignar</span>}</td>
              <td className="whitespace-nowrap px-3 py-3">
                {STAGE_LABEL[r.stage] ?? r.stage}
                {r.stage === 'lost' && r.lost_reason && <span className="block text-xs text-ink/50">{r.lost_reason}</span>}
              </td>
              <td className="px-3 py-3">
                <Interest v={r.interest} />
              </td>
              <td className="px-3 py-3 tabular-nums">{r.no_answer_streak}/3</td>
              <td className="px-3 py-3 tabular-nums">{r.contacts_total}</td>
              <td className="px-3 py-3">
                <LastContact r={r} />
              </td>
              <td className="px-3 py-3">
                <NoteText r={r} clamp="one" />
              </td>
              <td className="px-3 py-3">
                <NextContact r={r} />
              </td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums">{daysLabel(r.days_without_contact)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusCards({ rows }: { rows: FollowupStatusRow[] }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {rows.map((r) => (
        <li key={r.id} data-testid="status-card">
          <Link
            to="/cliente/$id"
            params={{ id: r.id }}
            className={`block rounded-3xl p-4 shadow-sm ring-1 active:bg-sand ${r.overdue ? 'bg-gold/10 ring-gold/40' : 'bg-white ring-ink/5'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{r.full_name}</p>
                <p className="text-sm text-ink/60">
                  {STAGE_LABEL[r.stage] ?? r.stage} · {r.assigned_to_name ?? 'Sin asignar'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Interest v={r.interest} />
                {r.overdue && <Badge tone="warning">Vencido</Badge>}
              </div>
            </div>
            <p className="mt-2 text-sm text-ink/80">
              <NoteText r={r} clamp="two" />
            </p>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-ink/5 pt-2 text-xs text-ink/55">
              <span className="tabular-nums">No contestó {r.no_answer_streak}/3</span>
              <span className="tabular-nums">
                {r.contacts_total} {r.contacts_total === 1 ? 'contacto' : 'contactos'}
              </span>
              <span>Sin contacto: {daysLabel(r.days_without_contact)}</span>
              {r.next_contact_at && (
                <span className="tabular-nums">
                  Próximo: {fmtDate(r.next_contact_at).slice(0, 5)} {fmtTime(r.next_contact_at)}
                </span>
              )}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
