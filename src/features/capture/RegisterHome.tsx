import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { MdCall } from 'react-icons/md'
import { useAuth } from '@/features/auth/AuthProvider'
import { FOLLOWUP_ROLES } from '@/features/auth/types'
import { SyncBadge } from '@/features/sync/SyncBadge'
import { onSyncEvent } from '@/features/sync/syncLoop'
import { useSyncStatus } from '@/features/sync/useSyncStatus'
import { SHIFT_LABEL, shiftFor } from '@/lib/dates'
import { PageTitle } from '@/ui/PageTitle'
import { Select } from '@/ui/Select'
import { ChannelPicker } from './ChannelPicker'
import {
  getCaptureBranch,
  getDayChannel,
  getDayChannelDetail,
  getDayChannelSource,
  setCaptureBranch,
  setDayChannel,
  type ChannelSource,
} from './channel'
import { loadTodayPlan, pickActivity } from '@/features/agenda/currentActivity'
import type { Activity } from '@/features/agenda/api'
import { useCaptureStats } from './useCaptureStats'
import { todayTotal } from '@/features/sync/todayCount'
import { useCatalogs } from './useCatalogs'

export function RegisterHome() {
  const { profile } = useAuth()
  const userId = profile!.id
  const navigate = useNavigate()
  const status = useSyncStatus(userId)
  const { catalogs } = useCatalogs()
  const [refreshKey, setRefreshKey] = useState(0)
  const { confirmed, rejections, dismiss } = useCaptureStats(userId, refreshKey + status.pending)
  const [channelId, setChannelId] = useState<number | null>(() => getDayChannel(userId))
  const [source, setSource] = useState<ChannelSource | null>(() => getDayChannelSource(userId))
  const [detail, setDetail] = useState(() => getDayChannelDetail(userId))
  const [picking, setPicking] = useState<null | 'change' | 'then-register'>(null)
  const [plan, setPlan] = useState<{ activity: Activity; current: boolean } | null>(null)
  // Sin sucursal propia (jefe de ventas, gerencia, Sistemas): elige dónde registra; el jefe solo entre las suyas.
  const ownBranch = profile!.branch_id
  const branchOptions =
    ownBranch !== null
      ? []
      : (catalogs?.branches ?? []).filter((b) => profile!.role !== 'sales_lead' || profile!.branch_ids?.includes(b.id))
  const [pickedBranch, setPickedBranch] = useState(() => getCaptureBranch(userId))
  const chosenBranch = branchOptions.find((b) => b.id === pickedBranch) ?? (branchOptions.length === 1 ? branchOptions[0] : undefined)
  const branch = ownBranch ?? chosenBranch?.id ?? null
  const needsBranch = ownBranch === null && !chosenBranch

  // Cada confirmación del servidor refresca el conteo y los avisos de duplicado.
  useEffect(() => onSyncEvent(() => setRefreshKey((k) => k + 1)), [])

  // Actividad del plan en curso (o la próxima): se refresca al subir captaciones y cada 5 minutos.
  useEffect(() => {
    if (branch === null) return
    let alive = true
    const load = () =>
      void loadTodayPlan(branch).then((acts) => {
        if (!alive) return
        const picked = acts ? pickActivity(acts, new Date()) : null
        setPlan(picked)
        // El canal sale del plan: si la persona no eligió uno a mano, se usa el de la actividad en curso.
        const fromPlan = picked?.current ? picked.activity.channel_id : null
        if (fromPlan !== null && getDayChannelSource(userId) !== 'manual' && getDayChannel(userId) !== fromPlan) {
          const planDetail = planDetailOf(picked!.activity)
          setDayChannel(userId, fromPlan, 'plan', planDetail)
          setChannelId(fromPlan)
          setSource('plan')
          setDetail(planDetail)
        }
      })
    load()
    const off = onSyncEvent(load)
    const t = setInterval(load, 5 * 60_000)
    return () => {
      alive = false
      off()
      clearInterval(t)
    }
  }, [branch, userId])

  const planChannel = plan?.current ? plan.activity.channel_id : null

  const today = todayTotal(confirmed, status.pendingTodayIds)
  const channelName = catalogs?.channels.find((c) => Number(c.value) === channelId)?.label

  function onRegister() {
    if (needsBranch) return
    if (chosenBranch) setCaptureBranch(userId, chosenBranch.id)
    if ((channelId === null || !channelName || !detail) && catalogs?.channels.length) setPicking('then-register')
    else void navigate({ to: '/registrar/nuevo' })
  }

  function onPick(id: number, newDetail: string) {
    setDayChannel(userId, id, 'manual', newDetail)
    setChannelId(id)
    setSource('manual')
    setDetail(newDetail)
    const next = picking
    setPicking(null)
    if (next === 'then-register') void navigate({ to: '/registrar/nuevo' })
  }

  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col lg:min-h-dvh">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        <PageTitle title="Registrar" subtitle={`${profile!.full_name} · Turno ${SHIFT_LABEL[shiftFor(new Date())].toLowerCase()}`} />
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-8 pt-4">
        <SyncBadge status={status} />

        {rejections.map((r) => (
          <div key={r.id} role="alert" className="flex items-start justify-between gap-3 rounded-2xl bg-gold/10 p-4 text-ink ring-1 ring-gold/30">
            <p>
              El teléfono <strong>{r.phone_masked}</strong> ya estaba registrado. No se duplicó.
            </p>
            <button className="min-h-10 px-2 font-semibold text-gold-dark" onClick={() => dismiss(r.id)} aria-label="Cerrar aviso">
              ✕
            </button>
          </div>
        ))}

        {ownBranch === null && branchOptions.length > 1 && (
          <section className="flex flex-col gap-1.5 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-ink/5">
            <label htmlFor="capture-branch" className="text-sm font-bold uppercase tracking-wide text-ink/55">
              Sucursal donde registras
            </label>
            <Select
              id="capture-branch"
              value={chosenBranch ? String(chosenBranch.id) : ''}
              onChange={(v) => {
                if (!v) return
                setCaptureBranch(userId, Number(v))
                setPickedBranch(Number(v))
              }}
              options={branchOptions.map((b) => ({ value: String(b.id), label: b.name }))}
              placeholder="Elegir sucursal…"
              invalid={needsBranch}
            />
          </section>
        )}

        <section className="flex flex-col gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-ink/5" aria-label="Canal de hoy">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-wide text-ink/55">Canal de hoy</p>
              <p className="truncate text-2xl font-semibold" data-testid="day-channel">
                {channelName ?? 'Sin elegir'}
              </p>
              {channelName && detail && (
                <p className="truncate text-ink/70" data-testid="day-channel-detail">
                  {detail}
                </p>
              )}
              {source === 'plan' && channelName && <p className="text-xs text-ink/50">Según el plan del día</p>}
            </div>
            <button
              type="button"
              aria-label={`${channelName ? 'Cambiar' : 'Elegir'} canal de hoy`}
              onClick={() => setPicking('change')}
              disabled={!catalogs}
              className="bg-gold-gradient shrink-0 rounded-2xl px-4 py-3 text-xl font-semibold text-amber-50"
            >
              {channelName ? 'Cambiar' : 'Elegir'}
            </button>
          </div>
          {plan && (
            <p className="border-t border-ink/5 pt-2 text-sm text-ink/70" data-testid="current-activity">
              <span className="font-semibold text-ink">{plan.current ? 'Ahora' : `A las ${plan.activity.start_time}`}:</span>{' '}
              {plan.activity.description}
              {plan.activity.goal_count !== null && (
                <span className="tabular-nums">
                  {' '}
                  · {plan.activity.captures}/{plan.activity.goal_count} captaciones
                </span>
              )}
              {planChannel !== null && planChannel !== channelId && plan.activity.channel && (
                <button
                  type="button"
                  onClick={() => onPick(planChannel, planDetailOf(plan.activity))}
                  className="ml-1 font-semibold text-gold-dark underline"
                >
                  El plan es por {plan.activity.channel}: usar
                </button>
              )}
            </p>
          )}
        </section>

        <section className="flex flex-1 flex-col items-center justify-center gap-10 py-6">
          <div className="text-center">
            <p className="font-display text-8xl font-bold leading-none tabular-nums text-ink" data-testid="today-count">
              {today}
            </p>
            <p className="mt-2 text-ink/55">{today === 1 ? 'captación hoy' : 'captaciones hoy'}</p>
          </div>
          <button
            type="button"
            onClick={onRegister}
            disabled={needsBranch}
            className="bg-gold-gradient flex min-h-24 disabled:opacity-50 w-full items-center justify-center gap-3 rounded-3xl font-display text-3xl font-bold text-ink shadow-gold transition active:scale-[0.98]"
          >
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-2xl text-gold-light">
              +
            </span>
            Nuevo Registro
          </button>
          {needsBranch && <p className="-mt-6 text-center text-sm text-ink/55">Elige arriba la sucursal donde registras.</p>}
          {FOLLOWUP_ROLES.includes(profile!.role) && (
            <Link
              to="/seguimiento"
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-ink font-display text-xl font-semibold text-gold-light active:bg-charcoal"
            >
              <MdCall aria-hidden className="h-6 w-6" /> Mis contactos
            </Link>
          )}
        </section>
      </main>

      {catalogs && (
        <ChannelPicker
          open={picking !== null}
          onOpenChange={(o) => !o && setPicking(null)}
          channels={catalogs.channels}
          current={channelId}
          currentDetail={detail}
          onPick={onPick}
        />
      )}
    </div>
  )
}

/** Descripción que trae la actividad del plan: sus lugares o, si no tiene, lo que se va a hacer. */
function planDetailOf(a: Activity): string {
  return (a.places || a.description || '').slice(0, 120)
}
