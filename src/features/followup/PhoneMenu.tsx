import { useEffect, useRef, useState } from 'react'
import { rememberMethod } from './lastAction'

/** Solo el número; al tocarlo: llamar o escribir por WhatsApp (no se llama por teléfono). */
export function PhoneMenu({ id, name, phoneRaw, phoneNorm }: { id: string; name: string; phoneRaw: string; phoneNorm: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const isMobile = /^[67]\d{7}$/.test(phoneNorm)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  if (!isMobile) return <span className="tabular-nums text-ink/70" title="Teléfono fijo: sin WhatsApp">{phoneRaw}</span>

  const wa = `https://wa.me/591${phoneNorm}`
  const greeting = encodeURIComponent(`Hola ${name.split(' ')[0]}, te saludamos de Riber Bulma. `)
  return (
    <div className="relative inline-block" ref={box}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Contactar a ${name} (${phoneRaw})`}
        onClick={() => setOpen((o) => !o)}
        className="min-h-10 rounded-xl px-3 font-semibold tabular-nums text-ink underline decoration-gold decoration-2 underline-offset-4 active:bg-sand"
      >
        {phoneRaw}
      </button>
      {open && (
        <div role="menu" className="absolute left-0 z-30 mt-1 flex w-60 flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-ink/10">
          <a
            role="menuitem"
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              rememberMethod(id, 'whatsapp_call')
              setOpen(false)
            }}
            className="flex min-h-12 items-center gap-3 px-4 font-semibold active:bg-sand"
          >
            <span aria-hidden className="text-lg">📞</span> Abrir WhatsApp para llamar
          </a>
          <a
            role="menuitem"
            href={`${wa}?text=${greeting}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              rememberMethod(id, 'message')
              setOpen(false)
            }}
            className="flex min-h-12 items-center gap-3 border-t border-ink/5 px-4 font-semibold active:bg-sand"
          >
            <span aria-hidden className="text-lg">💬</span> Enviar mensaje por WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}
