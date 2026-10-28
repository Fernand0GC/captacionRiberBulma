import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type CapturePayload } from '@/features/sync/db'
import { backoffDelay, enqueue, flushOutbox, pendingCount, recoverInterrupted } from '@/features/sync/sender'

const U1 = 'user-1'
const U2 = 'user-2'

function payload(id: string, at = '2026-10-28T09:00:00-04:00'): CapturePayload {
  return { id, full_name: 'Juan Pérez', phone: '71234567', product_id: 1, channel_id: 1, interest: 'high', client_created_at: at }
}

beforeEach(async () => {
  await db.outbox.clear()
  await db.meta.clear()
})

describe('flushOutbox', () => {
  it('borra la fila cuando el servidor acepta (FR-015)', async () => {
    await enqueue(U1, payload('a'))
    const submit = vi.fn().mockResolvedValue({ id: 'a', result: 'accepted' })
    const s = await flushOutbox({ userId: U1, submit })
    expect(s.accepted).toBe(1)
    expect(await db.outbox.count()).toBe(0)
  })

  it('borra y avisa cuando el servidor responde duplicate', async () => {
    await enqueue(U1, payload('a'))
    const onEvent = vi.fn()
    await flushOutbox({ userId: U1, submit: vi.fn().mockResolvedValue({ id: 'a', result: 'duplicate' }), onEvent })
    expect(await db.outbox.count()).toBe(0)
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'duplicate' }))
  })

  it('envía en orden de creación', async () => {
    await enqueue(U1, payload('b', '2026-10-28T10:00:00-04:00'))
    await enqueue(U1, payload('a', '2026-10-28T09:00:00-04:00'))
    const order: string[] = []
    await flushOutbox({
      userId: U1,
      submit: async (p) => {
        order.push(p.id)
        return { id: p.id, result: 'accepted' }
      },
    })
    expect(order).toEqual(['a', 'b'])
  })

  it('error de red: mantiene pendiente con backoff y no sigue con las demás', async () => {
    await enqueue(U1, payload('a', '2026-10-28T09:00:00-04:00'))
    await enqueue(U1, payload('b', '2026-10-28T10:00:00-04:00'))
    const submit = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const s = await flushOutbox({ userId: U1, submit, now: () => 1_000 })
    expect(s.retried).toBe(1)
    expect(submit).toHaveBeenCalledTimes(1)
    const a = await db.outbox.get('a')
    expect(a).toMatchObject({ state: 'pending', attempts: 1, lastError: 'network', nextAttemptAt: 1_000 + 2_000 })
  })

  it('rate_limited se trata como transitorio (analyze S2)', async () => {
    await enqueue(U1, payload('a'))
    await flushOutbox({ userId: U1, submit: vi.fn().mockRejectedValue({ message: 'rate_limited' }), now: () => 0 })
    expect(await db.outbox.get('a')).toMatchObject({ state: 'pending', lastError: 'rate_limited' })
  })

  it('respeta el backoff: no reintenta antes de tiempo', async () => {
    await enqueue(U1, payload('a'))
    await db.outbox.update('a', { nextAttemptAt: 5_000 })
    const submit = vi.fn()
    await flushOutbox({ userId: U1, submit, now: () => 4_999 })
    expect(submit).not.toHaveBeenCalled()
  })

  it('forbidden o invalid_input: queda blocked', async () => {
    await enqueue(U1, payload('a'))
    const onEvent = vi.fn()
    const s = await flushOutbox({ userId: U1, submit: vi.fn().mockRejectedValue({ message: 'forbidden' }), onEvent })
    expect(s.blocked).toBe(1)
    expect(await db.outbox.get('a')).toMatchObject({ state: 'blocked', lastError: 'forbidden' })
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'blocked' }))
  })

  it('solo envía las filas del usuario actual', async () => {
    await enqueue(U1, payload('a'))
    await enqueue(U2, payload('b'))
    const submit = vi.fn().mockImplementation(async (p: CapturePayload) => ({ id: p.id, result: 'accepted' }))
    await flushOutbox({ userId: U1, submit })
    expect(submit).toHaveBeenCalledTimes(1)
    expect(await pendingCount(U2)).toBe(1)
  })

  it('un solo envío a la vez: llamadas concurrentes comparten la misma corrida', async () => {
    await enqueue(U1, payload('a'))
    let resolve!: (v: { id: string; result: 'accepted' }) => void
    const submit = vi.fn().mockImplementation(() => new Promise((r) => (resolve = r)))
    const p1 = flushOutbox({ userId: U1, submit })
    const p2 = flushOutbox({ userId: U1, submit })
    await vi.waitFor(() => expect(submit).toHaveBeenCalled())
    resolve({ id: 'a', result: 'accepted' })
    expect(await p1).toEqual(await p2)
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('recupera filas que quedaron en sending tras un cierre abrupto', async () => {
    await enqueue(U1, payload('a'))
    await db.outbox.update('a', { state: 'sending' })
    await recoverInterrupted(U1)
    expect(await pendingCount(U1)).toBe(1)
  })
})

describe('backoffDelay', () => {
  it('crece exponencial con tope de 60 s', () => {
    expect([1, 2, 3, 10].map(backoffDelay)).toEqual([2_000, 4_000, 8_000, 60_000])
  })
})
