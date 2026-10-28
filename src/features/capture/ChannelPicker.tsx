import { Dialog } from '@/ui/Dialog'
import type { Option } from '@/ui/Select'

export function ChannelPicker({
  open,
  onOpenChange,
  channels,
  current,
  onPick,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  channels: Option[]
  current: number | null
  onPick: (id: number) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="¿Por qué canal captas hoy?" description="Se aplica a todos tus registros de hoy. Lo puedes cambiar cuando quieras.">
      <div className="grid grid-cols-2 gap-2">
        {channels.map((c) => {
          const active = Number(c.value) === current
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => onPick(Number(c.value))}
              aria-pressed={active}
              className={`min-h-14 rounded-2xl border px-3 text-base font-semibold transition ${
                active ? 'border-gold bg-gold-gradient text-ink shadow-gold' : 'border-ink/10 bg-white text-ink active:bg-sand'
              }`}
            >
              {c.label}
            </button>
          )
        })}
      </div>
    </Dialog>
  )
}
