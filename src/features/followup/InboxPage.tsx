import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { ROLE_LABEL } from '@/features/auth/types'
import { fmtDate, fmtTime } from '@/features/prospects/format'
import { PageTitle } from '@/ui/PageTitle'
import { METHOD_LABEL, RESULT_LABEL, useMyClosedContacts, useMyContacts, type ClosedRow, type FollowupRow } from './api'
import { DUE_ORDER, dueStatus, needsAttention, visitPassed, type DueKind, type DueStatus } from './dueStatus'
import { takePendingContact } from './lastAction'
import { PhoneMenu } from './PhoneMenu'
import { ResultDialog } from './ResultDialog'

type Tab = 'pending' | 'followup' | 'noanswer'

const STAGE_LABEL: Record<FollowupRow['stage'], string> = {
  capture: 'Captación',
  recapture: 'Recaptación',
  followup: 'Seguimiento',
  interested: 'Cliente potencial',
}


const INTEREST: Record<'high' | 'medium' | 'low', { label: string; cls: string; rank: number }> = {
  high: { label: 'Interés alto', cls: 'bg-emerald-600 text-white', rank: 0 },
  medium: { label: 'Interés medio', cls: 'bg-amber-200 text-amber-950', rank: 1 },
  low: { label: 'Interés bajo', cls: 'bg-ink/10 text-ink/60', rank: 2 },
}
const interestRank = (r: FollowupRow) => (r.interest ? INTEREST[r.interest].rank : 3)

function InterestTag({ v }: { v: FollowupRow['interest'] }) {
  if (!v) return null
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${INTEREST[v].cls}`}>{INTEREST[v].label}</span>
}

function Strikes({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${n} de 3 sin respuesta`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < n ? 'bg-rb-red' : 'bg-ink/15'}`} />
      ))}
    </span>
  )
}

const TONE: Record<DueKind, { badge: string; icon: string; row: string; card: string }> = {
  done: { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: '✓', row: 'bg-emerald-50/40 text-ink/60', card: 'bg-emerald-50/50 ring-emerald-200' },
  late: { badge: 'bg-rb-red text-white ring-rb-red', icon: '!', row: 'bg-rb-red/5', card: 'bg-rb-red/5 ring-rb-red/40' },
  now: { badge: 'bg-amber-100 text-amber-900 ring-amber-300', icon: '⚠', row: 'bg-amber-50', card: 'bg-amber-50 ring-amber-300' },
  soon: { badge: 'bg-sky-50 text-sky-900 ring-sky-300', icon: '⏰', row: 'bg-sky-50/60', card: 'bg-sky-50/60 ring-sky-200' },
  normal: { badge: 'bg-ink/5 text-ink/60 ring-ink/10', icon: '•', row: '', card: 'bg-white ring-ink/5' },
}

function Badge({ s }: { s: DueStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${TONE[s.kind].badge}`}>
      {TONE[s.kind].icon} {s.label}
    </span>
  )
}

function StatusBadge({ s }: { s: DueStatus }) {
  if (!s.next) return <Badge s={s} />
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Badge s={s} />
      <Badge s={s.next} />
    </span>
  )
}

function WhatDone({ r }: { r: FollowupRow | ClosedRow }) {
  if (!r.last_result) return <span className="text-ink/35">Sin contactar</span>
  return (
    <span>
      <span className="font-medium">{RESULT_LABEL[r.last_result]}</span>
      {r.last_method && <span className="text-ink/45"> ({METHOD_LABEL[r.last_method].toLowerCase()})</span>}
      {r.visit_at && <span className="block text-xs font-semibold text-gold-dark">Visita: {fmtDate(r.visit_at)} {fmtTime(r.visit_at)}</span>}
      {r.last_note && <span className="block text-xs italic text-ink/60">“{r.last_note}”</span>}
      {r.last_contacted_at && <span className="block text-xs text-ink/40">{fmtDate(r.last_contacted_at)} {fmtTime(r.last_contacted_at)}</span>}
    </span>
  )
}

type OnResult = (r: FollowupRow, visit?: 'came' | 'missed') => void

