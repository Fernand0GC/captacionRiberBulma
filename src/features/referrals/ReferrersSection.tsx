import { useState } from 'react'
import { Card } from '@/features/dashboard/charts'
import { fmtDate } from '@/features/prospects/format'
import { laPazDate } from '@/lib/dates'
import { digits, NUMERIC_INPUT } from '@/lib/numeric'
import { normalizeText } from '@/lib/search'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useToast } from '@/ui/Toast'
import {
  mergeReferrer,
  saveReferralGoals,
  saveReferrer,
  useOwnGoals,
  useReferralMutation,
  useReferralReport,
  useReferrers,
  type Referrer,
  type ReportRow,
} from './api'
import { inView, KIND_LABEL, KINDS, monthLabel, monthStart, previousMonth, type ReferrerKind, type ReferrerView as View } from './logic'
import { inputCls, th, type ReferralScope } from './parts'

// Referidores y metas (spec 005 US3 + spec 014 US7): alta, edición, buscador, filtro, unir, copiar y editar metas.

type Draft = { name: string; kind: ReferrerKind; sort: string; active: boolean; goal: string }

const goalNumber = (s: string) => (s.trim() === '' ? null : Number(s))
const validGoal = (s: string) => s.trim() === '' || (/^\d{1,4}$/.test(s.trim()) && Number(s) <= 9999)

function ReferrerRow({
  r,
  row,
  month,
  branch,
  onMerge,
}: {
  r: Referrer
  row: ReportRow | undefined
  month: string
  branch: number
  onMerge: (r: Referrer) => void
}) {
  const toast = useToast()
  const ownGoal = row && row.goal_from === month ? row.goal : null
  const initial: Draft = { name: r.name, kind: r.kind, sort: String(r.sort), active: r.active, goal: ownGoal === null ? '' : String(ownGoal) }
  const [d, setD] = useState<Draft>(initial)
  const save = useReferralMutation(async (v: Draft) => {
    if (v.name !== r.name || v.kind !== r.kind || Number(v.sort) !== r.sort || v.active !== r.active) {
      await saveReferrer({ id: r.id, branch_id: branch, name: v.name.trim(), kind: v.kind, sort: Number(v.sort) || 0, active: v.active })
    }
    if (v.goal !== initial.goal) await saveReferralGoals({ branch_id: branch, month, referrers: [{ id: r.id, goal: goalNumber(v.goal) }] })
  })
  const dirty = JSON.stringify(d) !== JSON.stringify(initial)
  const inherited = row && row.goal !== null && row.goal_from !== month

  const onSave = async () => {
    if (!validGoal(d.goal)) return toast('La meta debe ser un número entre 0 y 9999.', 'error')
    try {
      await save.mutateAsync(d)
      toast('✓ Referidor guardado', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <tr className={`border-b border-ink/5 ${d.active ? '' : 'text-ink/45'}`} data-testid={`referrer-edit-${r.name}`}>
      <td className="py-2 pr-2">
        <input aria-label="Nombre" maxLength={60} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className={`${inputCls} w-full min-w-40`} />
        {r.source === 'capture' && (
          <p className="mt-1 text-xs text-gold-dark" data-testid={`referrer-source-${r.name}`}>
            Agregado en el registro{r.creator ? ` por ${r.creator.full_name}` : ''}
            {r.created_at ? ` · ${fmtDate(r.created_at)}` : ''}
          </p>
        )}
      </td>
      <td className="py-2 pr-2">
        <select aria-label="Tipo" value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as ReferrerKind })} className={inputCls}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-2">
        <input aria-label="Orden" {...NUMERIC_INPUT} value={d.sort} onChange={(e) => setD({ ...d, sort: digits(e.target.value) })} className={`${inputCls} w-16`} />
      </td>
      <td className="py-2 pr-2">
        <input
          aria-label={`Meta de ${r.name}`}
          {...NUMERIC_INPUT}
          placeholder={inherited ? String(row.goal) : '—'}
          value={d.goal}
          onChange={(e) => setD({ ...d, goal: digits(e.target.value) })}
          className={`${inputCls} w-20`}
        />
        {inherited && d.goal === '' && <span className="block text-xs text-ink/45">de {monthLabel(row.goal_from ?? month)}</span>}
      </td>
      <td className="py-2 pr-2">
        <input aria-label="Activo" type="checkbox" className="h-5 w-5 accent-gold-dark" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} />
      </td>
      <td className="py-2">
        <div className="flex gap-1.5">
          <Button variant="secondary" className="min-h-10 px-3 text-sm" disabled={!dirty || save.isPending} onClick={() => void onSave()}>
            Guardar
          </Button>
          <Button variant="secondary" className="min-h-10 px-3 text-sm" onClick={() => onMerge(r)}>
            Unir con…
          </Button>
        </div>
      </td>
    </tr>
  )
}

