import { useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { ROLE_LABEL } from '@/features/auth/types'
import { useBranches } from '@/features/prospects/api'
import { laPazDate } from '@/lib/dates'
import { Button } from '@/ui/Button'
import { PageTitle } from '@/ui/PageTitle'
import { useToast } from '@/ui/Toast'
import { equalQuotas, useDistribute, usePreview, type Person } from './api'

function addDays(iso: string, d: number): string {
  const x = new Date(`${iso}T12:00:00Z`)
  x.setUTCDate(x.getUTCDate() + d)
  return x.toISOString().slice(0, 10)
}

function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" aria-label={`Menos a ${label}`} onClick={() => onChange(Math.max(0, value - 1))} className="h-10 w-10 rounded-full text-xl ring-1 ring-ink/15 active:bg-sand">
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        aria-label={`Recibirá ${label}`}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="h-10 w-16 rounded-xl border border-ink/15 text-center font-display text-xl font-bold tabular-nums"
      />
      <button type="button" aria-label={`Más a ${label}`} onClick={() => onChange(value + 1)} className="h-10 w-10 rounded-full text-xl ring-1 ring-ink/15 active:bg-sand">
        +
      </button>
    </div>
  )
}

/** Reparto de la tarde: vista previa con la carga de cada persona y cupos ajustables (FR-039b). */
export function DistributePage() {
  const { profile } = useAuth()
  const toast = useToast()
  const isGlobal = profile?.role === 'general_manager' || profile?.role === 'admin'
  const branches = useBranches()
  const [branchSel, setBranchSel] = useState<number | undefined>(undefined)
  const branch = isGlobal ? branchSel : (profile?.branch_id ?? undefined)
  const today = laPazDate(new Date())
  const [day, setDay] = useState(today)
  const [includeOlder, setIncludeOlder] = useState(false)
  const args = branch ? { branch, from: day, to: day, includeOlder } : null
  const preview = usePreview(args)
  const distribute = useDistribute()

  // Cupos editables; se recalculan en partes iguales cuando cambia lo que hay para repartir.
  const [quotas, setQuotas] = useState<Record<string, number> | null>(null)
  const [quotasFor, setQuotasFor] = useState('')
  const key = preview.data ? `${branch}|${day}|${includeOlder}|${preview.data.total}` : ''
  if (preview.data && key !== quotasFor) {
    setQuotasFor(key)
    setQuotas(equalQuotas(preview.data.total, preview.data.people))
  }

  const total = preview.data?.total ?? 0
  const people: Person[] = preview.data?.people ?? []
  const sum = Object.values(quotas ?? {}).reduce((a, b) => a + b, 0)
  const over = sum - total

  async function confirm() {
    if (!args || !quotas) return
    try {
      const res = await distribute.mutateAsync({ ...args, quotas })
      toast(`✓ ${res.assigned} captaciones repartidas`, 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const branchName = branches.data?.find((b) => b.id === branch)?.name

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-5 sm:px-6">
      <PageTitle title="Repartir" subtitle={branchName ? `Captaciones sin asignar · ${branchName}` : 'Captaciones sin asignar'} />

      <section className="flex flex-wrap items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5" aria-label="Qué repartir">
        {isGlobal && (
          <select aria-label="Sucursal" value={branchSel ?? ''} onChange={(e) => setBranchSel(e.target.value ? Number(e.target.value) : undefined)} className="min-h-11 rounded-xl border border-ink/15 bg-white px-3">
            <option value="">Elegir sucursal…</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-1 rounded-full bg-sand p-1" role="group" aria-label="Día">
          {[
            { v: today, label: 'Hoy' },
            { v: addDays(today, -1), label: 'Ayer' },
          ].map((o) => (
            <button key={o.label} type="button" aria-pressed={day === o.v} onClick={() => setDay(o.v)} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${day === o.v ? 'bg-ink text-gold-light' : 'text-ink/60'}`}>
              {o.label}
            </button>
          ))}
        </div>
        <input type="date" aria-label="Fecha" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} className="min-h-10 rounded-xl border border-ink/15 px-2" />
        <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-ink/75">
          <input type="checkbox" checked={includeOlder} onChange={(e) => setIncludeOlder(e.target.checked)} className="h-5 w-5 accent-gold" />
          Incluir sin asignar de días anteriores
        </label>
      </section>

      {!branch ? (
        <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">Elige una sucursal para repartir.</p>
      ) : preview.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">{(preview.error as Error).message}</p>
      ) : (
        <>
          <section className="bg-ink-gradient flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 text-white">
            <div>
              <p className="font-display text-5xl font-bold text-gold-light tabular-nums" data-testid="pool-total">
                {total}
              </p>
              <p className="text-white/60">sin asignar para repartir</p>
            </div>
            {preview.data && preview.data.by_author.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Por quién captó">
                {preview.data.by_author.map((a) => (
                  <li key={a.name} className="rounded-full bg-white/10 px-3 py-1 text-sm">
                    {a.name} · <strong className="tabular-nums">{a.n}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2" aria-label="Quién recibe">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-display text-lg font-semibold">¿Cuántas recibe cada uno?</h2>
              <button type="button" onClick={() => setQuotas(equalQuotas(total, people))} className="text-sm font-semibold text-gold-dark underline">
                Partes iguales
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {people.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/5" data-testid={`person-${p.full_name}`}>
                  <div className="min-w-0">
                    <p className="font-semibold">{p.full_name}</p>
                    <p className="text-sm text-ink/55">
                      {ROLE_LABEL[p.role]} · ya tiene <strong>{p.pending_today}</strong> para hoy ({p.assigned_total} en total)
                    </p>
                  </div>
                  <Stepper label={p.full_name} value={quotas?.[p.id] ?? 0} onChange={(n) => setQuotas((q) => ({ ...(q ?? {}), [p.id]: n }))} />
                </li>
              ))}
              {people.length === 0 && <li className="rounded-2xl bg-white p-4 text-ink/50">No hay auxiliares activas en esta sucursal.</li>}
            </ul>
          </section>

          <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-ink/10">
            <p className="text-ink/70" aria-live="polite">
              <strong className="tabular-nums text-ink">{sum}</strong> de <strong className="tabular-nums text-ink">{total}</strong>
              {over > 0 ? (
                <span className="ml-2 font-semibold text-rb-red">te pasaste por {over}</span>
              ) : over < 0 ? (
                <span className="ml-2 text-ink/50">quedan {-over} sin repartir</span>
              ) : null}
            </p>
            <Button disabled={total === 0 || sum === 0 || over > 0 || distribute.isPending} onClick={() => void confirm()}>
              {distribute.isPending ? 'Repartiendo…' : `Repartir ${Math.min(sum, total)}`}
            </Button>
          </div>
        </>
      )}
    </main>
  )
}
