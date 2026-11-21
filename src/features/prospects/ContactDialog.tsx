import { useEffect } from 'react'
import { followupRowOf, useClient } from '@/features/client/api'
import { ResultDialog } from '@/features/followup/ResultDialog'
import { useToast } from '@/ui/Toast'

/** Registro de contacto sobre la misma tabla (Captaciones y Seguimientos): trae la ficha y abre el mismo modal que en
 * Mis contactos. Quien lo registra queda como responsable. */
export function ContactDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useClient(id)
  const toast = useToast()
  const failed = q.isError ? (q.error as Error).message : null
  useEffect(() => {
    if (!failed) return
    toast(failed, 'error')
    onClose()
  }, [failed, toast, onClose])
  if (!q.data) return null
  return <ResultDialog row={followupRowOf(q.data.prospect)} onClose={onClose} />
}