/** En una visita vencida: "¿vino?" con dos botones; si no, el botón normal de registrar. */
function ResultButtons({ r, now, onResult, big }: { r: FollowupRow; now: Date; onResult: OnResult; big?: boolean }) {
  const h = big ? 'min-h-11 rounded-2xl px-4' : 'min-h-10 rounded-xl px-3'
  if (visitPassed(r, now)) {
    return (
      <span className="flex flex-wrap items-center gap-2" role="group" aria-label="¿Vino a la tienda?">
        <span className="text-xs font-semibold text-ink/55">¿Vino?</span>
        <button type="button" onClick={() => onResult(r, 'came')} className={`${h} whitespace-nowrap bg-emerald-600 font-semibold text-white`}>
          Sí vino
        </button>
        <button type="button" onClick={() => onResult(r, 'missed')} className={`${h} whitespace-nowrap bg-white font-semibold text-rb-red ring-1 ring-rb-red/40`}>
          No vino
        </button>
      </span>
    )
  }
  return (
    <button type="button" onClick={() => onResult(r)} className={`bg-gold-gradient ${h} whitespace-nowrap font-semibold text-ink shadow-gold`}>
      {big ? 'Registrar contacto' : 'Registrar'}
    </button>
  )
}

function ContactsTable({ rows, tab, now, onResult }: { rows: FollowupRow[]; tab: Tab; now: Date; onResult: OnResult }) {
  const head = ['Estado', 'Cliente', 'Celular', 'Producto', tab === 'pending' ? 'Captado' : tab === 'noanswer' ? 'Intentos' : 'Qué se hizo', '']
  return (
    <div className="hidden overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5 md:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink text-gold-light">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3 font-semibold first:rounded-tl-3xl last:rounded-tr-3xl">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = dueStatus(r, now)
            return (
              <tr key={r.id} className={`border-t border-ink/5 align-top ${TONE[s.kind].row}`} data-testid="contact-row" data-status={s.kind}>
                <td className="px-4 py-3">
                  <StatusBadge s={s} />
                </td>
                <td className="px-4 py-3">
                  <Link to="/cliente/$id" params={{ id: r.id }} className="font-semibold text-ink hover:text-gold-dark hover:underline">
                    {r.full_name}
                  </Link>{' '}
                  <InterestTag v={r.interest} />
                  <span className="block text-xs text-ink/45">
                    {STAGE_LABEL[r.stage]} · {r.channel_name ?? 'Sin canal'}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <PhoneMenu id={r.id} name={r.full_name} phoneRaw={r.phone_raw} phoneNorm={r.phone_norm} />
                </td>
                <td className="px-4 py-3">{r.product_name ?? <span className="text-ink/30">—</span>}</td>
                <td className="px-4 py-3">
                  {tab === 'pending' ? (
                    <span>
                      {fmtDate(r.client_created_at)} {fmtTime(r.client_created_at)}
                      <span className="block text-xs text-ink/45">por {r.created_by_name}</span>
                    </span>
                  ) : tab === 'noanswer' ? (
                    <span className="flex flex-col gap-1">
                      <Strikes n={r.contact_attempts} />
                      <span className="text-xs text-ink/45">{r.contact_attempts} de 3 sin respuesta</span>
                    </span>
                  ) : (
                    <WhatDone r={r} />
                  )}
                </td>
                <td className="px-4 py-3">
                  <ResultButtons r={r} now={now} onResult={onResult} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ContactCards({ rows, tab, now, onResult }: { rows: FollowupRow[]; tab: Tab; now: Date; onResult: OnResult }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {rows.map((r) => {
        const s = dueStatus(r, now)
        return (
          <li
            key={r.id}
            data-testid="contact-card"
            data-status={s.kind}
            className={`flex flex-col gap-2 rounded-3xl p-4 shadow-sm ring-1 ${TONE[s.kind].card}`}
          >
            <div className="flex items-start justify-between gap-2">
              <Link to="/cliente/$id" params={{ id: r.id }} className="text-lg font-semibold leading-snug hover:underline">
                {r.full_name}
              </Link>
              <span className="flex shrink-0 items-center gap-2">
                <InterestTag v={r.interest} />
                {tab === 'noanswer' && <Strikes n={r.contact_attempts} />}
              </span>
            </div>
            <StatusBadge s={s} />
            <p className="text-sm text-ink/55">
              {[r.product_name, r.channel_name].filter(Boolean).join(' · ') || 'Sin producto'} · captó {r.created_by_name}
            </p>
            {tab === 'followup' && (
              <p className="text-sm">
                <WhatDone r={r} />
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <PhoneMenu id={r.id} name={r.full_name} phoneRaw={r.phone_raw} phoneNorm={r.phone_norm} />
              <ResultButtons r={r} now={now} onResult={onResult} big />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Cómo terminó el ciclo anterior: Completado (compró) o Interrumpido (no le interesó / no contestó). */
function ClosedBadge({ r }: { r: ClosedRow }) {
  const [label, cls] =
    r.stage === 'sale'
      ? ['✓ Ya compró', 'bg-emerald-50 text-emerald-700 ring-emerald-200']
      : r.lost_reason === 'No contesta (3 intentos)'
        ? ['No contestó 3 veces', 'bg-amber-50 text-amber-900 ring-amber-200']
        : ['Sin interés', 'bg-ink/5 text-ink/60 ring-ink/10']
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`}>{label}</span>
      <span className="text-xs text-ink/45">
        {r.stage === 'sale' ? 'Completado' : 'Interrumpido'} el {fmtDate(r.stage_changed_at)}
      </span>
    </span>
  )
}

function RegisterButton({ onClick, big }: { onClick: () => void; big?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-gold-gradient whitespace-nowrap font-semibold text-ink shadow-gold ${big ? 'min-h-11 rounded-2xl px-4' : 'min-h-10 rounded-xl px-3'}`}
    >
      {big ? 'Registrar contacto' : 'Registrar'}
    </button>
  )
}

/** Cerrados anteriores: se pueden volver a contactar; registrar abre un ciclo nuevo en la misma ficha. */
function ClosedList({ rows, onResult }: { rows: ClosedRow[]; onResult: (r: ClosedRow) => void }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink/80 text-gold-light">
            <tr>
              {['Cómo terminó', 'Cliente', 'Celular', 'Producto', 'Último contacto', ''].map((h, i) => (
                <th key={i} scope="col" className="px-4 py-3 font-semibold first:rounded-tl-3xl last:rounded-tr-3xl">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-ink/5 align-top" data-testid="closed-row">
                <td className="px-4 py-3">
                  <ClosedBadge r={r} />
                </td>
                <td className="px-4 py-3">
                  <Link to="/cliente/$id" params={{ id: r.id }} className="font-semibold text-ink hover:text-gold-dark hover:underline">
                    {r.full_name}
                  </Link>
                  <span className="block text-xs text-ink/45">{r.channel_name ?? 'Sin canal'}</span>
                </td>
                <td className="px-2 py-1.5">
                  <PhoneMenu id={r.id} name={r.full_name} phoneRaw={r.phone_raw} phoneNorm={r.phone_norm} />
                </td>
                <td className="px-4 py-3">{r.product_name ?? <span className="text-ink/30">—</span>}</td>
                <td className="px-4 py-3">
                  <WhatDone r={r} />
                </td>
                <td className="px-4 py-3">
                  <RegisterButton onClick={() => onResult(r)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} data-testid="closed-card" className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5">
            <div className="flex items-start justify-between gap-2">
              <Link to="/cliente/$id" params={{ id: r.id }} className="text-lg font-semibold leading-snug hover:underline">
                {r.full_name}
              </Link>
            </div>
            <ClosedBadge r={r} />
            <p className="text-sm text-ink/55">
              {[r.product_name, r.channel_name].filter(Boolean).join(' · ') || 'Sin producto'} · captó {r.created_by_name}
            </p>
            <div className="flex items-center justify-between gap-2">
              <PhoneMenu id={r.id} name={r.full_name} phoneRaw={r.phone_raw} phoneNorm={r.phone_norm} />
              <RegisterButton onClick={() => onResult(r)} big />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Mis contactos: Captados (sin contactar) / Recaptados (Seguimiento, No contestó), con lo resuelto hoy y lo que toca ahora en la misma tabla. */
export function InboxPage() {
  const { profile } = useAuth()
  const q = useMyContacts()
  const [tab, setTab] = useState<Tab>('pending')
  const [active, setActive] = useState<{ row: FollowupRow | ClosedRow; visit?: 'came' | 'missed' } | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const closedQ = useMyClosedContacts(showClosed)
  // El estado de cada fila (⚠ toca contactar) se recalcula cada minuto sin recargar.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const all = q.data ?? []

  // Al volver de WhatsApp (o si el celular recargó la app), se abre solo el registro del contacto que se abrió.
  useEffect(() => {
    if (!q.data) return
    const check = () => {
      if (document.visibilityState !== 'visible') return
      const p = takePendingContact()
      const row = p && (q.data.find((r) => r.id === p.id) ?? closedQ.data?.find((r) => r.id === p.id))
      if (row) setActive({ row })
    }
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [q.data, closedQ.data])

  const pending = all.filter((r) => !r.contacts_count)
  const recaptured = all.filter((r) => (r.contacts_count ?? 0) > 0)
  const followup = recaptured.filter((r) => r.stage === 'followup' || r.stage === 'interested')
  const noanswer = recaptured.filter((r) => r.stage === 'capture' || r.stage === 'recapture')
  const byTab: Record<Tab, FollowupRow[]> = { pending, followup, noanswer }
  const due = (rows: FollowupRow[]) => rows.filter((r) => needsAttention(dueStatus(r, now))).length
  const rows = byTab[tab]
    .slice()
    .sort(
      (a, b) =>
        DUE_ORDER[dueStatus(a, now).kind] - DUE_ORDER[dueStatus(b, now).kind] ||
        interestRank(a) - interestRank(b) ||
        (a.next_contact_at ?? a.client_created_at).localeCompare(b.next_contact_at ?? b.client_created_at),
    )

  const topTab = tab === 'pending' ? 'pending' : 'recaptured'
  const tabBtn = (active: boolean) => `min-h-12 whitespace-nowrap rounded-2xl px-4 text-sm font-semibold transition ${active ? 'bg-ink text-gold-light' : 'bg-white text-ink/70 ring-1 ring-ink/10'}`
  const count = (n: number, d: number) => (
    <span className="ml-1.5 tabular-nums opacity-70">
      {n}
      {d > 0 && <span className="ml-1 rounded-full bg-amber-300 px-1.5 text-xs font-bold text-ink opacity-100">⚠ {d}</span>}
    </span>
  )

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
      <PageTitle title="Mis contactos" subtitle={profile ? `${profile.full_name} · ${ROLE_LABEL[profile.role]}` : undefined} />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Contactos">
        <button type="button" role="tab" aria-selected={topTab === 'pending'} onClick={() => setTab('pending')} className={tabBtn(topTab === 'pending')}>
          Captados{count(pending.length, due(pending))}
        </button>
        <button type="button" role="tab" aria-selected={topTab === 'recaptured'} onClick={() => setTab('followup')} className={tabBtn(topTab === 'recaptured')}>
          Recaptados{count(recaptured.length, due(recaptured))}
        </button>
      </div>
      {topTab === 'recaptured' && (
        <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-ink/10 sm:self-start" role="tablist" aria-label="Recaptados">
          {[
            { v: 'followup' as const, label: 'Seguimiento', rows: followup },
            { v: 'noanswer' as const, label: 'No contestó', rows: noanswer },
          ].map((t) => (
            <button
              key={t.v}
              type="button"
              role="tab"
              aria-selected={tab === t.v}
              onClick={() => setTab(t.v)}
              className={`min-h-10 flex-1 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${tab === t.v ? 'bg-gold-gradient text-ink' : 'text-ink/60'}`}
            >
              {t.label}
              {count(t.rows.length, due(t.rows))}
            </button>
          ))}
        </div>
      )}

      {q.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">No se pudo cargar. {(q.error as Error).message}</p>
      ) : !q.data ? (
        <p className="p-8 text-center text-ink/45">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">
          {tab === 'pending' ? 'No tienes captados por contactar.' : tab === 'noanswer' ? 'Nadie pendiente por "no contestó".' : 'Nada en seguimiento.'}
        </p>
      ) : (
        <>
          <ContactsTable rows={rows} tab={tab} now={now} onResult={(row, visit) => setActive({ row, visit })} />
          <ContactCards rows={rows} tab={tab} now={now} onResult={(row, visit) => setActive({ row, visit })} />
        </>
      )}
      <label className="flex min-h-12 cursor-pointer items-center gap-3 self-start rounded-2xl bg-white px-4 text-sm font-semibold text-ink/70 ring-1 ring-ink/10">
        <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="size-5 accent-ink" />
        Ver cerrados anteriores
        {closedQ.data && <span className="tabular-nums opacity-70">{closedQ.data.length}</span>}
      </label>
      {showClosed && (
        <section className="flex flex-col gap-3" aria-label="Cerrados anteriores">
          <p className="text-sm text-ink/55">Ya compraron, no les interesó o no contestaron. Registra un contacto para volver a captarlos.</p>
          {closedQ.isError ? (
            <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">No se pudo cargar. {(closedQ.error as Error).message}</p>
          ) : !closedQ.data ? (
            <p className="p-8 text-center text-ink/45">Cargando…</p>
          ) : closedQ.data.length === 0 ? (
            <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">No tienes cerrados.</p>
          ) : (
            <ClosedList rows={closedQ.data} onResult={(row) => setActive({ row })} />
          )}
        </section>
      )}
      {active && <ResultDialog row={active.row} visitAnswer={active.visit} onClose={() => setActive(null)} />}
    </main>
  )
}
