import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ROLE_LABEL } from '@/features/auth/types'
import { METHOD_LABEL, RESULT_LABEL, type FollowupRow } from '@/features/followup/api'
import { rememberMethod } from '@/features/followup/lastAction'
import { ResultDialog } from '@/features/followup/ResultDialog'
import { useAssign, useAssignees } from '@/features/prospects/api'
import { fmtDate, fmtTime, INTEREST_LABEL, STAGE_LABEL } from '@/features/prospects/format'
import { SHIFT_LABEL } from '@/lib/dates'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useToast } from '@/ui/Toast'
import { useClient, useVoidClient, type Client, type TimelineItem } from './api'
import { EditClientDialog } from './EditClientDialog'

const FIELD_LABEL: Record<string, string> = {
  full_name: 'Nombre',
  phone_raw: 'Celular',
  product_id: 'Producto',
  channel_id: 'Canal',
  interest: 'Interés',
  occupation: 'Oficio',
  address: 'Dirección',
  status: 'Estado',
}

function when(iso: string) {
  return `${fmtDate(iso)} ${fmtTime(iso)}`
}

function TimelineEntry({ t }: { t: TimelineItem }) {
  let icon = '•'
  let title: React.ReactNode = null
  let body: React.ReactNode = null
  switch (t.type) {
    case 'capture':
      icon = '＋'
      title = <>Captado por {t.actor}</>
      body = t.data.channel ? `Canal: ${t.data.channel}` : 'Sin canal'
      break
    case 'assignment':
      icon = '⇄'
      title = t.data.to ? <>Asignado a {t.data.to}</> : <>Sin responsable</>
      body = `por ${t.actor}${t.data.from ? ` · antes: ${t.data.from}` : ''}`
      break
    case 'contact':
      icon = t.data.result === 'no_answer' ? '✕' : '☎'
      title = (
        <>
          {RESULT_LABEL[t.data.result]} <span className="font-normal text-ink/50">({METHOD_LABEL[t.data.method].toLowerCase()})</span>
        </>
      )
      body = (
        <>
          por {t.actor}
          {t.data.visit_at && <span className="block font-semibold text-gold-dark">Visitará: {when(t.data.visit_at)}</span>}
          {t.data.callback_at && <span className="block">Volver a contactar: {when(t.data.callback_at)}</span>}
          {t.data.note && <span className="block italic text-ink/70">“{t.data.note}”</span>}
        </>
      )
      break
    case 'stage':
      icon = '→'
      title = (
        <>
          Pasó a <strong>{STAGE_LABEL[t.data.to] ?? t.data.to}</strong>
        </>
      )
      body = `${t.data.reason ? `${t.data.reason} · ` : ''}por ${t.actor}`
      break
    case 'edit':
      icon = '✎'
      title = <>Datos editados</>
      body = (
        <>
          {Object.keys(t.data.new).map((k) => (
            <span key={k} className="block">
              {FIELD_LABEL[k] ?? k}: <span className="text-ink/45 line-through">{String(t.data.old[k] ?? '—')}</span> → {String(t.data.new[k] ?? '—')}
            </span>
          ))}
          <span className="block text-ink/50">por {t.actor ?? 'sistema'}</span>
        </>
      )
      break
    case 'duplicate':
      icon = '⚠'
      title = <>Intento de registro duplicado</>
      body = `${t.actor} (${t.data.branch}) lo quiso registrar como “${t.data.name}”; se bloqueó`
      break
  }
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0" data-testid={`timeline-${t.type}`}>
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm text-gold-light">
        {icon}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-ink/60">{body}</p>
        <p className="mt-0.5 text-xs tabular-nums text-ink/40">{when(t.at)}</p>
      </div>
    </li>
  )
}

function asRow(c: Client): FollowupRow {
  return {
    id: c.id,
    full_name: c.full_name,
    phone_raw: c.phone_raw,
    phone_norm: c.phone_norm,
    stage: c.stage as FollowupRow['stage'],
    contact_attempts: c.contact_attempts,
    next_contact_at: c.next_contact_at,
    visit_at: c.visit_at,
    client_created_at: c.client_created_at,
    interest: c.interest,
    product_id: c.product_id,
    product_name: c.product_name,
    channel_name: c.channel_name,
    created_by_name: c.created_by_name,
    last_result: null,
    last_method: null,
    last_note: null,
    last_contacted_at: null,
  }
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink/45">{label}</dt>
      <dd className="mt-0.5 font-medium">{children ?? <span className="text-ink/30">—</span>}</dd>
    </div>
  )
}

