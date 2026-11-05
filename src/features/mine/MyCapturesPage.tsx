import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { fmtDate, fmtTime, INTEREST_LABEL, STAGE_LABEL } from '@/features/prospects/format'
import { periodRange } from '@/features/prospects/search'
import { db, type OutboxRow } from '@/features/sync/db'
import { onSyncEvent } from '@/features/sync/syncLoop'
import { toAppError } from '@/lib/errors'
import { normalizeText } from '@/lib/search'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/ui/Badge'
import { PageTitle } from '@/ui/PageTitle'

type Mine = {
  id: string
  full_name: string
  phone_raw: string
  product_name: string | null
  channel_name: string | null
  channel_detail: string | null
  interest: 'high' | 'medium' | 'low' | null
  occupation: string | null
  address: string | null
  client_created_at: string
  stage: string
  status: 'active' | 'duplicate_rejected'
  assigned_to_me: boolean
  assigned_to_name: string | null
}

type Period = 'hoy' | 'ayer' | '7d' | 'mes'
const PERIODS: { value: Period; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'ayer', label: 'Ayer' },
  { value: '7d', label: '7 días' },
  { value: 'mes', label: 'Este mes' },
]

/** Lo que aún no llegó al servidor (sin señal): se muestra arriba para que la persona sepa que no se perdió. */
function usePending(userId: string): OutboxRow[] {
  const [rows, setRows] = useState<OutboxRow[]>([])
  useEffect(() => {
    const load = () => void db.outbox.where('userId').equals(userId).toArray().then(setRows)
    load()
    return onSyncEvent(load)
  }, [userId])
  return rows
}

/** Mis registros: la auxiliar ve solo lo que ella registró, con en qué quedó cada uno. */
export function MyCapturesPage() {
  const { profile } = useAuth()
  const userId = profile!.id
  const [period, setPeriod] = useState<Period>('hoy')
  const [query, setQuery] = useState('')
  const { from, to } = periodRange({ periodo: period })
  const pending = usePending(userId)

  const q = useQuery({
    queryKey: ['my-captures', userId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_captures', { p_from: from, p_to: to })
      if (error) throw toAppError(error)
      return data as Mine[]
    },
  })

  // Cuando se sube algo pendiente, aparece en la lista sin recargar.
  const { refetch } = q
  useEffect(() => onSyncEvent(() => void refetch()), [refetch])

  const rows = useMemo(() => {
    const words = normalizeText(query).split(/\s+/).filter(Boolean)
    if (!words.length) return q.data ?? []
    return (q.data ?? []).filter((r) => {
      const hay = normalizeText(`${r.full_name} ${r.phone_raw}`)
      return words.every((w) => hay.includes(w))
    })
  }, [q.data, query])
  const saved = (q.data ?? []).filter((r) => r.status === 'active').length
  const repeated = (q.data ?? []).length - saved

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 sm:px-6">
      <PageTitle title="Mis registros" subtitle={`${profile!.full_name} · solo lo que registraste tú`} />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={period === p.value}
            onClick={() => setPeriod(p.value)}
            className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${
              period === p.value ? 'bg-gold-gradient text-ink shadow-gold' : 'bg-white text-ink/70 ring-1 ring-ink/10 active:bg-sand'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        aria-label="Buscar por nombre o celular"
        placeholder="Buscar por nombre o celular"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 outline-none focus:border-gold focus:ring-4 focus:ring-gold/20"
      />

      <section className="bg-ink-gradient flex items-center justify-between gap-4 rounded-3xl p-5 text-white" aria-label="Resumen">
        <div>
          <p className="font-display text-5xl font-bold tabular-nums text-gold-light" data-testid="my-total">
            {saved}
          </p>
          <p className="text-white/60">{saved === 1 ? 'registro guardado' : 'registros guardados'}</p>
        </div>
        {repeated > 0 && <p className="text-right text-sm text-white/60">{repeated} repetido{repeated === 1 ? '' : 's'} (ya existían)</p>}
      </section>

      {pending.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Pendientes de subir">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-gold-dark">Por subir · {pending.length}</h2>
          {pending.map((p) => (
            <article key={p.id} className="rounded-3xl bg-gold/10 p-4 ring-1 ring-gold/30">
              <p className="font-semibold">{p.payload.full_name}</p>
              <p className="text-sm text-ink/60">
                <span className="tabular-nums">{p.payload.phone}</span> · {fmtTime(p.payload.client_created_at)} · se sube solo al tener señal
              </p>
            </article>
          ))}
        </section>
      )}

      {q.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">No se pudo cargar. {(q.error as Error).message}</p>
      ) : q.isPending ? (
        <p className="p-8 text-center text-ink/45">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">
          {query ? 'Nada con esa búsqueda.' : 'No registraste clientes en este período.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id} data-testid="my-capture" className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {r.assigned_to_me && r.status === 'active' ? (
                    <Link to="/cliente/$id" params={{ id: r.id }} className="font-semibold hover:text-gold-dark hover:underline">
                      {r.full_name}
                    </Link>
                  ) : (
                    <p className="font-semibold">{r.full_name}</p>
                  )}
                  <p className="tabular-nums text-ink/70">{r.phone_raw}</p>
                </div>
                {r.status === 'duplicate_rejected' ? (
                  <Badge tone="danger">Repetido</Badge>
                ) : (
                  <Badge tone={r.stage === 'sale' ? 'success' : r.stage === 'lost' ? 'danger' : 'neutral'}>{STAGE_LABEL[r.stage] ?? r.stage}</Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-ink/60">
                {[
                  r.channel_name && `${r.channel_name}${r.channel_detail ? ` · ${r.channel_detail}` : ''}`,
                  r.product_name,
                  r.interest && `Interés ${INTEREST_LABEL[r.interest].toLowerCase()}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="mt-2 flex flex-wrap justify-between gap-2 border-t border-ink/5 pt-2 text-sm text-ink/55">
                <span className="tabular-nums">
                  {fmtDate(r.client_created_at)} {fmtTime(r.client_created_at)}
                </span>
                {r.status === 'active' && (
                  <span>{r.assigned_to_me ? 'Lo atiendes tú' : r.assigned_to_name ? `Lo atiende ${r.assigned_to_name}` : 'Sin asignar'}</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
