import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MdCall, MdChat } from 'react-icons/md'
import { rememberMethod } from './lastAction'

const MENU_W = 240
const MENU_H = 104

/** Solo el número; al tocarlo: llamar o escribir por WhatsApp (no se llama por teléfono). */
export function PhoneMenu({ id, name, phoneRaw, phoneNorm }: { id: string; name: string; phoneRaw: string; phoneNorm: string }) {
  const box = useRef<HTMLDivElement>(null)
  // Posición fija en pantalla: así el menú no queda cortado dentro de la tabla (que tiene scroll lateral).
  const [pos, setPos] = useState<CSSProperties | null>(null)
  const open = pos !== null
  function toggle() {
    if (open) return setPos(null)
    const r = box.current!.getBoundingClientRect()
    const left = Math.max(8, Math.min(r.left, window.innerWidth - MENU_W - 8))
    // Si no entra debajo del número, se abre hacia arriba.
    setPos(r.bottom + MENU_H + 8 > window.innerHeight ? { left, bottom: window.innerHeight - r.top + 4 } : { left, top: r.bottom + 4 })
  }
  const isMobile = /^[567]\d{7}$/.test(phoneNorm)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setPos(null)
    }
    // Al desplazar la página o cambiar el tamaño, el menú se cierra (si no, quedaría flotando en otro lugar).
    const dismiss = () => setPos(null)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
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
        onClick={toggle}
        className="min-h-10 rounded-xl px-3 font-semibold tabular-nums text-ink underline decoration-gold decoration-2 underline-offset-4 active:bg-sand"
      >
        {phoneRaw}
      </button>
      {open && (
        <div role="menu" style={pos} className="fixed z-50 flex w-60 flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-ink/10">
          <a
            role="menuitem"
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              rememberMethod(id, 'whatsapp_call')
              setPos(null)
            }}
            className="flex min-h-12 items-center gap-3 px-4 font-semibold active:bg-sand"
          >
            <MdCall aria-hidden className="h-5 w-5 shrink-0 text-ink/70" /> Abrir WhatsApp para llamar
          </a>
          <a
            role="menuitem"
            href={`${wa}?text=${greeting}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              rememberMethod(id, 'message')
              setPos(null)
            }}
            className="flex min-h-12 items-center gap-3 border-t border-ink/5 px-4 font-semibold active:bg-sand"
          >
            <MdChat aria-hidden className="h-5 w-5 shrink-0 text-ink/70" /> Enviar mensaje por WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}