function MergedRow({ r, into }: { r: Referrer; into: string | undefined }) {
  return (
    <tr className="border-b border-ink/5 text-ink/50" data-testid={`referrer-merged-${r.name}`}>
      <td className="py-2 pr-2 font-semibold" colSpan={4}>
        {r.name}
        <span className="block text-xs font-normal">
          Unido a <b>{into ?? 'otro referidor'}</b>: lo que se registre con este nombre se guarda en {into ?? 'el otro'}.
        </span>
      </td>
      <td className="py-2 pr-2" colSpan={2}>
        {KIND_LABEL[r.kind]}
      </td>
    </tr>
  )
}

function MergeDialog({
  from,
  candidates,
  onClose,
}: {
  from: Referrer | null
  candidates: Referrer[]
  onClose: () => void
}) {
  const toast = useToast()
  const [into, setInto] = useState('')
  const merge = useReferralMutation(mergeReferrer)
  const options = candidates.filter((c) => from && c.id !== from.id && c.merged_into == null)
  const target = options.find((c) => String(c.id) === into)

  const onConfirm = async () => {
    if (!from || !target) return
    try {
      await merge.mutateAsync({ from_id: from.id, into_id: target.id })
      toast(`✓ «${from.name}» quedó unido a «${target.name}»`, 'success')
      setInto('')
      onClose()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <Dialog
      open={from !== null}
      onOpenChange={(o) => !o && onClose()}
      title={`Unir «${from?.name ?? ''}» con…`}
      description="Para nombres repetidos de la misma persona (ej.: «Fernanda» y «Contacto Fernanda»)."
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
          Queda como
          <select aria-label="Unir con" value={into} onChange={(e) => setInto(e.target.value)} className={inputCls}>
            <option value="">Elige el referidor que queda…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.active ? '' : ' (desactivado)'}
              </option>
            ))}
          </select>
        </label>
        {target && from && (
          <ul className="list-disc rounded-2xl bg-cream/70 py-3 pl-8 pr-3 text-sm text-ink/70" data-testid="merge-summary">
            <li>
              Los clientes de «{from.name}» pasan a «{target.name}» (queda en el historial de cada ficha).
            </li>
            <li>Sus metas pasan a «{target.name}» solo en los meses en que no tenía meta.</li>
            <li>
              «{from.name}» queda desactivado y no se puede deshacer desde la app. Si alguien lo escribe al registrar, se guarda en «
              {target.name}».
            </li>
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!target || merge.isPending} onClick={() => void onConfirm()}>
            {merge.isPending ? 'Uniendo…' : 'Unir'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function NewReferrer({ branch, month }: { branch: number; month: string }) {
  const toast = useToast()
  const [d, setD] = useState({ name: '', kind: 'staff' as ReferrerKind, goal: '' })
  const create = useReferralMutation(async (v: typeof d) => {
    const id = await saveReferrer({ branch_id: branch, name: v.name.trim(), kind: v.kind, sort: 0, active: true })
    if (v.goal.trim() !== '') await saveReferralGoals({ branch_id: branch, month, referrers: [{ id, goal: goalNumber(v.goal) }] })
  })

  const onAdd = async () => {
    if (d.name.trim().length < 2) return toast('Escribe el nombre del referidor.', 'error')
    if (!validGoal(d.goal)) return toast('La meta debe ser un número entre 0 y 9999.', 'error')
    try {
      await create.mutateAsync(d)
      toast('✓ Referidor agregado', 'success')
      setD({ name: '', kind: d.kind, goal: '' })
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <div role="group" aria-label="Agregar referidor" className="flex flex-wrap items-end gap-2 rounded-2xl bg-cream/70 p-3">
      <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-ink/70">
        Nuevo referidor
        <input maxLength={60} value={d.name} placeholder="Ej.: Contacto Fernanda" onChange={(e) => setD({ ...d, name: e.target.value })} className={`${inputCls} min-w-48`} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
        Tipo
        <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as ReferrerKind })} className={inputCls}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
        Meta del mes
        <input {...NUMERIC_INPUT} value={d.goal} placeholder="—" onChange={(e) => setD({ ...d, goal: digits(e.target.value) })} className={`${inputCls} w-24`} />
      </label>
      <Button className="min-h-10" disabled={create.isPending} onClick={() => void onAdd()}>
        Agregar
      </Button>
    </div>
  )
}

