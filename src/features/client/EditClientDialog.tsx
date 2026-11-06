import { useState } from 'react'
import { InterestToggle } from '@/features/capture/InterestToggle'
import { ProductPicker } from '@/features/capture/ProductPicker'
import { useCatalogs } from '@/features/capture/useCatalogs'
import type { AppError } from '@/lib/errors'
import { isValidPhone } from '@/lib/phone'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Field, TextInput } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { useToast } from '@/ui/Toast'
import { useUpdateClient, type Client } from './api'
import { CHANNEL_GROUP_LABEL } from '@/features/capture/channelGroups'

export function EditClientDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const { catalogs } = useCatalogs()
  const update = useUpdateClient(client.id)
  const toast = useToast()
  const [v, setV] = useState({
    full_name: client.full_name,
    phone: client.phone_raw,
    product_id: client.product_id,
    channel_id: client.channel_id ? String(client.channel_id) : '',
    channel_detail: client.channel_detail ?? '',
    interest: client.interest ?? '',
    occupation: client.occupation ?? '',
    address: client.address ?? '',
  })
  const [err, setErr] = useState<{ full_name?: string; phone?: string; form?: string }>({})

  async function save() {
    const e: typeof err = {}
    if (v.full_name.trim().length < 3) e.full_name = 'Escribe el nombre completo.'
    if (!isValidPhone(v.phone)) e.phone = 'Celular de 8 dígitos (5…, 6… o 7…) o fijo con código de área.'
    setErr(e)
    if (Object.keys(e).length) return
    try {
      await update.mutateAsync({
        full_name: v.full_name.trim(),
        phone: v.phone.trim(),
        product_id: v.product_id ?? '',
        channel_id: v.channel_id,
        channel_detail: v.channel_detail,
        interest: v.interest,
        occupation: v.occupation,
        address: v.address,
      })
      toast('✓ Datos actualizados', 'success')
      onClose()
    } catch (x) {
      const e2 = x as AppError
      if (e2.code === 'invalid_phone') setErr({ phone: e2.message })
      else if (e2.code === 'invalid_input') setErr({ phone: 'Ese celular ya pertenece a otro cliente.' })
      else setErr({ form: e2.message })
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Editar datos del cliente" description="Cada cambio queda en el historial con quién lo hizo.">
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <Field label="Nombre completo" required error={err.full_name}>
          {(id, d) => <TextInput id={id} aria-describedby={d} invalid={!!err.full_name} value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />}
        </Field>
        <Field label="Celular" required error={err.phone}>
          {(id, d) => <TextInput id={id} aria-describedby={d} invalid={!!err.phone} type="tel" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink/80">Producto de interés</span>
          {catalogs && <ProductPicker catalogs={catalogs} value={v.product_id} onChange={(p) => setV({ ...v, product_id: p })} />}
        </div>
        <Field label="Canal">
          {(id) => <Select id={id} value={v.channel_id} onChange={(c) => setV({ ...v, channel_id: c })} options={(catalogs?.channels ?? []).map((c) => ({ ...c, group: c.group ? CHANNEL_GROUP_LABEL[c.group] : undefined }))} placeholder="Sin canal" />}
        </Field>
        <Field label="Descripción del canal">
          {(id) => <TextInput id={id} maxLength={120} value={v.channel_detail} placeholder="Ej.: Colegio Don Bosco" onChange={(e) => setV({ ...v, channel_detail: e.target.value })} />}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink/80">Nivel de interés</span>
          <InterestToggle value={v.interest} onChange={(i) => setV({ ...v, interest: i })} />
        </div>
        <Field label="Ocupación del cliente">
          {(id) => <TextInput id={id} value={v.occupation} onChange={(e) => setV({ ...v, occupation: e.target.value })} />}
        </Field>
        <Field label="Dirección o referencia">
          {(id) => <TextInput id={id} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />}
        </Field>
        {err.form && <p className="text-sm font-medium text-rb-red">{err.form}</p>}
        <div className="sticky bottom-0 flex gap-2 bg-cream pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={update.isPending} onClick={() => void save()}>
            {update.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
