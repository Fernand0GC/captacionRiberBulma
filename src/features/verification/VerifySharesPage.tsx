import { useMemo, useState } from 'react'
import { laPazDate, SHIFT_LABEL } from '@/lib/dates'
import { addDays, daysBetween } from '@/features/organization/logic'
import { Button } from '@/ui/Button'
import { PageTitle } from '@/ui/PageTitle'
import { useToast } from '@/ui/Toast'
import { useShareList, useVerifyShares, type ShareRow } from './api'

const MAX_DAYS = 31
const NOTE_MAX = 300
const dm = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)
const when = (iso: string) =>
  new Date(iso).toLocaleString('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const asText = (n: number | null) => (n === null ? '' : String(n))

/** '' = sin verificar; undefined = número inválido. */
function parseVerified(raw: string): number | null | undefined {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 && n <= 9999 ? n : undefined
}

/** Una asignación con compartidas: Cobros anota cuántas verificó y un comentario (FR-013). */
function ShareCard({ r }: { r: ShareRow }) {
  const toast = useToast()
  const save = useVerifyShares()
  const [verified, setVerified] = useState(asText(r.share_verified))
  const [note, setNote] = useState(r.share_verified_note ?? '')
  const [err, setErr] = useState<string>()
  const dirty = verified !== asText(r.share_verified) || note.trim() !== (r.share_verified_note ?? '')

  async function submit() {
    const n = parseVerified(verified)
    if (n === undefined) return setErr('Escribe un número entero entre 0 y 9999 (vacío = sin verificar).')
    if (note.trim().length > NOTE_MAX) return setErr(`El comentario admite hasta ${NOTE_MAX} caracteres.`)
    setErr(undefined)
    try {
      await save.mutateAsync({ id: r.id, verified: n, note })
      toast(n === null ? 'Verificación quitada' : '✓ Verificación guardada', 'success')
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const hours = r.start_time ? `${r.start_time}${r.end_time ? `–${r.end_time}` : ''}` : SHIFT_LABEL[r.shift]
  return (
    <li className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5" data-testid="share-row">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{r.person}</p>
          <p className="text-sm text-ink/60">
            {dm(r.work_date)} · {hours} · {r.branch}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-dark">
            {r.channel}
            {r.subchannel ? ` · ${r.subchannel}` : ''}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 text-right text-sm tabular-nums">
          <dt className="text-ink/50">Meta</dt>
          <dd className="font-semibold">{r.share_goal ?? '—'}</dd>
          <dt className="text-ink/50">Reportado</dt>
          <dd className="font-semibold" data-testid="share-reported">
            {r.share_result ?? 'pendiente'}
          </dd>
        </dl>
      </div>
      <div className="grid grid-cols-[8rem_1fr] gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
          Verificadas
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            value={verified}
            placeholder="—"
            onChange={(e) => setVerified(e.target.value)}
            className="min-h-11 rounded-xl border border-ink/15 bg-white px-3 text-lg font-normal outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink/70">
          Comentario
          <input
            value={note}
            maxLength={NOTE_MAX + 50}
            placeholder="Opcional"
            onChange={(e) => setNote(e.target.value)}
            className="min-h-11 rounded-xl border border-ink/15 bg-white px-3 text-base font-normal outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
          />
        </label>
      </div>
      {err && <p className="text-sm font-medium text-rb-red">{err}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink/55" data-testid="share-verified-by">
          {r.share_verified !== null && r.share_verified_by_name && r.share_verified_at
            ? `Verificó ${r.share_verified_by_name} el ${when(r.share_verified_at)}`
            : 'Sin verificar'}
        </p>
        <Button className="min-h-10 px-4 text-sm" disabled={!dirty || save.isPending} onClick={() => void submit()}>
          {save.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </li>
  )
}

/**
 * Verificar compartidas (spec 006, US4): Cobros ve las asignaciones con compartidas de sus sucursales y anota cuántas
 * verificó. La base decide qué sucursales ve cada uno (can_verify_shares); gerencia y Sistemas, todas.
 */
export function VerifySharesPage() {
  const today = laPazDate(new Date())
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [branch, setBranch] = useState('')
  const rangeOk = daysBetween(from, to) >= 0 && daysBetween(from, to) < MAX_DAYS
  const q = useShareList(from, to, rangeOk)
  const branches = q.data?.branches ?? []
  const rows = useMemo(() => (q.data?.rows ?? []).filter((r) => !branch || String(r.branch_id) === branch), [q.data, branch])
  const pending = rows.filter((r) => r.share_verified === null).length

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6">
      <PageTitle title="Verificar compartidas" subtitle="Compartidas que reportó ventas, para verificar" />

      <section className="flex flex-wrap items-end gap-2 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-ink/5" aria-label="Período">
        <label className="flex flex-col text-xs font-semibold text-ink/60">
          Desde
          <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="min-h-11 rounded-xl border border-ink/15 px-2 text-base" />
        </label>
        <label className="flex flex-col text-xs font-semibold text-ink/60">
          Hasta
          <input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="min-h-11 rounded-xl border border-ink/15 px-2 text-base" />
        </label>
        <div className="flex gap-1">
          <Button variant="ghost" className="min-h-11 text-sm" onClick={() => { setFrom(today); setTo(today) }}>
            Hoy
          </Button>
          <Button variant="ghost" className="min-h-11 text-sm" onClick={() => { setFrom(addDays(today, -1)); setTo(addDays(today, -1)) }}>
            Ayer
          </Button>
          <Button variant="ghost" className="min-h-11 text-sm" onClick={() => { setFrom(addDays(today, -6)); setTo(today) }}>
            7 días
          </Button>
        </div>
        {branches.length > 1 && (
          <label className="flex flex-col text-xs font-semibold text-ink/60">
            Sucursal
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="min-h-11 rounded-xl border border-ink/15 bg-white px-2 text-base">
              <option value="">Todas</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      {!rangeOk && <p className="rounded-2xl bg-rb-red/10 p-3 text-rb-red">Elige un rango de hasta {MAX_DAYS} días, con «Hasta» después de «Desde».</p>}

      {q.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">{(q.error as Error).message}</p>
      ) : q.isLoading ? (
        <p className="p-6 text-center text-ink/50">Cargando…</p>
      ) : q.data && branches.length === 0 ? (
        <p className="rounded-3xl bg-amber-50 p-6 text-center text-amber-900 ring-1 ring-amber-200" data-testid="shares-no-branches">
          No tienes sucursales asignadas. Pide a Sistemas que te las asigne.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5" data-testid="shares-empty">
          No hay compartidas en estas fechas.
        </p>
      ) : (
        <>
          <p className="px-1 text-ink/60">
            <span className="font-display text-2xl font-bold text-ink">{rows.length}</span> {rows.length === 1 ? 'asignación' : 'asignaciones'} ·{' '}
            {pending} sin verificar
          </p>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rows.map((r) => (
              <ShareCard key={r.id} r={r} />
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
