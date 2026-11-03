import { useState } from 'react'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Field, TextInput } from '@/ui/Field'
import { groupChannels } from './channelGroups'
import type { ChannelOption } from './useCatalogs'

/** Canal del día + su descripción (dónde o qué). La descripción es obligatoria: es lo que permite medir por punto. */
export function ChannelPicker({
  open,
  onOpenChange,
  channels,
  current,
  currentDetail,
  onPick,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  channels: ChannelOption[]
  current: number | null
  currentDetail: string
  onPick: (id: number, detail: string) => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="¿Por qué canal captas hoy?"
      description="Se aplica a todos tus registros de hoy. Lo puedes cambiar cuando quieras."
    >
      {/* El Dialog monta el contenido al abrir: cada vez arranca con lo elegido hoy */}
      <PickerBody channels={channels} current={current} currentDetail={currentDetail} onPick={onPick} />
    </Dialog>
  )
}

function PickerBody({
  channels,
  current,
  currentDetail,
  onPick,
}: {
  channels: ChannelOption[]
  current: number | null
  currentDetail: string
  onPick: (id: number, detail: string) => void
}) {
  const [selected, setSelected] = useState<number | null>(current)
  const [detail, setDetail] = useState(currentDetail)
  const [error, setError] = useState<string>()
  const chosen = channels.find((c) => Number(c.value) === selected)

  function confirm() {
    if (!chosen) return setError('Elige un canal.')
    if (detail.trim().length < 2) return setError('Escribe dónde o qué (ej.: colegio, barrio, publicación).')
    onPick(Number(chosen.value), detail.trim())
  }

  return (
    <div className="flex flex-col gap-5">
      {groupChannels(channels).map((block) => (
        <section key={block.label} role="group" aria-label={block.label} className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-ink/55">{block.label}</h3>
          <div className="grid grid-cols-2 gap-2">
            {block.items.map((c) => {
              const active = Number(c.value) === selected
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setSelected(Number(c.value))
                    setError(undefined)
                  }}
                  aria-pressed={active}
                  className={`min-h-14 rounded-2xl border px-3 text-base font-semibold leading-tight transition ${
                    active
                      ? 'border-gold bg-gold-gradient text-ink shadow-gold'
                      : 'border-ink/10 bg-white text-ink active:bg-sand'
                  }`}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </section>
      ))}

      <div className="flex flex-col gap-3 border-t border-ink/10 pt-4">
        <Field label={chosen ? `Descripción de ${chosen.label}` : 'Descripción del canal'} required>
          {(id) => (
            <TextInput
              id={id}
              value={detail}
              maxLength={120}
              placeholder={chosen?.group === 'store' ? 'Ej.: publicación de televisores' : 'Ej.: Colegio Don Bosco, barrio Litoral'}
              onChange={(e) => {
                setDetail(e.target.value)
                setError(undefined)
              }}
            />
          )}
        </Field>
        {error && (
          <p role="alert" className="text-sm font-medium text-rb-red">
            {error}
          </p>
        )}
        <Button onClick={confirm}>Listo</Button>
      </div>
    </div>
  )
}
