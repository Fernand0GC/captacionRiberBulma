import Dexie, { type Table } from 'dexie'

// contracts/sync.md. Único dato de clientes en el dispositivo: captaciones aún no confirmadas.
export type CapturePayload = {
  id: string
  full_name: string
  phone: string
  product_id?: number
  channel_id?: number
  channel_detail?: string
  interest?: 'high' | 'medium' | 'low'
  occupation?: string
  address?: string
  branch_id?: number
  /** De quién vino el contacto (spec 005). Si al sincronizar no es válido, el servidor lo guarda nulo. */
  referrer_id?: number
  client_created_at: string
}

export type OutboxState = 'pending' | 'sending' | 'blocked'

export type OutboxRow = {
  id: string
  userId: string
  payload: CapturePayload
  createdAt: string
  attempts: number
  lastError: string | null
  state: OutboxState
  nextAttemptAt: number
}

export type MetaRow = { key: string; value: unknown }

class CaptureDB extends Dexie {
  outbox!: Table<OutboxRow, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('captacion')
    this.version(1).stores({
      outbox: 'id, userId, [userId+state], createdAt',
      meta: 'key',
    })
  }
}

export const db = new CaptureDB()

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