/** Todas las metas del mes juntas (FR-017): una sola operación al guardar. */
function BulkGoals({ list, rows, month, branch, onDone }: { list: Referrer[]; rows: ReportRow[]; month: string; branch: number; onDone: () => void }) {
  const toast = useToast()
  const own = (id: number) => {
    const r = rows.find((x) => x.id === id)
    return r && r.goal_from === month && r.goal !== null ? String(r.goal) : ''
  }
  const [goals, setGoals] = useState<Record<number, string>>(() => Object.fromEntries(list.map((r) => [r.id, own(r.id)])))
  const save = useReferralMutation(saveReferralGoals)
  const changed = list.filter((r) => (goals[r.id] ?? '') !== own(r.id))

  const onSave = async () => {
    if (changed.some((r) => !validGoal(goals[r.id] ?? ''))) return toast('Las metas deben ser números entre 0 y 9999.', 'error')
    try {
      await save.mutateAsync({ branch_id: branch, month, referrers: changed.map((r) => ({ id: r.id, goal: goalNumber(goals[r.id] ?? '') })) })
      toast(`✓ ${changed.length} ${changed.length === 1 ? 'meta guardada' : 'metas guardadas'}`, 'success')
      onDone()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="bulk-goals">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => {
          const row = rows.find((x) => x.id === r.id)
          const inherited = row && row.goal !== null && row.goal_from !== month ? row.goal : null
          return (
            <label key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-cream/60 px-3 py-2 text-sm font-semibold">
              <span className="truncate">{r.name}</span>
              <input
                aria-label={`Meta en bloque de ${r.name}`}
                {...NUMERIC_INPUT}
                placeholder={inherited === null ? '—' : String(inherited)}
                value={goals[r.id] ?? ''}
                onChange={(e) => setGoals({ ...goals, [r.id]: digits(e.target.value) })}
                className={`${inputCls} w-20`}
              />
            </label>
          )
        })}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button disabled={changed.length === 0 || save.isPending} onClick={() => void onSave()}>
          {save.isPending ? 'Guardando…' : `Guardar metas${changed.length ? ` (${changed.length})` : ''}`}
        </Button>
      </div>
    </div>
  )
}

