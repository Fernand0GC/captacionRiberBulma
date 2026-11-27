import { useState, type FormEvent } from 'react'
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
import { isFreelanceChannel } from './freelance'
import { FreelancerPicker } from './FreelancerPicker'
import { InterestToggle } from './InterestToggle'
import { asksOccupation } from './occupation'
import { ProductPicker } from './ProductPicker'
import { ReferrerPicker } from './ReferrerPicker'
import {
  findExact,
  mergeOptions,
  nextRemembered,
  optionToChoice,
  readRemembered,
  saveRemembered,
  toPayload,
  type ReferrerChoice,
} from './referrerPick'
import { useCatalogs } from './useCatalogs'

type Form = { full_name: string; phone: string; interest: string; occupation: string; address: string }
type Errors = Partial<Record<'full_name' | 'phone' | 'referrer' | 'product', string>>

const EMPTY: Form = { full_name: '', phone: '', interest: '', occupation: '', address: '' }
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
  const channelId = getDayChannel(profile!.id)
  const channelDetail = getDayChannelDetail(profile!.id)
  const channelName = catalogs?.channels.find((c) => Number(c.value) === channelId)?.label
  const freelanceMode = isFreelanceChannel(channelName)
  const showOccupation = !freelanceMode && asksOccupation(channelName)
  // Referidos (specs 005 y 010): se elige de la lista de la sucursal (catálogo guardado, sirve sin señal) o se
  // escribe uno nuevo, que viaja dentro de la captación. La casilla se muestra siempre, haya lista o no.
  const [referred, setReferred] = useState(false)
  const [referrer, setReferrer] = useState<ReferrerChoice | null>(null)
  const [referrerQuery, setReferrerQuery] = useState('')
  const captureBranch = profile!.branch_id ?? getCaptureBranch(profile!.id)
  const referrerOptions = mergeOptions(catalogs?.referrers ?? [], readRemembered(profile!.id), captureBranch)
    .filter((o) => !freelanceMode || o.kind === 'freelance')

  const set = (k: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    const errs = validate(form)
    // Si escribió un nombre que ya existe y no lo tocó en la lista, se toma ese.
    const exact = (freelanceMode || referred) && !referrer ? findExact(referrerOptions, referrerQuery) : undefined
    const choice: ReferrerChoice | null = referrer ?? (exact ? optionToChoice(exact) : null)
    if ((freelanceMode || referred) && !choice) {
      errs.referrer = freelanceMode
        ? 'Escribe el nombre del freelancer.'
        : referrerQuery.trim()
          ? 'Elige uno de la lista o toca «Agregar».'
          : 'Escribe quién lo recomendó.'
    }
    if (freelanceMode && productId === null) errs.product = 'Elige el producto que compró.'
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
        ...(freelanceMode ? { sold: true } : {
          interest: (form.interest || undefined) as 'high' | 'medium' | 'low' | undefined,
          occupation: showOccupation ? form.occupation.trim() || undefined : undefined,
          address: form.address.trim() || undefined,
        }),
        // Sin sucursal propia: la elegida en Registrar (el servidor valida que pueda registrar ahí).
        branch_id: profile!.branch_id === null ? (getCaptureBranch(profile!.id) ?? undefined) : undefined,
        ...((freelanceMode || referred) && choice ? toPayload(choice) : {}),
        client_created_at: new Date().toISOString(),
      })
      // Un referidor recién escrito se recuerda para sugerirlo en el próximo registro, aun sin señal.
      if ((freelanceMode || referred) && choice && choice.id === null && captureBranch !== null) {
        saveRemembered(
          profile!.id,
          nextRemembered(readRemembered(profile!.id), { name: choice.name, kind: choice.kind, branch_id: captureBranch }, catalogs?.referrers ?? []),
        )
      }
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

        {showOccupation && (
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
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink/80">
            {freelanceMode ? <>Producto que compró <span className="text-gold-dark">*</span></> : <>Producto de interés <span className="font-normal text-ink/40">(opcional)</span></>}
          </span>
          {catalogs ? (
            <ProductPicker catalogs={catalogs} value={productId} onChange={(id) => {
              setProductId(id)
              setErrors((er) => ({ ...er, product: undefined }))
            }} />
          ) : (
            <p className="text-sm text-ink/50">Conéctate una vez para descargar la lista de productos.</p>
          )}
          {errors.product && <p role="alert" className="text-sm text-rb-red">{errors.product}</p>}
        </div>

        <div className="flex flex-col gap-2">
          {!freelanceMode && (
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-ink/80">
              <input
                type="checkbox"
                className="h-5 w-5 accent-gold-dark"
                checked={referred}
                onChange={(e) => {
                  setReferred(e.target.checked)
                  setErrors((er) => ({ ...er, referrer: undefined }))
                }}
              />
              Es referido <span className="font-normal text-ink/50">(alguien lo recomendó)</span>
            </label>
          )}
          {freelanceMode ? (
            <FreelancerPicker
              options={referrerOptions.filter((option) => option.kind === 'freelance')}
              value={referrer}
              onChange={(v) => {
                setReferrer(v)
                setErrors((er) => ({ ...er, referrer: undefined }))
              }}
              error={errors.referrer}
            />
          ) : referred && (
            <ReferrerPicker
              options={referrerOptions}
              value={referrer}
              onChange={(v) => {
                setReferrer(v)
                setErrors((er) => ({ ...er, referrer: undefined }))
              }}
              query={referrerQuery}
              onQueryChange={(q) => {
                setReferrerQuery(q)
                setErrors((er) => ({ ...er, referrer: undefined }))
              }}
              error={errors.referrer}
            />
          )}
        </div>

        {!freelanceMode && (
          <>
            <Field label="Dirección o referencia" optional>
              {(id) => <TextInput id={id} autoComplete="off" value={form.address} onChange={(e) => set('address')(e.target.value)} />}
            </Field>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink/80">
                Nivel de interés <span className="font-normal text-ink/40">(opcional)</span>
              </span>
              <InterestToggle value={form.interest} onChange={set('interest')} />
              {form.interest === 'high' && (
                <p className="text-sm text-ink/60" aria-live="polite">
                  {profile!.role === 'field_volunteer'
                    ? 'Pasa directo a Cliente potencial, a cargo del encargado.'
                    : 'Pasa directo a Cliente potencial, a tu cargo (aparece en Mis contactos).'}
                </p>
              )}
            </div>
          </>
        )}

        <Button type="submit" disabled={saving} className="mt-2 min-h-16 font-display text-xl">
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </div>
  )
}
