import { useState } from 'react'
import { ROLE_LABEL, type AppRole } from '@/features/auth/types'
import { Card, StatTile } from '@/features/dashboard/charts'
import { Button } from '@/ui/Button'
import { useToast } from '@/ui/Toast'
import { useReferralRange, useReferrerFollowup } from './api'
import { AskDialog } from './AskDialog'
import {
  actorRows,
  agoLabel,
  ASK_METHOD_LABEL,
  ASK_RESULT_LABEL,
  branchRows,
  dayOf,
  daysAgo,
  keptPct,
  pct,
  perAsk,
  referrerRows,
  shortDate,
  todayList,
  totalsOf,
  VERDICT_LABEL,
  type FollowupData,
  type FollowupReferrer,
  type Motive,
  type Verdict,
} from './asks'
import { KIND_LABEL, rangeLabel } from './logic'
import { Tabs, td, th, type ReferralScope } from './parts'
import { ReferrerDetailDialog } from './ReferrerDetailDialog'

// Pestaña «Seguimiento» (spec 017): el único lugar para pedir referidos y medir esos pedidos.
// 1) Para hoy  2) cuatro tarjetas  3) una tabla con «Ver por» (referidor, sucursal, quién pide) y Excel.

const roleLabel = (role: string) => ROLE_LABEL[role as AppRole] ?? role
const dec = (n: number | null) => (n === null ? '—' : n.toFixed(1).replace('.', ','))
const MOTIVE_TONE: Record<Motive['tone'], string> = {
  amber: 'bg-amber-100 text-amber-900 ring-amber-300',
  gold: 'bg-gold/15 text-gold-dark ring-gold/30',
  muted: 'bg-ink/5 text-ink/60 ring-ink/10',
  red: 'bg-rb-red/10 text-rb-red ring-rb-red/20',
}
const VERDICT_TONE: Record<Verdict, string> = {
  insiste: 'bg-rb-red/10 text-rb-red ring-rb-red/20',
  sin_pedir: 'bg-amber-100 text-amber-900 ring-amber-300',
  regular: 'bg-ink/5 text-ink/60 ring-ink/10',
  quit: 'bg-ink/5 text-ink/45 ring-ink/10',
  rinde: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
}
/** «Para hoy» muestra primero los más urgentes; el resto con «Ver los N». */
const TODAY_LIMIT = 8
const chip = 'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1'

type Ask = { ids: number[]; multi: boolean } | null

export function SeguimientoSection({ s }: { s: ReferralScope }) {
  const q = useReferrerFollowup({ branch_id: s.branch, from: s.range.from, to: s.range.to })
  const [ask, setAsk] = useState<Ask>(null)
  const [detail, setDetail] = useState<FollowupReferrer | null>(null)

  if (q.isError) return <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">{q.error.message}</p>
  if (!q.data) return <p className="text-ink/45">Cargando…</p>
  const d = q.data
  const many = d.branches.length > 1
  const branchName = (id: number) => d.branches.find((b) => b.id === id)?.name ?? ''
  const askable = d.referrers.filter((r) => r.active && r.last_ask?.result !== 'quit')

  return (
    <div className="flex flex-col gap-5">
      <TodayCard d={d} many={many} branchName={branchName} onAsk={(ids, multi) => setAsk({ ids, multi })} onOpen={setDetail} />
      <Tiles d={d} />
      <ResultTable d={d} s={s} many={many} branchName={branchName} onOpen={setDetail} />
      {ask && (
        <AskDialog
          candidates={ask.multi ? askable : d.referrers.filter((r) => ask.ids.includes(r.id))}
          initial={ask.ids}
          multi={ask.multi}
          today={d.today}
          onClose={() => setAsk(null)}
        />
      )}
      {detail && <Detail referrer={detail} d={d} s={s} branchName={branchName} onClose={() => setDetail(null)} />}
    </div>
  )
}

/** Ventana del referidor (016) con sus referidos del período y su historial de pedidos. */
function Detail({ referrer, d, s, branchName, onClose }: { referrer: FollowupReferrer; d: FollowupData; s: ReferralScope; branchName: (id: number) => string; onClose: () => void }) {
  const range = useReferralRange({ branch_id: referrer.branch_id, from: d.from, to: d.to })
  return (
    <ReferrerDetailDialog
      name={referrer.name}
      subtitle={`${KIND_LABEL[referrer.kind]} · ${branchName(referrer.branch_id)} · ${rangeLabel(d.from, d.to)}`}
      list={(range.data?.contacts ?? []).filter((c) => c.referrer_id === referrer.id)}
      onClose={onClose}
      referrerId={referrer.id}
      branchId={s.branch ?? referrer.branch_id}
    />
  )
}

