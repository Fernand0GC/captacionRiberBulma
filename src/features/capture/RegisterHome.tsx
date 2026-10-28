import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { MANAGER_ROLES, ROLE_LABEL } from '@/features/auth/types'
import { LogoutButton } from '@/features/auth/LogoutButton'
import { SyncBadge } from '@/features/sync/SyncBadge'
import { onSyncEvent } from '@/features/sync/syncLoop'
import { useSyncStatus } from '@/features/sync/useSyncStatus'
import { SHIFT_LABEL, shiftFor } from '@/lib/dates'
import { BrandHeader } from '@/ui/BrandHeader'
import { ChannelPicker } from './ChannelPicker'
import { getDayChannel, setDayChannel } from './channel'
import { useCaptureStats } from './useCaptureStats'
import { useCatalogs } from './useCatalogs'

export function RegisterHome() {
  const { profile } = useAuth()
  const userId = profile!.id
  const navigate = useNavigate()
  const status = useSyncStatus(userId)
  const { catalogs } = useCatalogs()
  const [refreshKey, setRefreshKey] = useState(0)
  const { serverToday, rejections, dismiss } = useCaptureStats(userId, refreshKey + status.pending)
  const [channelId, setChannelId] = useState<number | null>(() => getDayChannel(userId))
  const [picking, setPicking] = useState<null | 'change' | 'then-register'>(null)

  // Cada confirmación del servidor refresca el conteo y los avisos de duplicado.
  useEffect(() => onSyncEvent(() => setRefreshKey((k) => k + 1)), [])

  const today = serverToday + status.pendingToday
  const channelName = catalogs?.channels.find((c) => Number(c.value) === channelId)?.label

  function onRegister() {
    if (channelId === null && catalogs?.channels.length) setPicking('then-register')
    else void navigate({ to: '/registrar/nuevo' })
  }

  function onPick(id: number) {
    setDayChannel(userId, id)
    setChannelId(id)
    const next = picking
    setPicking(null)
    if (next === 'then-register') void navigate({ to: '/registrar/nuevo' })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <BrandHeader
        title={profile!.full_name}
        subtitle={`${ROLE_LABEL[profile!.role]} · Turno ${SHIFT_LABEL[shiftFor(new Date())].toLowerCase()}`}
        right={
          MANAGER_ROLES.includes(profile!.role) ? (
            <Link to="/gestion" className="flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-gold-light ring-1 ring-gold/40 active:bg-white/10">
              Panel
            </Link>
          ) : (
            <LogoutButton tone="dark" />
          )
        }
      />

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

        <button
          type="button"
          onClick={() => setPicking('change')}
          disabled={!catalogs}
          className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-ink/5 active:bg-sand"
        >
          <span>
            <span className="block text-xl font-bold uppercase text-black">Canal de hoy</span>
          </span>
          <span className="bg-gold-gradient rounded-2xl px-4 py-3 text-left text-xl font-semibold text-amber-50">{channelName ? 'Cambiar' : 'Elegir'}</span>
        </button>

        <section className="flex flex-1 flex-col items-center justify-center gap-10 py-6">
           <span className="block text-2xl font-semibold" data-testid="day-channel">
              {channelName ?? 'Sin elegir'}
            </span>
          <div className="text-center">
            <p className="font-display text-8xl font-bold leading-none tabular-nums text-ink" data-testid="today-count">
              {today}
            </p>
            <p className="mt-2 text-ink/55">{today === 1 ? 'captación hoy' : 'captaciones hoy'}</p>
          </div>
          <button
            type="button"
            onClick={onRegister}
            className="bg-gold-gradient flex min-h-24 w-full items-center justify-center gap-3 rounded-3xl font-display text-3xl font-bold text-ink shadow-gold transition active:scale-[0.98]"
          >
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-2xl text-gold-light">
              +
            </span>
            Nuevo Registro
          </button>
        </section>
      </main>

      {catalogs && (
        <ChannelPicker
          open={picking !== null}
          onOpenChange={(o) => !o && setPicking(null)}
          channels={catalogs.channels}
          current={channelId}
          onPick={onPick}
        />
      )}
    </div>
  )
}
