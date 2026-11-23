import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { ROLE_LABEL } from '@/features/auth/types'
import { fmtDate, fmtTime } from '@/features/prospects/format'
import { matchesNameOrPhone } from '@/lib/search'
import { PageTitle } from '@/ui/PageTitle'
import {
  METHOD_LABEL,
  RESULT_LABEL,
  useMyClosedContacts,
  useMyContacts,
  type ClosedRow,
  type FollowupRow,
} from './api'
import { dueStatus, needsAttention, visitPassed, type DueKind, type DueStatus } from './dueStatus'
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  cardOf,
  groupByAssignedDay,
  keepPlace,
  pageOf,
  pageWindow,
  parsePageSize,
  sortRecaptured,
  summarize,
  tabCount,
  waitedBefore,
  type DayGroup,
  type Page,
  type SummaryCard,
} from './inboxView'
import { takePendingContact } from './lastAction'
import { PhoneMenu } from './PhoneMenu'
import { ResultDialog } from './ResultDialog'
import { SummaryCards } from './SummaryCards'

type Tab = 'pending' | 'followup' | 'noanswer'

const PAGE_SIZE_KEY = 'mis-contactos:page-size'

const STAGE_LABEL: Record<FollowupRow['stage'], string> = {
  capture: 'Captación',
  recapture: 'Recaptación',
  followup: 'Seguimiento',
  interested: 'Cliente potencial',
}

const INTEREST: Record<'high' | 'medium' | 'low', { label: string; cls: string }> = {
  high: { label: 'Interés alto', cls: 'bg-emerald-600 text-white' },
  medium: { label: 'Interés medio', cls: 'bg-amber-200 text-amber-950' },
  low: { label: 'Interés bajo', cls: 'bg-ink/10 text-ink/60' },
}

function InterestTag({ v }: { v: FollowupRow['interest'] }) {
  if (!v) return null
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${INTEREST[v].cls}`}>
      {INTEREST[v].label}
    </span>
  )
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
  done: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    icon: '✓',
    row: 'bg-emerald-50/40 text-ink/60',
    card: 'bg-emerald-50/50 ring-emerald-200',
  },
  late: {
    badge: 'bg-rb-red text-white ring-rb-red',
    icon: '!',
    row: 'bg-rb-red/5',
    card: 'bg-rb-red/5 ring-rb-red/40',
  },
  now: {
    badge: 'bg-amber-100 text-amber-900 ring-amber-300',
    icon: '⚠',
    row: 'bg-amber-50',
    card: 'bg-amber-50 ring-amber-300',
  },
  soon: {
    badge: 'bg-sky-50 text-sky-900 ring-sky-300',
    icon: '⏰',
    row: 'bg-sky-50/60',
    card: 'bg-sky-50/60 ring-sky-200',
  },
  normal: { badge: 'bg-ink/5 text-ink/60 ring-ink/10', icon: '•', row: '', card: 'bg-white ring-ink/5' },
}

function Badge({ s }: { s: DueStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${TONE[s.kind].badge}`}
    >
      {TONE[s.kind].icon} {s.label}
    </span>
  )
}

/** Spec 016: el cliente vino recomendado y/o alguien más se lo asignó. Nada si no aplica. */
function ReferralTag({ r, hideAssigner }: { r: FollowupRow; hideAssigner?: boolean }) {
  const assigner = hideAssigner ? null : r.assigned_by_name
  if (!r.referrer_name && !assigner) return null
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5" data-testid="referral-tag">
      {r.referrer_name && (
        <span className="inline-flex items-center rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold-dark ring-1 ring-gold/30">
          Referido por {r.referrer_name}
        </span>
      )}
      {assigner && <span className="text-xs text-ink/50">te lo asignó {assigner}</span>}
    </span>
  )
}

const shortDate = (iso: string) => fmtDate(iso).slice(0, 5)

/** Spec 022: se lo pasaron desde otra persona; si nadie lo llamó, desde cuándo espera. */
function ReassignedTag({ r }: { r: FollowupRow }) {
  if (!r.reassigned_from_name) return null
  return (
    <span className="mt-1 block text-xs font-semibold text-sky-800" data-testid="reassigned-tag">
      Reasignado de {r.reassigned_from_name}
      {waitedBefore(r) && ` · sin contactar desde el ${shortDate(r.waiting_since)}`}
    </span>
  )
}

