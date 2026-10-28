import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { enqueue } from '@/features/sync/sender'
import { requestFlush } from '@/features/sync/syncLoop'
import { toAppError } from '@/lib/errors'
import { isValidPhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { uuidv7 } from '@/lib/uuidv7'
import { Button } from '@/ui/Button'
import { Field, TextInput } from '@/ui/Field'
import { useToast } from '@/ui/Toast'
import { getDayChannel } from './channel'
import { InterestToggle } from './InterestToggle'
import { ProductPicker } from './ProductPicker'
import { useCatalogs } from './useCatalogs'

type Form = { full_name: string; phone: string; interest: string; occupation: string; address: string }
type Errors = Partial<Record<'full_name' | 'phone', string>>

const EMPTY: Form = { full_name: '', phone: '', interest: '', occupation: '', address: '' }

// Solo nombre y celular son obligatorios (FR-011).
function validate(f: Form): Errors {
  const e: Errors = {}
  if (f.full_name.trim().length < 3) e.full_name = 'Escribe el nombre completo.'
  if (!isValidPhone(f.phone)) e.phone = 'Celular de 8 dígitos (6… o 7…) o fijo con código de área.'
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
        interest: (form.interest || undefined) as 'high' | 'medium' | 'low' | undefined,
        occupation: form.occupation.trim() || undefined,
        address: form.address.trim() || undefined,
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

  return (
    <div className="min-h-dvh">
      <header className="bg-ink-gradient text-white">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div>
            <h1 className="font-display text-xl font-semibold text-gold-light">Nueva captación</h1>
            <p className="text-sm text-white/60">Canal: {channelName ?? 'sin elegir'}</p>
          </div>
          <button
            type="button"
            className="min-h-11 rounded-full px-4 text-sm font-semibold text-white/80 ring-1 ring-white/20 active:bg-white/10"
            onClick={() => void navigate({ to: '/registrar' })}
          >
            Cancelar
          </button>
        </div>
      </header>

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
            Nivel de interés <span className="font-normal text-ink/40">(opcional)</span>
          </span>
          <InterestToggle value={form.interest} onChange={set('interest')} />
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

        <details className="group rounded-2xl bg-white px-4 ring-1 ring-ink/10 open:pb-4">
          <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between font-semibold text-ink/80">
            <span>
              Más datos <span className="font-normal text-ink/40">(opcional)</span>
            </span>
            <span className="text-gold-dark transition group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="flex flex-col gap-4 pt-1">
            <Field label="Actividad u oficio">
              {(id) => <TextInput id={id} autoComplete="off" value={form.occupation} onChange={(e) => set('occupation')(e.target.value)} />}
            </Field>
            <Field label="Dirección o referencia">
              {(id) => <TextInput id={id} autoComplete="off" value={form.address} onChange={(e) => set('address')(e.target.value)} />}
            </Field>
          </div>
        </details>

        <Button type="submit" disabled={saving} className="mt-2 min-h-16 font-display text-xl">
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </div>
  )
}