function TodayCard({
  d,
  many,
  branchName,
  onAsk,
  onOpen,
}: {
  d: FollowupData
  many: boolean
  branchName: (id: number) => string
  onAsk: (ids: number[], multi: boolean) => void
  onOpen: (r: FollowupReferrer) => void
}) {
  const list = todayList(d.referrers, d.today)
  const [all, setAll] = useState(false)
  const shown = all ? list : list.slice(0, TODAY_LIMIT)
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/5" aria-label="Para hoy">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            Para hoy <span className="tabular-nums text-ink/45">{list.length}</span>
          </h2>
          <p className="text-sm text-ink/50">A quién pedirle referidos hoy. Primero las promesas que no se cumplieron.</p>
        </div>
        <Button variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => onAsk(list.map((x) => x.r.id), true)}>
          Pedir a varios
        </Button>
      </header>
      {list.length === 0 ? (
        <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">✓ Al día: no hay a quién pedirle hoy.</p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {shown.map(({ r, m }) => {
            const l = r.last_ask
            return (
              <li key={r.id} data-testid={`today-${r.name}`} className="flex items-center justify-between gap-3 rounded-2xl bg-cream/70 p-3 ring-1 ring-ink/5">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => onOpen(r)} className="truncate text-left font-semibold underline decoration-gold/40 underline-offset-4">
                      {r.name}
                    </button>
                    <span className={`${chip} ${MOTIVE_TONE[m.tone]}`}>{m.text}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-ink/55">
                    {KIND_LABEL[r.kind]}
                    {many && ` · ${branchName(r.branch_id)}`}
                    {l && ` · último: ${ASK_METHOD_LABEL[l.method].toLowerCase()}, ${ASK_RESULT_LABEL[l.result].toLowerCase()}`}
                    {!r.phone && <span className="text-rb-red"> · sin celular</span>}
                  </span>
                </span>
                <Button variant="dark" className="min-h-11 shrink-0 px-4 text-sm" onClick={() => onAsk([r.id], false)}>
                  Pedir
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {list.length > TODAY_LIMIT && (
        <Button variant="ghost" className="min-h-10 self-start px-3 text-sm text-gold-dark" onClick={() => setAll((v) => !v)}>
          {all ? 'Ver menos' : `Ver los ${list.length}`}
        </Button>
      )}
    </section>
  )
}

function Tiles({ d }: { d: FollowupData }) {
  const { now, prev } = totalsOf(d)
  const delta = now.asks - prev.asks
  const kp = keptPct(now)
  const pa = perAsk(now)
  const ppa = perAsk(prev)
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="followup-kpis">
      <StatTile accent label="Pedidos hechos" value={now.asks} hint={`${delta > 0 ? '+' : ''}${delta} vs. período anterior`} />
      <StatTile label="Cobertura" value={`${pct(now.covered, now.active)}%`} hint={`se pidió a ${now.covered} de ${now.active} referidores`} />
      <StatTile
        label="Promesas cumplidas"
        value={kp === null ? '—' : `${kp}%`}
        hint={now.kept + now.expired ? `${now.kept} de ${now.kept + now.expired} pasaron contactos en 7 días` : 'sin promesas vencidas'}
      />
      <StatTile label="Llegados por pedido" value={dec(pa)} hint={ppa === null ? `${now.arrived} llegados ÷ ${now.asks} pedidos` : `${dec(ppa)} el período anterior`} />
    </div>
  )
}

