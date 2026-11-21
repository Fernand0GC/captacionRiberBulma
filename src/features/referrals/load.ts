import { isValidPhone, normalizePhone } from '@/lib/phone'

// Carga de referidos en lote (spec 016). Funciones puras: leer el texto pegado, revisar filas, proponer
// responsables y armar lo que se manda a referral_batch_save. Probadas en tests/unit/referral_load.test.ts.

export const MAX_ROWS = 50

export type LoadRow = {
  key: string
  full_name: string
  phone: string
  product_id: number | null
  /** Responsable elegido a mano; null = automático (lo propone el reparto). */
  assigned_to: string | null
}

export type Assignee = {
  id: string
  full_name: string
  role: 'field_assistant' | 'field_supervisor' | 'branch_manager'
  /** Clientes en Captación sin ningún contacto que ya tiene asignados. */
  pending: number
}

/** Celular que ya tiene un cliente activo (referral_phone_check). Nombre y responsable solo si es de su alcance. */
export type PhoneHit = { norm: string; branch_name: string; full_name: string | null; assigned_to: string | null }

export type AssignMode = 'even' | 'one'

export const ASSIGNEE_ROLE_LABEL: Record<Assignee['role'], string> = {
  field_assistant: 'Auxiliar',
  field_supervisor: 'Supervisor',
  branch_manager: 'Encargado',
}

/** Celular boliviano de 8 dígitos (6… o 7…), con o sin +591, aunque venga con espacios, puntos o guiones. */
const MOBILE = /(?:\+?591)?([67]\d{7})(?!\d)/

/**
 * Lee el mensaje pegado (WhatsApp): una línea por contacto; el primer celular de la línea es el teléfono y lo demás,
 * sin símbolos ni emojis, el nombre. Las líneas sin celular (saludos) se saltan.
 */
export function parsePaste(text: string): { full_name: string; phone: string }[] {
  const out: { full_name: string; phone: string }[] = []
  for (const line of text.split(/\r?\n/)) {
    const joined = line.replace(/(\d)[\s.-]+(?=\d)/g, '$1') // «7654 3210» → «76543210»
    const m = MOBILE.exec(joined)
    if (!m?.[1]) continue
    const full_name = joined
      .replace(m[0], ' ')
      .replace(/[^\p{L}\p{M}'. ]/gu, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[ .]+|[ .]+$/g, '')
    out.push({ full_name, phone: m[1] })
  }
  return out
}

export const isBlank = (r: Pick<LoadRow, 'full_name' | 'phone'>) => r.full_name.trim() === '' && r.phone.trim() === ''

export type RowIssue = 'name' | 'phone' | 'repeated' | 'exists'

/** Por qué una fila no se puede guardar (null = lista). Las filas vacías no se revisan. */
export function rowIssue(row: LoadRow, rows: LoadRow[], hits: ReadonlyMap<string, PhoneHit>): RowIssue | null {
  const name = row.full_name.trim()
  if (name.length < 3 || name.length > 120) return 'name'
  if (!isValidPhone(row.phone)) return 'phone'
  const norm = normalizePhone(row.phone)
  if (hits.has(norm)) return 'exists'
  const first = rows.find((r) => !isBlank(r) && isValidPhone(r.phone) && normalizePhone(r.phone) === norm)
  if (first && first.key !== row.key) return 'repeated'
  return null
}

export const readyRows = (rows: LoadRow[], hits: ReadonlyMap<string, PhoneHit>) =>
  rows.filter((r) => !isBlank(r) && rowIssue(r, rows, hits) === null)

/**
 * Responsable de cada fila lista (mismo orden). Las elegidas a mano se respetan y suman carga primero.
 * «even»: reparte entre auxiliares, siempre al que menos pendientes tiene (empate: el primero por nombre).
 * «one»: todas a `one` (o al primer auxiliar). Sin auxiliares, las automáticas quedan sin responsable (null).
 */
export function proposeAssignees(ready: LoadRow[], assignees: Assignee[], mode: AssignMode, one: string | null): (string | null)[] {
  const valid = new Set(assignees.map((a) => a.id))
  const aux = assignees.filter((a) => a.role === 'field_assistant')
  const load = new Map(assignees.map((a) => [a.id, a.pending]))
  for (const r of ready) if (r.assigned_to && valid.has(r.assigned_to)) load.set(r.assigned_to, (load.get(r.assigned_to) ?? 0) + 1)
  const target = mode === 'one' ? (one && valid.has(one) ? one : (aux[0]?.id ?? null)) : null
  return ready.map((r) => {
    if (r.assigned_to && valid.has(r.assigned_to)) return r.assigned_to
    if (mode === 'one') return target
    let best: Assignee | undefined
    for (const a of aux) if (!best || (load.get(a.id) ?? 0) < (load.get(best.id) ?? 0)) best = a
    if (!best) return null
    load.set(best.id, (load.get(best.id) ?? 0) + 1)
    return best.id
  })
}

/** Cuántas filas le tocan a cada responsable en esta carga (para «+N ahora»). */
export function countBy(proposal: (string | null)[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const id of proposal) if (id) m.set(id, (m.get(id) ?? 0) + 1)
  return m
}

export type BatchItem = { id: string; full_name: string; phone: string; product_id: number | null; assigned_to: string | null }

/** Filas listas + propuesta → items de referral_batch_save. Los ids los pone quien llama (uuidv7, idempotencia). */
export function buildItems(ready: LoadRow[], proposal: (string | null)[], ids: string[]): BatchItem[] {
  return ready.map((r, i) => ({
    id: ids[i] ?? '',
    full_name: r.full_name.trim().replace(/\s+/g, ' '),
    phone: r.phone.trim(),
    product_id: r.product_id,
    assigned_to: proposal[i] ?? null,
  }))
}

let seq = 0
export const newRow = (product_id: number | null = null): LoadRow => ({
  key: `r${++seq}`,
  full_name: '',
  phone: '',
  product_id,
  assigned_to: null,
})