export function ReferrersSection({ s }: { s: ReferralScope }) {
  const toast = useToast()
  const branch = s.branch
  const monthInput = s.search.mes ?? laPazDate(new Date()).slice(0, 7)
  const month = monthStart(monthInput)
  const prevMonth = monthStart(previousMonth(monthInput))
  const list = useReferrers(branch)
  const report = useReferralReport(branch, month)
  const prevGoals = useOwnGoals(branch, prevMonth)
  const [q, setQ] = useState('')
  const [view, setView] = useState<View>('todos')
  const [merging, setMerging] = useState<Referrer | null>(null)
  const [bulk, setBulk] = useState(false)
  const copy = useReferralMutation(saveReferralGoals)

  if (branch === undefined) {
    return (
      <Card title="Referidores y metas" subtitle="Los referidores son de cada sucursal.">
        <p className="text-ink/60">Elige una sucursal arriba para ver y editar sus referidores.</p>
      </Card>
    )
  }
  if (list.isError || report.isError) {
    return <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">{(list.error ?? report.error)?.message}</p>
  }
  const rows = report.data?.month === month ? report.data.referrers : undefined
  const all = list.data ?? []
  const needle = normalizeText(q.trim())
  const shown = all.filter((r) => inView(r, view) && (!needle || normalizeText(r.name).includes(needle)))
  const counts: Record<View, number> = {
    todos: all.filter((r) => inView(r, 'todos')).length,
    registro: all.filter((r) => inView(r, 'registro')).length,
    desactivados: all.filter((r) => inView(r, 'desactivados')).length,
    unidos: all.filter((r) => inView(r, 'unidos')).length,
  }
  const editable = all.filter((r) => r.active && r.merged_into == null)

  // Copiar: a los activos sin meta propia este mes, la meta vigente del mes anterior (propia o arrastrada).
  const toCopy = rows
    ? editable
        .map((r) => ({ r, cur: rows.find((x) => x.id === r.id), prev: prevGoals.data?.find((x) => x.id === r.id)?.goal ?? null }))
        .filter((x) => x.prev !== null && !(x.cur && x.cur.goal_from === month))
    : []
  const onCopy = async () => {
    try {
      await copy.mutateAsync({ branch_id: branch, month, referrers: toCopy.map((x) => ({ id: x.r.id, goal: x.prev })) })
      toast(`✓ ${toCopy.length} ${toCopy.length === 1 ? 'meta copiada' : 'metas copiadas'} de ${monthLabel(prevMonth)}`, 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <Card title="Referidores y metas" subtitle={`${s.branchName ?? ''} · meta de contactos que llegan en ${monthLabel(month)}. Vacía = usa la del mes anterior.`}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
          Mes de las metas
          <input
            type="month"
            aria-label="Mes de las metas"
            value={monthInput}
            onChange={(e) => e.target.value && s.setSearch({ mes: e.target.value })}
            className={inputCls}
          />
        </label>
        <Button variant="secondary" className="min-h-10" disabled={toCopy.length === 0 || copy.isPending} onClick={() => void onCopy()}>
          Copiar metas de {monthLabel(prevMonth).split(' ')[0]}
          {toCopy.length ? ` (${toCopy.length})` : ''}
        </Button>
        <Button variant="secondary" className="min-h-10" disabled={editable.length === 0 || !rows} onClick={() => setBulk(!bulk)}>
          {bulk ? 'Volver a la lista' : 'Editar todas las metas'}
        </Button>
      </div>

      {bulk && rows ? (
        <BulkGoals key={`${branch}|${month}`} list={editable} rows={rows} month={month} branch={branch} onDone={() => setBulk(false)} />
      ) : (
        <>
          <NewReferrer branch={branch} month={month} />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              aria-label="Buscar referidor"
              placeholder="Buscar referidor…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={`${inputCls} min-w-56 flex-1`}
            />
            <div className="flex flex-wrap rounded-full bg-white p-1 ring-1 ring-ink/10" role="group" aria-label="Mostrar">
              {(
                [
                  ['todos', 'Todos'],
                  ['registro', 'Agregados en el registro'],
                  ['desactivados', 'Desactivados'],
                  ['unidos', 'Unidos'],
                ] as [View, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`min-h-9 rounded-full px-3 text-sm font-semibold ${view === v ? 'bg-ink text-gold-light' : 'text-ink/60'}`}
                >
                  {label} <span className="tabular-nums opacity-70">{counts[v]}</span>
                </button>
              ))}
            </div>
          </div>
          {!list.data || !rows ? (
            <p className="text-ink/45">Cargando…</p>
          ) : shown.length === 0 ? (
            <p className="text-ink/50">{all.length === 0 ? 'Todavía no hay referidores en esta sucursal.' : 'Ningún referidor con este filtro.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-ink/50">
                    {['Nombre', 'Tipo', 'Orden', 'Meta', 'Activo', ''].map((h) => (
                      <th key={h} scope="col" className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    if (r.merged_into != null) return <MergedRow key={r.id} r={r} into={all.find((x) => x.id === r.merged_into)?.name} />
                    const row = rows.find((x) => x.id === r.id)
                    // La key incluye lo guardado: al refrescar, la fila arranca de nuevo con los valores del servidor.
                    return (
                      <ReferrerRow
                        key={`${r.id}|${month}|${r.name}|${r.kind}|${r.sort}|${r.active}|${row?.goal_from ?? ''}|${row?.goal ?? ''}`}
                        r={r}
                        row={row}
                        month={month}
                        branch={branch}
                        onMerge={setMerging}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <MergeDialog from={merging} candidates={all} onClose={() => setMerging(null)} />
    </Card>
  )
}
