import { lazy, Suspense, useState, type FormEvent } from 'react'
import { MdClose, MdMap, MdPlace } from 'react-icons/md'
import { Navigate, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { enqueue } from '@/features/sync/sender'
import { requestFlush } from '@/features/sync/syncLoop'
import { toAppError } from '@/lib/errors'
import { isValidPhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { uuidv7 } from '@/lib/uuidv7'
import { Button } from '@/ui/Button'
import { PageTitle } from '@/ui/PageTitle'
import { Field, TextInput } from '@/ui/Field'
import { useToast } from '@/ui/Toast'
import { getCaptureBranch, getDayChannel, getDayChannelDetail } from './channel'
import { InterestToggle } from './InterestToggle'
import type { LatLng } from './MapPicker'
import { ProductPicker } from './ProductPicker'
import { useCatalogs } from './useCatalogs'

type Form = { full_name: string; phone: string; interest: string; occupation: string; address: string }
type Errors = Partial<Record<'full_name' | 'phone', string>>

const EMPTY: Form = { full_name: '', phone: '', interest: '', occupation: '', address: '' }
// Leaflet solo se descarga al abrir el mapa: no pesa en la pantalla de registro.
const MapPicker = lazy(() => import('./MapPicker'))
const RUBROS = ['Independiente/Negocio/Microcrédito', "Dependiente/Asalariado"] 
// Solo nombre y celular son obligatorios (FR-011).
function validate(f: Form): Errors {
  const e: Errors = {}
  if (f.full_name.trim().length < 3) e.full_name = 'Escribe el nombre completo.'
  if (!isValidPhone(f.phone)) e.phone = 'Celular de 8 dígitos (5…, 6… o 7…) o fijo con código de área.'
  return e
}

/** Con señal consulta si el teléfono ya existe; sin señal (o si falla) deja que el servidor decida al sincronizar. */
async function phoneTaken(phone: string): Promise<boolean> {
  if (!navigator.onLine) return false
  try {
    const { data, error } = await supabase.rpc('phone_available', { phone })
    if (error) throw error
    return data === false
  } catch (err) {
    const e = toAppError(err)
    if (e.code === 'invalid_phone') throw e
    return false
  }
}

export function CaptureForm() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { catalogs } = useCatalogs()
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [productId, setProductId] = useState<number | null>(null)
  const [location, setLocation] = useState<LatLng | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const channelId = getDayChannel(profile!.id)
  const channelDetail = getDayChannelDetail(profile!.id)
  const channelName = catalogs?.channels.find((c) => Number(c.value) === channelId)?.label

  const set = (k: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      if (await phoneTaken(form.phone)) {
        setErrors({ phone: 'Este teléfono ya está registrado.' })
        return
      }
      await enqueue(profile!.id, {
        id: uuidv7(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        product_id: productId ?? undefined,
        channel_id: channelId ?? undefined,
        channel_detail: channelDetail || undefined,
        interest: (form.interest || undefined) as 'high' | 'medium' | 'low' | undefined,
        occupation: form.occupation.trim() || undefined,
        address: form.address.trim() || undefined,
        lat: location?.lat,
        lng: location?.lng,
        // Sin sucursal propia: la elegida en Registrar (el servidor valida que pueda registrar ahí).
        branch_id: profile!.branch_id === null ? (getCaptureBranch(profile!.id) ?? undefined) : undefined,
        client_created_at: new Date().toISOString(),
      })
      requestFlush()
      toast(navigator.onLine ? '✓ Guardado' : '✓ Guardado sin señal. Se subirá solo.', 'success')
      void navigate({ to: '/registrar', replace: true })
    } catch (err) {
      const e = toAppError(err)
      if (e.code === 'invalid_phone') setErrors({ phone: e.message })
      else toast('No se pudo guardar. Intenta de nuevo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Sin sucursal propia ni elegida: primero se elige en Registrar (si no, el servidor la rechazaría).
  if (profile!.branch_id === null && getCaptureBranch(profile!.id) === null) return <Navigate to="/registrar" replace />

  return (
    <div>
      <div className="mx-auto max-w-md px-4 pt-4">
        <PageTitle
          title="Nueva captación"
          subtitle={`Canal: ${channelName ?? 'sin elegir'}${channelName && channelDetail ? ` · ${channelDetail}` : ''}`}
          actions={
            <button
              type="button"
              className="min-h-11 rounded-full px-4 text-sm font-semibold text-ink/70 ring-1 ring-ink/15 active:bg-ink/5"
              onClick={() => void navigate({ to: '/registrar' })}
            >
              Cancelar
            </button>
          }
        />
      </div>

      <form onSubmit={onSubmit} className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-10 pt-5" noValidate>
        <Field label="Nombre completo" required error={errors.full_name}>
          {(id, d) => (
            <TextInput
              id={id}
              aria-describedby={d}
              invalid={!!errors.full_name}
              autoComplete="off"
              autoCapitalize="words"
              autoFocus
              value={form.full_name}
              onChange={(e) => set('full_name')(e.target.value)}
            />
          )}
        </Field>
        <Field label="Celular" required error={errors.phone}>
          {(id, d) => (
            <TextInput
              id={id}
              aria-describedby={d}
              invalid={!!errors.phone}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="7xxxxxxx"
              value={form.phone}
              onChange={(e) => set('phone')(e.target.value)}
            />
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink/80">
            Ocupación del cliente <span className="font-normal text-ink/40">(opcional)</span>
          </span>
          <div className="flex flex-col gap-2">
            {RUBROS.map((rubro) => (
              <button
                key={rubro}
                type="button"
                onClick={() => set('occupation')(form.occupation === rubro ? '' : rubro)}
                className={`rounded-xl px-4 py-3 text-left text-sm font-medium ring-1 transition-colors ${
                  form.occupation === rubro
                    ? 'bg-charcoal text-gold ring-gold-dark'
                    : 'bg-white text-ink/80 ring-ink/10 active:bg-ink/5'
                }`}
              >
                {rubro}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink/80">
            Producto de interés <span className="font-normal text-ink/40">(opcional)</span>
          </span>
          {catalogs ? (
            <ProductPicker catalogs={catalogs} value={productId} onChange={setProductId} />
          ) : (
            <p className="text-sm text-ink/50">Conéctate una vez para descargar la lista de productos.</p>
          )}
        </div>

        <Field label="Dirección o referencia" optional>
          {(id) => (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <TextInput
                  id={id}
                  autoComplete="off"
                  placeholder="Escribe la dirección"
                  className="min-w-0 flex-1"
                  value={form.address}
                  onChange={(e) => set('address')(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setMapOpen(true)}
                  aria-label={location ? 'Cambiar ubicación en el mapa' : 'Abrir mapa'}
                  className={`grid size-13 shrink-0 place-items-center rounded-2xl ring-1 active:bg-ink/5 ${
                    location ? 'bg-charcoal text-gold ring-gold-dark' : 'bg-white text-ink/70 ring-ink/15'
                  }`}
                >
                  <MdMap className="size-6" />
                </button>
              </div>
              {location && (
                <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-ink/10" data-testid="location-chip">
                  <MdPlace className="size-5 shrink-0 text-rb-red" />
                  <button type="button" onClick={() => setMapOpen(true)} className="flex-1 text-left font-medium text-ink/80">
                    Ubicación marcada en el mapa
                  </button>
                  <button type="button" onClick={() => setLocation(null)} aria-label="Quitar ubicación" className="grid size-8 place-items-center rounded-full text-ink/50 active:bg-ink/5">
                    <MdClose className="size-5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </Field>
        {mapOpen && (
          <Suspense fallback={<div className="fixed inset-0 z-50 grid place-items-center bg-cream text-ink/60">Cargando mapa…</div>}>
            <MapPicker
              value={location}
              onClose={() => setMapOpen(false)}
              onPick={(p) => {
                setLocation(p)
                setMapOpen(false)
              }}
            />
          </Suspense>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink/80">
            Nivel de interés <span className="font-normal text-ink/40">(opcional)</span>
          </span>
          <InterestToggle value={form.interest} onChange={set('interest')} />
        </div>

        <Button type="submit" disabled={saving} className="mt-2 min-h-16 font-display text-xl">
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </div>
  )
}
