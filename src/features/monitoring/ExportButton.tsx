import { useState } from 'react'
import { MdFileDownload } from 'react-icons/md'
import { useToast } from '@/ui/Toast'

/** Botón "Exportar Excel" de las vistas de monitoreo: `run` descarga y devuelve el mensaje de éxito. */
export function ExportButton({ disabled, run }: { disabled: boolean; run: () => Promise<string> }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function onClick() {
    setBusy(true)
    try {
      toast(await run(), 'success')
    } catch (e) {
      toast((e as Error).message || 'No se pudo exportar', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy || disabled}
      className="bg-gold-gradient flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink shadow-sm disabled:opacity-50"
    >
      <MdFileDownload className="text-lg" aria-hidden />
      {busy ? 'Exportando…' : 'Exportar Excel'}
    </button>
  )
}
