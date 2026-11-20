import { normalizeText } from '@/lib/search'
import type { CatalogReferrer } from './useCatalogs'

// Referido al registrar (spec 010): quien registra elige un referidor de su sucursal o escribe uno nuevo.
// Lógica pura (sin React) para probarla con Vitest; lo único con efecto es recordar los recién escritos.

/** Tipos que puede elegir quien registra; «canal o app» queda para la pantalla del jefe. */
export const NEW_REFERRER_KINDS = ['client', 'staff', 'freelance', 'other'] as const
export type NewReferrerKind = (typeof NEW_REFERRER_KINDS)[number]

export const NEW_KIND_LABEL: Record<NewReferrerKind, string> = {
  client: 'Cliente',
  staff: 'Compañero de trabajo',
  freelance: 'Freelance',
  other: 'Otro',
}

/** Referidor que todavía no existe en el servidor: viaja dentro de la captación (research R1). */
export type NewReferrer = { name: string; kind: NewReferrerKind }

/** Lo elegido en el formulario: uno del catálogo (con id) o uno escrito. */
export type ReferrerChoice = { id: number; name: string } | { id: null; name: string; kind: NewReferrerKind }

/** Opción de la lista de sugerencias. `id: null` = recién escrito en este celular, aún sin subir. */
export type ReferrerOption = { id: number | null; name: string; kind: string }

export const NAME_MIN = 2
export const NAME_MAX = 60

/** Sin espacios al inicio, al final ni repetidos (igual que el servidor). */
export function cleanName(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

/** Clave de comparación: minúsculas, sin tildes ni espacios de más. Igual que `referrer_key` en la base. */
export function referrerKey(s: string): string {
  return normalizeText(cleanName(s))
}

export function validName(s: string): boolean {
  const n = cleanName(s)
  return n.length >= NAME_MIN && n.length <= NAME_MAX
}

/** Catálogo de la sucursal + recién escritos que el catálogo todavía no trae (sin repetir por clave). */
export function mergeOptions(catalog: CatalogReferrer[], remembered: RememberedReferrer[], branchId: number | null): ReferrerOption[] {
  const own = catalog.filter((r) => r.branch_id === branchId)
  const keys = new Set(own.map((r) => referrerKey(r.name)))
  const extra = remembered.filter((r) => r.branch_id === branchId && !keys.has(referrerKey(r.name)))
  return [...own.map((r) => ({ id: r.id, name: r.name, kind: r.kind })), ...extra.map((r) => ({ id: null, name: r.name, kind: r.kind }))]
}

const isNewKind = (k: string): k is NewReferrerKind => (NEW_REFERRER_KINDS as readonly string[]).includes(k)

/** Una opción de la lista como elección del formulario. Las recién escritas (sin id) conservan su tipo. */
export function optionToChoice(o: ReferrerOption): ReferrerChoice {
  return o.id !== null ? { id: o.id, name: o.name } : { id: null, name: o.name, kind: isNewKind(o.kind) ? o.kind : 'other' }
}

/** Etiqueta del tipo de una opción recién escrita; undefined si es del catálogo (su etiqueta la da el reporte). */
export function newKindLabel(o: ReferrerOption): string | undefined {
  return o.id === null && isNewKind(o.kind) ? NEW_KIND_LABEL[o.kind] : undefined
}

/** Sugerencias para lo escrito: contiene todas las palabras, sin tildes. Vacío = todas. */
export function suggest(options: ReferrerOption[], query: string, max = 6): ReferrerOption[] {
  const words = referrerKey(query).split(' ').filter(Boolean)
  return options.filter((o) => words.every((w) => referrerKey(o.name).includes(w))).slice(0, max)
}

/** La opción con exactamente ese nombre (por clave), si existe. */
export function findExact(options: ReferrerOption[], query: string): ReferrerOption | undefined {
  const key = referrerKey(query)
  return key ? options.find((o) => referrerKey(o.name) === key) : undefined
}

/** Se puede ofrecer «Agregar»: nombre válido y que no exista ya. */
export function canAdd(options: ReferrerOption[], query: string): boolean {
  return validName(query) && !findExact(options, query)
}

/** Lo que va en la captación: el id si es del catálogo, o el referidor nuevo. */
export function toPayload(choice: ReferrerChoice): { referrer_id?: number; referrer_new?: NewReferrer } {
  return choice.id !== null ? { referrer_id: choice.id } : { referrer_new: { name: cleanName(choice.name), kind: choice.kind } }
}

// Recién escritos -----------------------------------------------------------------------------------
// Se recuerdan por usuario para sugerirlos en el siguiente registro aunque no haya señal ni catálogo nuevo (R7).
// Reenviar el mismo nombre es seguro: el servidor lo resuelve por clave (R2).

export type RememberedReferrer = { name: string; kind: NewReferrerKind; branch_id: number }

const rememberedKey = (userId: string) => `captacion.${userId}.newReferrers`
const MAX_REMEMBERED = 30

export function readRemembered(userId: string): RememberedReferrer[] {
  try {
    const raw = localStorage.getItem(rememberedKey(userId))
    return raw ? (JSON.parse(raw) as RememberedReferrer[]) : []
  } catch {
    return []
  }
}

/** Agrega uno (sin repetir por clave y sucursal) y descarta los que el catálogo ya trae. */
export function nextRemembered(list: RememberedReferrer[], added: RememberedReferrer | null, catalog: CatalogReferrer[]): RememberedReferrer[] {
  const inCatalog = new Set(catalog.map((r) => `${r.branch_id}|${referrerKey(r.name)}`))
  const id = (r: RememberedReferrer) => `${r.branch_id}|${referrerKey(r.name)}`
  const kept = list.filter((r) => !inCatalog.has(id(r)) && (!added || id(r) !== id(added)))
  const next = added && !inCatalog.has(id(added)) ? [...kept, { ...added, name: cleanName(added.name) }] : kept
  return next.slice(-MAX_REMEMBERED)
}

export function saveRemembered(userId: string, list: RememberedReferrer[]): void {
  try {
    localStorage.setItem(rememberedKey(userId), JSON.stringify(list))
  } catch {
    /* sin almacenamiento: solo se pierde la sugerencia */
  }
}
