import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { useBranchScope } from '@/features/auth/useBranchScope'
import { ROLE_LABEL } from '@/features/auth/types'
import { totalsByGroup } from '@/features/capture/channelGroups'
import { useBranches, useChannels } from '@/features/prospects/api'
import { STAGE_LABEL } from '@/features/prospects/format'
import { periodRange, type Period } from '@/features/prospects/search'
import { PageTitle } from '@/ui/PageTitle'
import { useMetrics } from './api'
import { useDailyReport } from '@/features/monitoring/api'
import { useGoalsForDay } from '@/features/goals/api'
import { GoalProgress } from '@/features/goals/GoalProgress'
import { todaySubtitle } from '@/features/goals/logic'
import { Card, DayColumns, HBars, InlineBar, StatTile } from './charts'

const PERIODS: { v: Period; label: string }[] = [
  { v: 'hoy', label: 'Hoy' },
  { v: '7d', label: '7 días' },
  { v: 'mes', label: 'Este mes' },
  { v: 'rango', label: 'Rango' },
]
const FUNNEL = ['capture', 'recapture', 'followup', 'interested', 'sale', 'lost'] as const
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')
const dayLabel = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** Panel de métricas para encargado, gerente y Sistemas (pantalla inicial de gestión). */
export function DashboardPage() {
  const { profile } = useAuth()
  const scope = useBranchScope()
  const isGlobal = scope.canPick
  const [period, setPeriod] = useState<Period>('hoy')
  const [branchSel, setBranch] = useState<number | undefined>(undefined)
  const branch = branchSel ?? scope.fallback
  const branches = useBranches()
  const channels = useChannels()
  // Rango propio (mismo patrón que Gestión): periodRange corrige «Hasta» si queda antes de «Desde».
  const [desde, setDesde] = useState<string | undefined>(undefined)
  const [hasta, setHasta] = useState<string | undefined>(undefined)
  const { from, to } = periodRange({ periodo: period, desde, hasta })
  const m = useMetrics({ from, to, branch_id: isGlobal ? branch : undefined })
  // Clientes distintos con seguimiento en el período (spec 009, US4): misma regla que «Del día», sin listas.
  const followed = useDailyReport({ from, to, branch_id: isGlobal ? branch : undefined, lists: false })
  const goals = useGoalsForDay(isGlobal ? branch : undefined)
  const hasGoals = !!goals.data && Object.values(goals.data.goals).some((v) => v !== null)
  const k = m.data?.kpis
  const branchName = isGlobal
    ? branch
      ? branches.data?.find((b) => b.id === branch)?.name
      : 'Todas las sucursales'
    : branches.data?.find((b) => b.id === profile?.branch_id)?.name

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6">
      <PageTitle
        title="Panel"
        subtitle={branchName}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isGlobal && (
              <select
                aria-label="Sucursal"
                value={branch ?? ''}
                onChange={(e) => setBranch(e.target.value ? Number(e.target.value) : undefined)}
                className="min-h-10 rounded-full border border-ink/15 bg-white px-3 text-sm"
              >
                {scope.allowAll && <option value="">Todas las sucursales</option>}
                {scope.options?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex rounded-full bg-white p-1 ring-1 ring-ink/10" role="group" aria-label="Período">
              {PERIODS.map((p) => (
                <button
                  key={p.v}
                  type="button"
                  aria-pressed={period === p.v}
                  onClick={() => setPeriod(p.v)}
                  className={`min-h-9 rounded-full px-4 text-sm font-semibold ${period === p.v ? 'bg-ink text-gold-light' : 'text-ink/60'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {period === 'rango' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Desde"
                  value={from}
                  onChange={(e) => setDesde(e.target.value || undefined)}
                  className="min-h-10 rounded-xl border border-ink/15 bg-white px-2 text-sm"
                />
                <span className="text-ink/40">a</span>
                <input
                  type="date"
                  aria-label="Hasta"
                  value={to}
                  min={from}
                  onChange={(e) => setHasta(e.target.value || undefined)}
                  className="min-h-10 rounded-xl border border-ink/15 bg-white px-2 text-sm"
                />
              </div>
            )}
          </div>
        }
      />

      {m.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">No se pudo cargar. {(m.error as Error).message}</p>
      ) : !k || !m.data ? (
        <p className="p-8 text-center text-ink/45">Cargando…</p>
      ) : (
        <>
          <Card title="Metas de hoy" subtitle={goals.data ? todaySubtitle(goals.data) : undefined}>
            {!goals.data ? (
              <p className="text-ink/45">Cargando…</p>
            ) : hasGoals ? (
              <GoalProgress data={goals.data} />
            ) : (
              <p className="text-ink/50">
                No hay metas para hoy.{' '}
                <Link to="/metas" className="font-semibold text-gold-dark underline">
                  Poner metas →
                </Link>
              </p>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7" data-testid="kpis">
            <StatTile accent label="Captaciones" value={k.captures} hint={`${pct(k.captures_sold, k.captures)} ya compró`} />
            <StatTile label="Contactos" value={k.contacts} hint={`${pct(k.effective, k.contacts)} efectivos`} />
            {period === 'hoy' ? (
              <Link
                to="/gestion"
                search={{ ver: 'dia', lista: 'seguimiento' }}
                className="rounded-3xl focus-visible:outline-2 focus-visible:outline-gold"
              >
                <StatTile
                  label="Clientes con seguimiento"
                  value={followed.data?.totals.followed ?? '…'}
                  hint="clientes distintos · ver lista →"
                />
              </Link>
            ) : (
              <StatTile label="Clientes con seguimiento" value={followed.data?.totals.followed ?? '…'} hint="clientes distintos" />
            )}
            <StatTile label="Clientes potenciales" value={k.potential} hint="pasaron a etapa 4" />
            <StatTile label="Ventas" value={k.sales} hint="cerradas en el período" />
            <StatTile label="Visitas pactadas" value={k.visits} hint="para el período" />
            <Link to="/repartir" className="rounded-3xl focus-visible:outline-2 focus-visible:outline-gold">
              <StatTile label="Sin asignar" value={k.unassigned} hint={k.unassigned ? 'Repartir →' : 'todo repartido'} />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card title="Captaciones por día" subtitle="Registradas en el período">
              {m.data.by_day.length > 1 ? (
                <DayColumns data={m.data.by_day} label={dayLabel} />
              ) : (
                <p className="py-6 text-center text-ink/45">Elige “7 días”, “Este mes” o un rango de varios días para ver la evolución.</p>
              )}
            </Card>
            <Card title="Embudo" subtitle="Etapa actual de las captaciones del período">
              <HBars
                total={k.captures}
                muted={[`6. ${STAGE_LABEL.lost}`]}
                data={FUNNEL.map((s, i) => ({ label: `${i + 1}. ${STAGE_LABEL[s]}`, value: m.data!.funnel[s] }))}
              />
            </Card>
            <Card title="Por canal de captación" subtitle="Primero Calle y Tienda; abajo, cada canal">
              {m.data.by_channel.length ? (
                <>
                  <div data-testid="by-group">
                    <HBars
                      total={k.captures}
                      data={totalsByGroup(m.data.by_channel, (c) => channels.data?.find((x) => x.name === c.name)?.group ?? null)}
                    />
                  </div>
                  <hr className="border-ink/10" />
                  <HBars total={k.captures} data={m.data.by_channel.map((c) => ({ label: c.name, value: c.n }))} />
                </>
              ) : (
                <p className="text-ink/45">Sin captaciones en el período.</p>
              )}
            </Card>
            {m.data.by_branch && (
              <Card title="Por sucursal" subtitle="Captaciones del período (ventas en el detalle)">
                <HBars data={m.data.by_branch.map((b) => ({ label: b.name, value: b.captures, note: `${b.sales} ventas` }))} />
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
            <Card title="Quién captó" subtitle="Captaciones por persona y cuánto avanzaron">
              <RankTable
                head={['Captaciones', 'Contactadas', 'Ventas', 'Conversión']}
                rows={m.data.by_author.map((a) => ({
                  name: a.name,
                  role: a.role,
                  bar: a.captures,
                  cells: [a.captures, a.contacted, a.sales, pct(a.sales, a.captures)],
                }))}
                empty="Sin captaciones en el período."
              />
            </Card>
            <Card title="Auxiliares" subtitle="Contactos hechos en el período">
              <RankTable
                head={['Contactos', 'Efectivos', 'Visitas', 'Ventas']}
                rows={m.data.by_agent.map((a) => ({
                  name: a.name,
                  role: a.role,
                  bar: a.contacts,
                  cells: [a.contacts, `${a.effective} · ${pct(a.effective, a.contacts)}`, a.visits, a.sales],
                }))}
                empty="Sin contactos en el período."
              />
            </Card>
          </div>
        </>
      )}
    </main>
  )
}

function RankTable({
  head,
  rows,
  empty,
}: {
  head: string[]
  rows: { name: string; role: keyof typeof ROLE_LABEL; bar: number; cells: (string | number)[] }[]
  empty: string
}) {
  if (!rows.length) return <p className="text-ink/45">{empty}</p>
  const max = Math.max(...rows.map((r) => r.bar))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-ink/50">
            <th scope="col" className="py-2 pr-3 font-semibold">
              Persona
            </th>
            {head.map((h) => (
              <th key={h} scope="col" className="py-2 pr-3 text-right font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-ink/5 last:border-0">
              <td className="py-2.5 pr-3">
                <span className="font-semibold">{r.name}</span>
                <span className="block text-xs text-ink/45">{ROLE_LABEL[r.role]}</span>
                <InlineBar value={r.bar} max={max} />
              </td>
              {r.cells.map((c, i) => (
                <td key={i} className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
