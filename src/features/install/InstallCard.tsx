import { useState, type ReactNode } from 'react'
import { MdAddBox, MdInstallMobile, MdIosShare, MdMoreVert } from 'react-icons/md'
import { hideInstall, promptInstall, useInstallMode } from './install'

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/20 text-sm font-bold text-gold-light">{n}</span>
      <span className="flex flex-wrap items-center gap-1">{children}</span>
    </li>
  )
}

const Key = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 font-semibold text-white">{children}</span>
)

/**
 * Aviso para instalar la app en el celular (pantalla de ingreso y menú).
 * Android con instalador listo: un toque. iPhone y el resto: los pasos a mano. Ya instalada: no aparece.
 */
export function InstallCard({ className = '' }: { className?: string }) {
  const mode = useInstallMode()
  const [copied, setCopied] = useState(false)
  if (mode === 'none') return null

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.origin)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section aria-label="Instalar la app" className={`w-full rounded-3xl bg-white/5 p-4 text-sm text-white/80 ring-1 ring-gold/30 ${className}`}>
      <p className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-gold-light">
        <MdInstallMobile aria-hidden className="text-xl" />
        Instala Captación en tu celular
      </p>

      {mode === 'prompt' && (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="bg-gold-gradient min-h-12 w-full rounded-2xl font-semibold text-ink shadow-gold active:brightness-95"
        >
          Instalar app
        </button>
      )}

      {mode === 'ios' && (
        <ol className="flex flex-col gap-2.5">
          <Step n={1}>
            Abajo, toca <Key><MdIosShare aria-hidden /> Compartir</Key>
          </Step>
          <Step n={2}>
            Elige <Key><MdAddBox aria-hidden /> Agregar a inicio</Key>
          </Step>
        </ol>
      )}

      {mode === 'android' && (
        <ol className="flex flex-col gap-2.5">
          <Step n={1}>
            Arriba a la derecha, toca <Key><MdMoreVert aria-hidden /></Key>
          </Step>
          <Step n={2}>
            Elige <Key>Instalar app</Key> o <Key>Agregar a pantalla principal</Key>
          </Step>
        </ol>
      )}

      {mode === 'inapp' && (
        <div className="flex flex-col gap-3">
          <p>
            Desde WhatsApp no se puede instalar. Abre el link en <b className="text-white">Chrome</b> (Android) o <b className="text-white">Safari</b>{' '}
            (iPhone).
          </p>
          <ol className="flex flex-col gap-2.5">
            <Step n={1}>
              Toca <Key><MdMoreVert aria-hidden /></Key> y elige <Key>Abrir en el navegador</Key>
            </Step>
            <Step n={2}>O copia el link y pégalo en Chrome o Safari</Step>
          </ol>
          <button type="button" onClick={() => void copyLink()} className="min-h-11 rounded-2xl font-semibold text-gold-light ring-1 ring-gold/40 active:bg-white/10">
            {copied ? 'Link copiado ✓' : 'Copiar link'}
          </button>
        </div>
      )}

      <button type="button" onClick={hideInstall} className="mt-2 min-h-10 w-full text-xs text-white/45 active:text-white/70">
        Ya la tengo instalada
      </button>
    </section>
  )
}