/** Columna «Asignado» (spec 022): cuándo y quién. Sin la 022 en el servidor, la captación como antes. */
function AssignedCell({ r }: { r: FollowupRow }) {
  const at = r.assigned_at ?? r.client_created_at
  return (
    <span>
      {fmtDate(at)} {fmtTime(at)}
      <span className="block text-xs text-ink/45">
        {!r.assigned_at
          ? `captó ${r.created_by_name}`
          : r.assigned_by_name
            ? `por ${r.assigned_by_name}`
            : 'tomado por ti'}
      </span>
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
      {r.visit_at && (
        <span className="block text-xs font-semibold text-gold-dark">
          Visita: {fmtDate(r.visit_at)} {fmtTime(r.visit_at)}
        </span>
      )}
      {r.last_note && <span className="block text-xs italic text-ink/60">“{r.last_note}”</span>}
      {r.last_contacted_at && (
        <span className="block text-xs text-ink/40">
          {fmtDate(r.last_contacted_at)} {fmtTime(r.last_contacted_at)}
        </span>
      )}
    </span>
  )
}

type OnResult = (r: FollowupRow, visit?: 'came' | 'missed') => void

/** En una visita vencida: "¿vino?" con dos botones; si no, el botón normal de registrar. */
function ResultButtons({
  r,
  now,
  onResult,
  big,
}: {
  r: FollowupRow
  now: Date
  onResult: OnResult
  big?: boolean
}) {
  const h = big ? 'min-h-11 rounded-2xl px-4' : 'min-h-10 rounded-xl px-3'
  if (visitPassed(r, now)) {
    return (
      <span className="flex flex-wrap items-center gap-2" role="group" aria-label="¿Vino a la tienda?">
        <span className="text-xs font-semibold text-ink/55">¿Vino?</span>
        <button
          type="button"
          onClick={() => onResult(r, 'came')}
          className={`${h} whitespace-nowrap bg-emerald-600 font-semibold text-white`}
        >
          Sí vino
        </button>
        <button
          type="button"
          onClick={() => onResult(r, 'missed')}
          className={`${h} whitespace-nowrap bg-white font-semibold text-rb-red ring-1 ring-rb-red/40`}
        >
          No vino
        </button>
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onResult(r)}
      className={`bg-gold-gradient ${h} whitespace-nowrap font-semibold text-ink shadow-gold`}
    >
      {big ? 'Registrar contacto' : 'Registrar'}
    </button>
  )
}

