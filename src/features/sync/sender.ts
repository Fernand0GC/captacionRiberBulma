import { AppError, isTransient, toAppError } from '@/lib/errors'
import { db, type CapturePayload, type OutboxRow } from './db'

export type SubmitResult = { id: string; result: 'accepted' | 'duplicate' }
export type SubmitFn = (payload: CapturePayload) => Promise<SubmitResult>
export type FlushEvent =
  | { type: 'accepted'; row: OutboxRow }
  | { type: 'duplicate'; row: OutboxRow }
  | { type: 'blocked'; row: OutboxRow; error: AppError }

export type FlushSummary = { accepted: number; duplicates: number; blocked: number; retried: number }

const BASE_DELAY_MS = 2_000
const MAX_DELAY_MS = 60_000

export function backoffDelay(attempts: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_DELAY_MS)
}

export async function enqueue(userId: string, payload: CapturePayload): Promise<void> {
  await db.outbox.put({
    id: payload.id,
    userId,
    payload,
    createdAt: payload.client_created_at,
    attempts: 0,
    lastError: null,
    state: 'pending',
    nextAttemptAt: 0,
  })
}

let inFlight: Promise<FlushSummary> | null = null

/**
 * Envía las captaciones pendientes del usuario, una por una y en orden.
 * Un solo envío a la vez (en memoria + navigator.locks entre pestañas).
 * Borra cada fila apenas el servidor la confirma (FR-015).
 */
export function flushOutbox(opts: {
  userId: string
  submit: SubmitFn
  now?: () => number
  onEvent?: (e: FlushEvent) => void
}): Promise<FlushSummary> {
  if (inFlight) return inFlight
  const run = () => doFlush(opts)
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  const p: Promise<FlushSummary> = locks ? (locks.request('captacion-outbox', run) as unknown as Promise<FlushSummary>) : run()
  const tracked = p.finally(() => {
    inFlight = null
  })
  inFlight = tracked
  return tracked
}

async function doFlush({
  userId,
  submit,
  now = Date.now,
  onEvent,
}: {
  userId: string
  submit: SubmitFn
  now?: () => number
  onEvent?: (e: FlushEvent) => void
}): Promise<FlushSummary> {
  const summary: FlushSummary = { accepted: 0, duplicates: 0, blocked: 0, retried: 0 }
  const rows = (await db.outbox.where('[userId+state]').equals([userId, 'pending']).sortBy('createdAt')).filter(
    (r) => r.nextAttemptAt <= now(),
  )

  for (const row of rows) {
    await db.outbox.update(row.id, { state: 'sending' })
    try {
      const res = await submit(row.payload)
      await db.outbox.delete(row.id)
      if (res.result === 'duplicate') {
        summary.duplicates++
        onEvent?.({ type: 'duplicate', row })
      } else {
        summary.accepted++
        onEvent?.({ type: 'accepted', row })
      }
    } catch (err) {
      const e = toAppError(err)
      if (isTransient(e)) {
        const attempts = row.attempts + 1
        await db.outbox.update(row.id, {
          state: 'pending',
          attempts,
          lastError: e.code,
          nextAttemptAt: now() + backoffDelay(attempts),
        })
        summary.retried++
        break // sin red o con límite: no tiene sentido seguir con las demás ahora
      }
      await db.outbox.update(row.id, { state: 'blocked', lastError: e.code })
      summary.blocked++
      onEvent?.({ type: 'blocked', row, error: e })
    }
  }
  return summary
}

/** Filas que quedaron en `sending` por un cierre abrupto vuelven a `pending` al iniciar. */
export async function recoverInterrupted(userId: string): Promise<void> {
  await db.outbox.where('[userId+state]').equals([userId, 'sending']).modify({ state: 'pending' })
}

export async function pendingCount(userId: string): Promise<number> {
  return db.outbox.where('[userId+state]').equals([userId, 'pending']).count()
}

export async function discardPending(userId: string): Promise<void> {
  await db.outbox.where('userId').equals(userId).delete()
}