function ResultTable({
  d,
  s,
  many,
  branchName,
  onOpen,
}: {
  d: FollowupData
  s: ReferralScope
  many: boolean
  branchName: (id: number) => string
  onOpen: (r: FollowupReferrer) => void
}) {
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  const by = s.search.ver === 'sucursal' && many ? 'sucursal' : s.search.ver === 'quien' ? 'quien' : 'referidor'
  const items = [{ v: 'referidor' as const, label: 'Referidor' }, ...(many ? [{ v: 'sucursal' as const, label: 'Sucursal' }] : []), { v: 'quien' as const, label: 'Quién pide' }]
  const { now } = totalsOf(d)

  const onExport = async () => {
    setExporting(true)
    try {
      const { exportFollowup } = await import('./exportReferrals')
      await exportFollowup(d, { scopeName: s.branchName ?? '', roleLabel })
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card
      title="Resultado de los pedidos"
      subtitle={
        by === 'referidor'
          ? 'Arriba lo que necesita atención. Tocar el nombre abre su historial.'
          : by === 'sucursal'
            ? 'Toca una sucursal para ver solo esa.'
            : 'Los pedidos que registró cada persona y los referidores nuevos que sumó.'
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink/60">Ver por</span>
        <Tabs label="Ver por" value={by} items={items} onChange={(v) => s.setSearch({ ver: v === 'referidor' ? undefined : v })} />
        <Button variant="secondary" className="ml-auto min-h-10 px-4 text-sm" disabled={exporting} onClick={() => void onExport()}>
          {exporting ? 'Descargando…' : 'Excel'}
        </Button>
      </div>
      <div className="overflow-x-auto">
        {by === 'referidor' ? (
          <table className="w-full min-w-[46rem] text-left text-sm" aria-label="Pedidos por referidor">
            <thead>
              <tr className="border-b border-ink/10 text-ink/50">
                {['Referidor', 'Pedidos', 'Respondió', 'Último pedido', 'Volver a pedir', 'Llegados', 'Estado'].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {referrerRows(d).map(({ r, s: x, verdict, next }) => {
                const lastDay = r.last_ask ? dayOf(r.last_ask.at) : null
                return (
                  <tr key={r.id} className="border-b border-ink/5" data-testid={`followup-row-${r.name}`}>
                    <td className="py-2 pr-3">
                      <button type="button" onClick={() => onOpen(r)} className="text-left font-semibold underline decoration-gold/40 underline-offset-4 hover:text-gold-dark">
                        {r.name}
                      </button>
                      <span className="block text-xs text-ink/45">
                        {KIND_LABEL[r.kind]}
                        {many && ` · ${branchName(r.branch_id)}`}
                      </span>
                    </td>
                    <td className={`${td} font-semibold`}>{x.asks}</td>
                    <td className={td}>{x.asks ? `${x.answered} de ${x.asks}` : '—'}</td>
                    <td className={td}>{lastDay ? agoLabel(daysAgo(lastDay, d.today)) : <span className="text-ink/45">Nunca</span>}</td>
                    <td className={td}>
                      {verdict === 'quit' || next === null ? '—' : next <= d.today ? <span className="font-semibold text-rb-red">Hoy</span> : shortDate(next)}
                    </td>
                    <td className={`${td} font-semibold`}>{x.arrived}</td>
                    <td className="py-2">
                      <span className={`${chip} ${VERDICT_TONE[verdict]}`}>{VERDICT_LABEL[verdict]}</span>
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-ink/15 font-bold">
                <td className="py-2 pr-3">Total</td>
                <td className={td}>{now.asks}</td>
                <td className={td}>{now.asks ? `${now.answered} de ${now.asks}` : '—'}</td>
                <td />
                <td />
                <td className={td}>{now.arrived}</td>
                <td />
              </tr>
            </tbody>
          </table>
        ) : by === 'sucursal' ? (
          <table className="w-full min-w-[46rem] text-left text-sm" aria-label="Pedidos por sucursal">
            <thead>
              <tr className="border-b border-ink/10 text-ink/50">
                {['Sucursal', 'Referidores activos', 'Cobertura', 'Pedidos', 'Respondió', 'Promesas cumplidas', 'Llegados por pedido'].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {branchRows(d).map((b) => {
                const cov = pct(b.covered, b.active)
                const kp = keptPct(b)
                return (
                  <tr key={b.id} className="border-b border-ink/5" data-testid={`followup-branch-${b.name}`}>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => s.setSearch({ sucursal: b.id, todas: undefined, ver: undefined }, { push: true })}
                        className="text-left font-semibold underline decoration-gold/40 underline-offset-4 hover:text-gold-dark"
                      >
                        {b.name}
                      </button>
                    </td>
                    <td className={td}>{b.active}</td>
                    <td className={td}>
                      <span className={cov < 60 ? 'font-semibold text-rb-red' : ''}>{cov}%</span>{' '}
                      <span className="text-xs text-ink/45">
                        {b.covered} de {b.active}
                      </span>
                    </td>
                    <td className={`${td} font-semibold`}>{b.asks}</td>
                    <td className={td}>{b.asks ? `${b.answered} de ${b.asks}` : '—'}</td>
                    <td className={td}>{kp === null ? '—' : `${kp}%`}</td>
                    <td className={`${td} font-semibold`}>{dec(perAsk(b))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[46rem] text-left text-sm" aria-label="Pedidos por quién pide">
            <thead>
              <tr className="border-b border-ink/10 text-ink/50">
                {['Persona', 'Sucursales', 'Pedidos', 'A cuántos referidores', 'Respondieron', 'Referidores nuevos', 'Último pedido'].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actorRows(d).map((a) => (
                <tr key={a.id} className="border-b border-ink/5" data-testid={`followup-actor-${a.name}`}>
                  <td className="py-2 pr-3">
                    <span className="font-semibold">{a.name}</span>
                    <span className="block text-xs text-ink/45">{roleLabel(a.role)}</span>
                  </td>
                  <td className="py-2 pr-3">{a.branch_ids.length ? a.branch_ids.map(branchName).join(', ') : '—'}</td>
                  <td className={`${td} font-semibold`}>
                    {a.asks || <span className={`${chip} bg-rb-red/10 text-rb-red ring-rb-red/20`}>No registra pedidos</span>}
                  </td>
                  <td className={td}>{a.referrers}</td>
                  <td className={td}>{a.asks ? `${a.answered} de ${a.asks}` : '—'}</td>
                  <td className={td}>{a.added}</td>
                  <td className={td}>{a.last_day ? agoLabel(daysAgo(a.last_day, d.today)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {by === 'referidor' && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink/55">
          <span className={`${chip} ${VERDICT_TONE.rinde}`}>Rinde</span> 1 referido o más por pedido
          <span className={`${chip} ${VERDICT_TONE.regular}`}>Regular</span> menos de 1
          <span className={`${chip} ${VERDICT_TONE.insiste}`}>Insistes y no llega</span> 3 pedidos o más y ningún referido
          <span className={`${chip} ${VERDICT_TONE.sin_pedir}`}>Sin pedir</span> nadie le pidió en el período
        </p>
      )}
    </Card>
  )
}