function ContactsTable({
  rows,
  tab,
  now,
  onResult,
}: {
  rows: FollowupRow[]
  tab: Tab
  now: Date
  onResult: OnResult
}) {
  const head = [
    'Estado',
    'Cliente',
    'Celular',
    'Producto',
    tab === 'pending' ? 'Asignado' : tab === 'noanswer' ? 'Intentos' : 'Qué se hizo',
    '',
  ]
  return (
    <div className="hidden overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-ink/5 md:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink text-gold-light">
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                scope="col"
                className="px-4 py-3 font-semibold first:rounded-tl-3xl last:rounded-tr-3xl"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = dueStatus(r, now)
            return (
              <tr
                key={r.id}
                className={`border-t border-ink/5 align-top ${TONE[s.kind].row}`}
                data-testid="contact-row"
                data-status={s.kind}
              >
                <td className="px-4 py-3">
                  <StatusBadge s={s} />
                </td>
                <td className="px-4 py-3">
                  <Link
                    to="/cliente/$id"
                    params={{ id: r.id }}
                    className="font-semibold text-ink hover:text-gold-dark hover:underline"
                  >
                    {r.full_name}
                  </Link>{' '}
                  <InterestTag v={r.interest} />
                  <span className="block text-xs text-ink/45">
                    {STAGE_LABEL[r.stage]} · {r.channel_name ?? 'Sin canal'}
                  </span>
                  <ReferralTag r={r} hideAssigner={tab === 'pending'} />
                  <ReassignedTag r={r} />
                </td>
                <td className="px-2 py-1.5">
                  <PhoneMenu id={r.id} name={r.full_name} phoneRaw={r.phone_raw} phoneNorm={r.phone_norm} />
                </td>
                <td className="px-4 py-3">{r.product_name ?? <span className="text-ink/30">—</span>}</td>
                <td className="px-4 py-3">
                  {tab === 'pending' ? (
                    <AssignedCell r={r} />
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

function ContactCards({
  rows,
  tab,
  now,
  onResult,
}: {
  rows: FollowupRow[]
  tab: Tab
  now: Date
  onResult: OnResult
}) {
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
              <Link
                to="/cliente/$id"
                params={{ id: r.id }}
                className="text-lg font-semibold leading-snug hover:underline"
              >
                {r.full_name}
              </Link>
              <span className="flex shrink-0 items-center gap-2">
                <InterestTag v={r.interest} />
                {tab === 'noanswer' && <Strikes n={r.contact_attempts} />}
              </span>
            </div>
            <StatusBadge s={s} />
            <p className="text-sm text-ink/55">
              {[r.product_name, r.channel_name].filter(Boolean).join(' · ') || 'Sin producto'} · captó{' '}
              {r.created_by_name}
              {r.assigned_at && (
                <span className="block text-xs text-ink/45">
                  Asignado {shortDate(r.assigned_at)} {fmtTime(r.assigned_at)}
                </span>
              )}
            </p>
            <ReferralTag r={r} />
            <ReassignedTag r={r} />
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

/**
 * Paginador (spec 022): rango «26–50 de 98», «Filas por página» 10/25/50/100 (solo arriba) y navegación: en computadora
 * primera/anterior/números/siguiente/última; en celular «‹ 2 de 4 ›». Con 10 filas o menos no se muestra.
 */
function Pager({
  p,
  label,
  onPage,
  size,
  onSize,
}: {
  p: Page<FollowupRow>
  label: string
  onPage: (n: number) => void
  size?: number
  onSize?: (n: number) => void
}) {
  if (p.total <= PAGE_SIZES[0]) return null
  const btn =
    'min-h-10 min-w-10 rounded-xl px-2 text-sm font-semibold bg-white text-ink/70 ring-1 ring-ink/10 disabled:opacity-35'
  const first = p.page === 0
  const last = p.page === p.pages - 1
  const nav = (n: number, name: string, text: string, disabled: boolean) => (
    <button type="button" className={btn} aria-label={name} disabled={disabled} onClick={() => onPage(n)}>
      {text}
    </button>
  )
  return (
    <nav className="flex flex-wrap items-center justify-end gap-2" aria-label={`Páginas de ${label}`}>
      {size !== undefined && onSize && (
        <label className="flex items-center gap-1.5 text-sm text-ink/60">
          Filas
          <select
            aria-label="Filas por página"
            value={size}
            onChange={(e) => onSize(Number(e.target.value))}
            className="min-h-10 rounded-xl border border-ink/15 bg-white px-2 text-sm font-semibold text-ink"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      <span className="whitespace-nowrap text-sm tabular-nums text-ink/60" data-testid="page-range">
        {p.from}–{p.to} de {p.total}
      </span>
      {p.pages > 1 && (
        <>
          <span className="hidden items-center gap-1 md:flex">
            {nav(0, 'Primera página', '«', first)}
            {nav(p.page - 1, 'Página anterior', '‹', first)}
            {pageWindow(p.page, p.pages).map((n, i) =>
              n === 'gap' ? (
                <span key={`gap${i}`} className="px-1 text-ink/40" aria-hidden>
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  aria-label={`Página ${n + 1}`}
                  aria-current={n === p.page ? 'page' : undefined}
                  onClick={() => onPage(n)}
                  className={n === p.page ? `${btn} bg-ink text-gold-light ring-ink` : btn}
                >
                  {n + 1}
                </button>
              ),
            )}
            {nav(p.page + 1, 'Página siguiente', '›', last)}
            {nav(p.pages - 1, 'Última página', '»', last)}
          </span>
          <span className="flex items-center gap-1 md:hidden">
            {nav(p.page - 1, 'Página anterior', '‹', first)}
            <span className="px-1 text-sm font-semibold tabular-nums text-ink/70">
              {p.page + 1} de {p.pages}
            </span>
            {nav(p.page + 1, 'Página siguiente', '›', last)}
          </span>
        </>
      )}
    </nav>
  )
}

type ListProps = { tab: Tab; now: Date; onResult: OnResult }
/** Tamaño de página (uno para toda la pantalla) y cómo cambiarlo: la lista pasa su primera fila visible para no perder el lugar. */
type SizeProps = { size: number; onSize: (n: number, from: number) => void }

/**
 * Una lista paginada: el paginador arriba (junto al encabezado, si hay) y abajo. Desde abajo, al cambiar de página
 * vuelve al principio de la lista para no quedar mirando el final de la página nueva.
 */
function PagedList({
  rows,
  page,
  onPage,
  label,
  header,
  barClass = '',
  size,
  onSize,
  ...list
}: ListProps &
  SizeProps & {
    rows: FollowupRow[]
    page: number
    onPage: (n: number) => void
    label: string
    header?: ReactNode
    barClass?: string
  }) {
  const top = useRef<HTMLDivElement>(null)
  const p = pageOf(rows, page, size)
  return (
    <>
      <div ref={top} className={`flex scroll-mt-4 flex-wrap items-center justify-between gap-2 ${barClass}`}>
        {header}
        <div className="ml-auto">
          <Pager p={p} onPage={onPage} label={label} size={size} onSize={(n) => onSize(n, p.from)} />
        </div>
      </div>
      <ContactsTable rows={p.rows} {...list} />
      <ContactCards rows={p.rows} {...list} />
      {p.pages > 1 && (
        <div className="flex justify-center">
          <Pager
            p={p}
            label={label}
            onPage={(n) => {
              onPage(n)
              top.current?.scrollIntoView({ block: 'start' })
            }}
          />
        </div>
      )}
    </>
  )
}

/** Captados de un día de asignación (spec 022): encabezado plegable; cerrado no dibuja filas. */
function DayGroupSection({
  g,
  open,
  onToggle,
  page,
  onPage,
  ...list
}: ListProps &
  SizeProps & {
    g: DayGroup
    open: boolean
    onToggle: () => void
    page: number
    onPage: (n: number) => void
  }) {
  const n = g.rows.length
  const bar = `rounded-2xl px-2 py-1.5 ring-1 ${g.late ? 'bg-rb-red/5 ring-rb-red/25' : 'bg-white ring-ink/10'}`
  const header = (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={`flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold ${g.late ? 'text-rb-red' : 'text-ink'}`}
    >
      <span aria-hidden>{open ? '▾' : '▸'}</span>
      {g.label} · {n}
      {g.late && (n === 1 ? ' atrasado' : ' atrasados')}
    </button>
  )
  return (
    <section data-testid="day-group" data-day={g.day} className="flex flex-col gap-3">
      {open ? (
        <PagedList
          rows={g.rows}
          page={page}
          onPage={onPage}
          label={g.label}
          header={header}
          barClass={bar}
          {...list}
        />
      ) : (
        <div className={bar}>{header}</div>
      )}
    </section>
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
      <span
        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`}
      >
        {label}
      </span>
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
                <th
                  key={i}
                  scope="col"
                  className="px-4 py-3 font-semibold first:rounded-tl-3xl last:rounded-tr-3xl"
                >
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
                  <Link
                    to="/cliente/$id"
                    params={{ id: r.id }}
                    className="font-semibold text-ink hover:text-gold-dark hover:underline"
                  >
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
          <li
            key={r.id}
            data-testid="closed-card"
            className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/5"
          >
            <div className="flex items-start justify-between gap-2">
              <Link
                to="/cliente/$id"
                params={{ id: r.id }}
                className="text-lg font-semibold leading-snug hover:underline"
              >
                {r.full_name}
              </Link>
            </div>
            <ClosedBadge r={r} />
            <p className="text-sm text-ink/55">
              {[r.product_name, r.channel_name].filter(Boolean).join(' · ') || 'Sin producto'} · captó{' '}
              {r.created_by_name}
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
  const [active, setActive] = useState<{ row: FollowupRow | ClosedRow; visit?: 'came' | 'missed' } | null>(
    null,
  )
  const [showClosed, setShowClosed] = useState(false)
  const closedQ = useMyClosedContacts(showClosed)
  // Spec 020: lupa por nombre o celular; filtra pestañas, contadores y cerrados (solo en pantalla, no en la URL).
  const [search, setSearch] = useState('')
  const matches = (r: FollowupRow | ClosedRow) => matchesNameOrPhone(r, search)
  // Spec 022: tarjeta del resumen activa, grupos abiertos/cerrados a mano y cuántas filas se dibujan por lista.
  const [card, setCard] = useState<SummaryCard | null>(null)
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  // La página de cada lista se guarda junto a la vista (pestaña + tarjeta + lupa): si la vista cambia, vuelve a la primera.
  const view = `${tab}|${card ?? ''}|${search}`
  const [pageState, setPageState] = useState<{ view: string; m: Record<string, number> }>({ view, m: {} })
  // Filas por página: 25 de entrada, recordado en este navegador (comodidad por dispositivo; sin datos de clientes).
  const [size, setSize] = useState(() => {
    try {
      return parsePageSize(localStorage.getItem(PAGE_SIZE_KEY))
    } catch {
      return DEFAULT_PAGE_SIZE
    }
  })
  const pages = pageState.view === view ? pageState.m : {}
  // El estado de cada fila (⚠ toca contactar) se recalcula cada minuto sin recargar.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const searched = (q.data ?? []).filter(matches)
  const counts = summarize(searched, now)
  const all = card ? searched.filter((r) => cardOf(dueStatus(r, now)) === card) : searched

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
  // Captados: agrupados por día de asignación (hoy primero). Recaptados: una lista por estado.
  const groups = tab === 'pending' ? groupByAssignedDay(pending, now) : []
  const rows = tab === 'pending' ? pending : sortRecaptured(byTab[tab], now)
  const pageAt = (key: string) => pages[key] ?? 0
  const goPage = (key: string) => (n: number) => setPageState({ view, m: { ...pages, [key]: n } })
  // Cambiar el tamaño deja en esa lista la página que contiene la fila que se estaba viendo; las demás vuelven a la primera.
  const changeSize = (key: string) => (n: number, from: number) => {
    setSize(n)
    setPageState({ view, m: { [key]: keepPlace(from, n) } })
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(n))
    } catch {
      // Navegador sin almacenamiento (privado o bloqueado): se usa el tamaño solo en esta visita.
    }
  }
  // Sin lupa se abre solo el primer grupo; con lupa, todos los que tienen coincidencias. Tocar el encabezado manda.
  const isOpen = (day: string, i: number) => toggled[day] ?? (search.trim() ? true : i === 0)

  const topTab = tab === 'pending' ? 'pending' : 'recaptured'
  const tabBtn = (active: boolean) =>
    `min-h-12 whitespace-nowrap rounded-2xl px-4 text-sm font-semibold transition ${active ? 'bg-ink text-gold-light' : 'bg-white text-ink/70 ring-1 ring-ink/10'}`
  // Spec 022: el total y aparte el ⚠; si todos piden atención, ⚠ sin número (antes «290 ⚠290»).
  const count = (n: number, d: number) => {
    const c = tabCount(n, d)
    return (
      <span className="ml-1.5 tabular-nums opacity-70">
        {c.total}
        {c.due !== null && (
          <span
            className="ml-1 rounded-full bg-amber-300 px-1.5 text-xs font-bold text-ink opacity-100"
            aria-label={c.due === 'all' ? 'todos por atender' : `${c.due} por atender`}
          >
            {c.due === 'all' ? '⚠' : `⚠ ${c.due}`}
          </span>
        )}
      </span>
    )
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
      <PageTitle
        title="Mis contactos"
        subtitle={profile ? `${profile.full_name} · ${ROLE_LABEL[profile.role]}` : undefined}
      />

      {q.data && (
        <SummaryCards counts={counts} active={card} onToggle={(v) => setCard((c) => (c === v ? null : v))} />
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Contactos">
            <button
              type="button"
              role="tab"
              aria-selected={topTab === 'pending'}
              onClick={() => setTab('pending')}
              className={tabBtn(topTab === 'pending')}
            >
              Captados{count(pending.length, due(pending))}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={topTab === 'recaptured'}
              onClick={() => setTab('followup')}
              className={tabBtn(topTab === 'recaptured')}
            >
              Recaptados{count(recaptured.length, due(recaptured))}
            </button>
          </div>
          {topTab === 'recaptured' && (
            <div
              className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-ink/10 sm:self-start"
              role="tablist"
              aria-label="Recaptados"
            >
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
        </div>

        <input
          type="search"
          inputMode="search"
          aria-label="Buscar por nombre o celular"
          placeholder="Buscar nombre o celular…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-11 rounded-xl border border-ink/15 bg-white px-3 text-base outline-none placeholder:text-ink/35 focus:border-gold focus:ring-4 focus:ring-gold/20 md:w-80"
        />
      </div>

      {q.isError ? (
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">
          No se pudo cargar. {(q.error as Error).message}
        </p>
      ) : !q.data ? (
        <p className="p-8 text-center text-ink/45">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">
          {search.trim()
            ? `Ningún contacto coincide con «${search.trim()}».`
            : card
              ? 'Nada en esta tarjeta.'
              : tab === 'pending'
                ? 'No tienes captados por contactar.'
                : tab === 'noanswer'
                  ? 'Nadie pendiente por "no contestó".'
                  : 'Nada en seguimiento.'}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {tab === 'pending' ? (
            groups.map((g, i) => (
              <DayGroupSection
                key={g.day}
                g={g}
                open={isOpen(g.day, i)}
                onToggle={() => setToggled((t) => ({ ...t, [g.day]: !isOpen(g.day, i) }))}
                page={pageAt(g.day)}
                onPage={goPage(g.day)}
                size={size}
                onSize={changeSize(g.day)}
                tab={tab}
                now={now}
                onResult={(row, visit) => setActive({ row, visit })}
              />
            ))
          ) : (
            <PagedList
              rows={rows}
              page={pageAt(tab)}
              onPage={goPage(tab)}
              size={size}
              onSize={changeSize(tab)}
              label={tab === 'followup' ? 'Seguimiento' : 'No contestó'}
              tab={tab}
              now={now}
              onResult={(row, visit) => setActive({ row, visit })}
            />
          )}
        </div>
      )}
      <label className="flex min-h-12 cursor-pointer items-center gap-3 self-start rounded-2xl bg-white px-4 text-sm font-semibold text-ink/70 ring-1 ring-ink/10">
        <input
          type="checkbox"
          checked={showClosed}
          onChange={(e) => setShowClosed(e.target.checked)}
          className="size-5 accent-ink"
        />
        Ver cerrados anteriores
        {closedQ.data && (
          <span className="tabular-nums opacity-70">{closedQ.data.filter(matches).length}</span>
        )}
      </label>
      {showClosed && (
        <section className="flex flex-col gap-3" aria-label="Cerrados anteriores">
          <p className="text-sm text-ink/55">
            Ya compraron, no les interesó o no contestaron. Registra un contacto para volver a captarlos.
          </p>
          {closedQ.isError ? (
            <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">
              No se pudo cargar. {(closedQ.error as Error).message}
            </p>
          ) : !closedQ.data ? (
            <p className="p-8 text-center text-ink/45">Cargando…</p>
          ) : closedQ.data.filter(matches).length === 0 ? (
            <p className="rounded-3xl bg-white p-8 text-center text-ink/50 ring-1 ring-ink/5">
              {search.trim() ? `Ningún cerrado coincide con «${search.trim()}».` : 'No tienes cerrados.'}
            </p>
          ) : (
            <ClosedList rows={closedQ.data.filter(matches)} onResult={(row) => setActive({ row })} />
          )}
        </section>
      )}
      {active && <ResultDialog row={active.row} visitAnswer={active.visit} onClose={() => setActive(null)} />}
    </main>
  )
}