/** Ficha del cliente: datos, historial completo y acciones según el rol (T046). */
export function ClientPage() {
  const { id } = useParams({ strict: false }) as { id: string }
  const q = useClient(id)
  const [modal, setModal] = useState<null | 'contact' | 'edit' | 'void'>(null)
  const [reason, setReason] = useState('')
  const voidClient = useVoidClient(id)
  const assign = useAssign()
  const toast = useToast()
  const c = q.data?.prospect
  const assignees = useAssignees(q.data?.can_edit ? c?.branch_id : undefined)

  if (q.isError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="rounded-2xl bg-rb-red/10 p-4 text-rb-red">{(q.error as Error).message}</p>
      </main>
    )
  }
  if (!q.data || !c) return <p className="p-8 text-center text-ink/45">Cargando…</p>

  const wa = /^[67]\d{7}$/.test(c.phone_norm) ? `https://wa.me/591${c.phone_norm}` : null
  const voided = c.status !== 'active'

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-5 sm:px-6">
      <Link to="/gestion" className="text-sm font-semibold text-gold-dark hover:underline">
        ← Captaciones
      </Link>

      <section className="bg-ink-gradient flex flex-col gap-4 rounded-3xl p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold text-gold-light" data-testid="client-name">
              {c.full_name}
            </h1>
            <p className="text-white/60">
              {c.branch_name} · captado por {c.created_by_name} ({ROLE_LABEL[c.created_by_role]}) el {when(c.client_created_at)} · turno{' '}
              {SHIFT_LABEL[c.shift].toLowerCase()}
            </p>
          </div>
          <span className="rounded-full bg-gold-gradient px-4 py-1.5 text-sm font-bold text-ink" data-testid="client-stage">
            {voided ? 'Anulado' : (STAGE_LABEL[c.stage] ?? c.stage)}
          </span>
        </div>
        {voided && <p className="rounded-xl bg-rb-red/20 px-3 py-2 text-sm">Anulado el {c.voided_at && when(c.voided_at)}: “{c.void_reason}”</p>}
        <div className="flex flex-wrap gap-2">
          <span className="flex min-h-11 items-center rounded-2xl bg-white/10 px-4 font-semibold tabular-nums text-gold-light ring-1 ring-gold/40">
            {c.phone_raw}
          </span>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => rememberMethod(c.id, 'whatsapp_call')} className="flex min-h-11 items-center rounded-2xl bg-emerald-600 px-4 font-semibold text-white">
              WhatsApp
            </a>
          )}
          {q.data.can_contact && (
            <Button className="min-h-11" onClick={() => setModal('contact')}>
              Registrar contacto
            </Button>
          )}
          {q.data.can_edit && (
            <Button variant="secondary" className="min-h-11" onClick={() => setModal('edit')}>
              Editar datos
            </Button>
          )}
          {q.data.can_void && (
            <Button variant="danger" className="min-h-11" onClick={() => setModal('void')}>
              Anular
            </Button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">
        <section className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/5">
          <h2 className="font-display text-lg font-semibold">Datos</h2>
          <dl className="grid grid-cols-2 gap-4">
            <Info label="Producto">{c.product_name}</Info>
            <Info label="Canal">{c.channel_name}</Info>
            <Info label="Interés">{c.interest ? <Badge tone={c.interest === 'high' ? 'success' : c.interest === 'medium' ? 'warning' : 'neutral'}>{INTEREST_LABEL[c.interest]}</Badge> : null}</Info>
            <Info label="Oficio">{c.occupation}</Info>
            <div className="col-span-2">
              <Info label="Dirección">{c.address}</Info>
            </div>
            <Info label="Intentos sin respuesta">{c.stage === 'capture' || c.stage === 'recapture' ? `${c.contact_attempts} de 3` : null}</Info>
            <Info label="Próximo contacto">{c.next_contact_at ? when(c.next_contact_at) : null}</Info>
            <Info label="Visita pactada">{c.visit_at ? when(c.visit_at) : null}</Info>
            {c.lost_reason && <Info label="Motivo sin interés">{c.lost_reason}</Info>}
            {c.sold_at && <Info label="Venta">{when(c.sold_at)}</Info>}
          </dl>
          <div className="border-t border-ink/5 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Responsable</p>
            {q.data.can_edit ? (
              <select
                aria-label="Responsable"
                value={c.assigned_to ?? ''}
                disabled={assign.isPending}
                onChange={async (e) => {
                  try {
                    await assign.mutateAsync({ ids: [c.id], to: e.target.value || null })
                    toast('✓ Responsable actualizado', 'success')
                  } catch (x) {
                    toast((x as Error).message, 'error')
                  }
                }}
                className="mt-1 min-h-11 w-full rounded-xl border border-ink/15 bg-white px-3"
              >
                <option value="">Sin asignar</option>
                {assignees.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} ({ROLE_LABEL[a.role]})
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-0.5 font-medium">{c.assigned_to_name ?? 'Sin asignar'}</p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/5">
          <h2 className="font-display text-lg font-semibold">Historial</h2>
          <ol className="flex flex-col" aria-label="Historial del cliente">
            {q.data.timeline.map((t, i) => (
              <TimelineEntry key={`${t.type}-${t.at}-${i}`} t={t} />
            ))}
          </ol>
        </section>
      </div>

      {modal === 'contact' && <ResultDialog row={asRow(c)} onClose={() => setModal(null)} />}
      {modal === 'edit' && <EditClientDialog client={c} onClose={() => setModal(null)} />}
      {modal === 'void' && (
        <Dialog open onOpenChange={(o) => !o && setModal(null)} title={`¿Anular a ${c.full_name}?`} description="Sale de las listas y reportes. No se borra: queda guardado con el motivo.">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink/80">
            Motivo *
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-base font-normal" />
          </label>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={reason.trim().length < 5 || voidClient.isPending}
              onClick={async () => {
                try {
                  await voidClient.mutateAsync(reason)
                  toast('Cliente anulado', 'success')
                  setModal(null)
                } catch (x) {
                  toast((x as Error).message, 'error')
                }
              }}
            >
              Anular
            </Button>
          </div>
        </Dialog>
      )}
    </main>
  )
}
