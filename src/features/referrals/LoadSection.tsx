import { useMemo, useRef, useState } from 'react'
import { ReferrerPicker } from '@/features/capture/ReferrerPicker'
import { toPayload, type ReferrerChoice, type ReferrerOption } from '@/features/capture/referrerPick'
import { GROUP_LABEL, useCatalogs, type Product, type ProductGroup } from '@/features/capture/useCatalogs'
import { Card } from '@/features/dashboard/charts'
import { normalizePhone, isValidPhone } from '@/lib/phone'
import { uuidv7 } from '@/lib/uuidv7'
import { Button } from '@/ui/Button'
import { useToast } from '@/ui/Toast'
import { usePhoneCheck, useReferralAssignees, useReferrers, useSaveReferralBatch, type BatchResult } from './api'
import {
  ASSIGNEE_ROLE_LABEL,
  buildItems,
  countBy,
  isBlank,
  MAX_ROWS,
  newRow,
  parsePaste,
  proposeAssignees,
  readyRows,
  rowIssue,
  type Assignee,
  type AssignMode,
  type LoadRow,
  type PhoneHit,
} from './load'
import { inputCls, pickBranch, Tabs, th, type ReferralScope } from './parts'

// Referidos › Cargar (spec 016): el jefe carga los contactos que le pasó el personal, elige quién los pasó y a quién
// se asignan, y se guardan de una vez con referral_batch_save (submit_capture + assign_prospects).

const PICKER_TEXT = {
  label: '¿Quién te pasó los contactos?',
  chosen: 'Pasó los contactos',
  placeholder: 'Nombre de quien los pasó',
}

const SAMPLE = [
  'Te paso los contactos que me dieron hoy:',
  'Doña Lucía Mendoza 7654 3210',
  'Gabriela Rojas - 71122334',
].join('\n')

const blankRows = (product: number | null = null) => [newRow(product), newRow(product), newRow(product)]

function issueText(issue: ReturnType<typeof rowIssue>, hit: PhoneHit | undefined): string | null {
  switch (issue) {
    case 'name':
      return 'Escribe el nombre (3 letras o más).'
    case 'phone':
      return 'Celular no válido.'
    case 'repeated':
      return 'Repetido en esta carga.'
    case 'exists':
      if (!hit) return 'Ya existe.'
      return hit.full_name
        ? `Ya existe en ${hit.branch_name}: ${hit.full_name}${hit.assigned_to ? ` (lo atiende ${hit.assigned_to})` : ' (sin responsable)'}.`
        : `Ya existe en otra sucursal (${hit.branch_name}).`
    default:
      return null
  }
}

function ProductSelect({ products, value, onChange, label }: { products: Product[] | null; value: number | null; onChange: (v: number | null) => void; label: string }) {
  const groups = useMemo(() => {
    const m = new Map<ProductGroup, Product[]>()
    for (const p of products ?? []) m.set(p.group, [...(m.get(p.group) ?? []), p])
    return [...m]
  }, [products])
  return (
    <select aria-label={label} className={`${inputCls} w-full`} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{products ? 'Sin producto' : 'Cargando…'}</option>
      {groups.map(([g, list]) => (
        <optgroup key={g} label={GROUP_LABEL[g]}>
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

function BranchPicker({ s }: { s: ReferralScope }) {
  if (s.options.length > 6) {
    return (
      <select aria-label="Sucursal de la carga" className={`${inputCls} min-h-12 w-full rounded-2xl text-base`} value={s.branch ?? ''} onChange={(e) => pickBranch(s, e.target.value ? Number(e.target.value) : undefined)}>
        <option value="">Elige una sucursal</option>
        {s.options.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    )
  }
  return (
    <div role="group" aria-label="Sucursal de la carga" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {s.options.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-pressed={s.branch === b.id}
          onClick={() => pickBranch(s, b.id)}
          className={`min-h-12 rounded-2xl border px-2 text-sm font-semibold ${s.branch === b.id ? 'border-ink bg-ink text-gold-light' : 'border-ink/15 bg-white text-ink/80 active:bg-sand'}`}
        >
          {b.name}
        </button>
      ))}
    </div>
  )
}

function AssigneeList({
  people,
  counts,
  mode,
  one,
  onPick,
}: {
  people: Assignee[]
  counts: Map<string, number>
  mode: AssignMode
  one: string | null
  onPick: (id: string) => void
}) {
  const fallback = people.find((p) => p.role === 'field_assistant')?.id ?? null
  return (
    <div role="group" aria-label="Responsables" className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-ink/10">
      {people.map((p) => {
        const on = mode === 'one' && (one ?? fallback) === p.id
        const gets = counts.get(p.id) ?? 0
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(p.id)}
            data-testid={`assignee-${p.full_name}`}
            className={`flex min-h-14 items-center justify-between gap-3 border-b border-ink/5 px-4 text-left last:border-b-0 ${on ? 'bg-gold/10' : 'active:bg-sand'}`}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{p.full_name}</span>
              <span className="block text-xs text-ink/50">{ASSIGNEE_ROLE_LABEL[p.role]}</span>
            </span>
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {gets > 0 && (
                <span className="inline-flex items-center rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold-dark ring-1 ring-gold/30">+{gets} ahora</span>
              )}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${p.pending ? 'bg-rb-red/10 text-rb-red ring-1 ring-rb-red/20' : 'bg-ink/5 text-ink/60'}`}
              >
                {p.pending} sin contactar
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ResultCard({ result, people, onSeeContacts }: { result: BatchResult; people: Assignee[]; onSeeContacts: () => void }) {
  const dups = result.items.filter((i) => i.result === 'duplicate')
  const per = new Map<string, number>()
  for (const i of result.items) if (i.result === 'accepted' && i.assigned_to) per.set(i.assigned_to, (per.get(i.assigned_to) ?? 0) + 1)
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-200" role="status" data-testid="load-result">
      <p className="font-semibold">
        ✓ {result.accepted} referido{result.accepted === 1 ? '' : 's'} de {result.referrer_name} guardado{result.accepted === 1 ? '' : 's'}
        {per.size > 0 && ` · ${[...per].map(([id, n]) => `${people.find((p) => p.id === id)?.full_name ?? 'responsable'} +${n}`).join(' · ')}`}
      </p>
      {dups.length > 0 && (
        <p className="text-sm text-rb-red">
          {dups.length} no se guardaron porque el celular ya existía
          {dups.some((d) => d.result === 'duplicate' && d.full_name) &&
            `: ${dups.map((d) => (d.result === 'duplicate' && d.full_name) || d.branch_name).join(', ')}`}
          .
        </p>
      )}
      <button type="button" onClick={onSeeContacts} className="min-h-10 self-start text-sm font-semibold text-gold-dark underline underline-offset-4">
        Ver en Contactos
      </button>
    </div>
  )
}

export function LoadSection({ s }: { s: ReferralScope }) {
  const branch = s.branch
  const toast = useToast()
  const { catalogs } = useCatalogs()
  const products = catalogs?.products ?? null
  const referrers = useReferrers(branch)
  const assignees = useReferralAssignees(branch)
  const save = useSaveReferralBatch()

  const [choice, setChoice] = useState<ReferrerChoice | null>(null)
  const [query, setQuery] = useState('')
  const [refError, setRefError] = useState<string>()
  const [mode, setMode] = useState<'rows' | 'paste'>('rows')
  const [paste, setPaste] = useState('')
  const [rows, setRows] = useState<LoadRow[]>(() => blankRows())
  const [assign, setAssign] = useState<AssignMode>('even')
  const [one, setOne] = useState<string | null>(null)
  const [result, setResult] = useState<BatchResult | null>(null)
  // Ids por fila: si se reintenta un guardado (sin señal, doble toque), la base no crea nada dos veces.
  const ids = useRef(new Map<string, string>())

  // Otra sucursal: otros referidores y responsables. Las filas (nombre y celular) se conservan.
  // Se ajusta durante el render (patrón de React para estado que depende de una prop), no en un efecto.
  const [prevBranch, setPrevBranch] = useState(branch)
  if (prevBranch !== branch) {
    setPrevBranch(branch)
    setChoice(null)
    setQuery('')
    setOne(null)
    setResult(null)
    setRows((rs) => rs.map((r) => ({ ...r, assigned_to: null })))
  }

  const options: ReferrerOption[] = useMemo(
    () => (referrers.data ?? []).filter((r) => r.active && !r.merged_into).map((r) => ({ id: r.id, name: r.name, kind: r.kind })),
    [referrers.data],
  )
  const people = assignees.data ?? []
  const phones = rows.filter((r) => !isBlank(r) && isValidPhone(r.phone)).map((r) => normalizePhone(r.phone))
  const check = usePhoneCheck(branch, phones)
  const hits = useMemo(() => new Map((check.data ?? []).map((h) => [h.norm, h])), [check.data])
  const ready = readyRows(rows, hits)
  const proposal = proposeAssignees(ready, people, assign, one)
  const counts = countBy(proposal)
  const autoOf = new Map(ready.map((r, i) => [r.key, proposal[i] ?? null]))
  const unassigned = proposal.filter((p) => p === null).length
  const hasAux = people.some((p) => p.role === 'field_assistant')

  const setRow = (key: string, patch: Partial<LoadRow>) => {
    setResult(null)
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  const removeRow = (key: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : blankRows(rs[0]?.product_id ?? null)))
  const addRow = () => setRows((rs) => (rs.length >= MAX_ROWS ? rs : [...rs, newRow(rs.at(-1)?.product_id ?? null)]))

  const readPaste = () => {
    const found = parsePaste(paste)
    if (found.length === 0) {
      toast('No encontré celulares en el texto. Cada contacto va en su línea con su número.', 'error')
      return
    }
    setRows((rs) => {
      const kept = rs.filter((r) => !isBlank(r))
      const product = rs.at(-1)?.product_id ?? null
      const added = found.map((f) => ({ ...newRow(product), ...f }))
      const all = [...kept, ...added]
      if (all.length > MAX_ROWS) toast(`Se cargaron los primeros ${MAX_ROWS} contactos; guarda y sigue con el resto.`, 'info')
      return all.slice(0, MAX_ROWS)
    })
    setPaste('')
    setMode('rows')
    setResult(null)
  }

  const pickAssignee = (id: string) => {
    setAssign('one')
    setOne(id)
    setRows((rs) => rs.map((r) => ({ ...r, assigned_to: null })))
  }

  const onSave = async () => {
    if (branch === undefined) return
    if (!choice) {
      setRefError(query.trim() ? 'Elige uno de la lista o toca «Agregar».' : 'Escribe quién pasó los contactos.')
      return
    }
    const itemIds = ready.map((r) => {
      const id = ids.current.get(r.key) ?? uuidv7()
      ids.current.set(r.key, id)
      return id
    })
    try {
      const res = await save.mutateAsync({ branch_id: branch, ...toPayload(choice), items: buildItems(ready, proposal, itemIds) })
      const saved = new Set(ready.map((r) => r.key))
      for (const k of saved) ids.current.delete(k)
      setResult(res)
      setChoice({ id: res.referrer_id, name: res.referrer_name })
      setRows((rs) => {
        const left = rs.filter((r) => !saved.has(r.key) && !isBlank(r))
        return left.length ? left : blankRows(rs.at(-1)?.product_id ?? null)
      })
      toast(`✓ ${res.accepted} referido${res.accepted === 1 ? '' : 's'} guardado${res.accepted === 1 ? '' : 's'}`, 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const canSave = branch !== undefined && ready.length > 0 && !save.isPending && !assignees.isLoading

  return (
    <Card
      title="Cargar referidos"
      subtitle="Cuando el personal te pasa contactos: se registran como referidos de esa persona y se asignan de una vez. Quedas como quien los registró."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink/80">
              Sucursal<span className="text-gold-dark"> *</span>
            </span>
            <BranchPicker s={s} />
            <p className="text-sm text-ink/50">Los referidores y los responsables son de la sucursal que elijas.</p>
          </div>

          {branch !== undefined && (
            <ReferrerPicker
              options={options}
              value={choice}
              onChange={(v) => {
                setChoice(v)
                setRefError(undefined)
              }}
              query={query}
              onQueryChange={(q) => {
                setQuery(q)
                setRefError(undefined)
              }}
              error={refError}
              text={PICKER_TEXT}
            />
          )}

          {branch !== undefined && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink/80">
                  Contactos<span className="text-gold-dark"> *</span>
                </span>
                <Tabs
                  label="Forma de carga"
                  value={mode}
                  onChange={setMode}
                  items={[
                    { v: 'rows', label: 'Escribir' },
                    { v: 'paste', label: 'Pegar de WhatsApp' },
                  ]}
                />
              </div>
              {mode === 'paste' ? (
                <>
                  <textarea
                    aria-label="Mensaje con los contactos"
                    rows={7}
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                    placeholder="Pega aquí el mensaje que te mandaron"
                    className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-base outline-none placeholder:text-ink/30 focus:border-gold focus:ring-4 focus:ring-gold/20"
                  />
                  <p className="text-sm text-ink/50">Una línea por contacto, con su celular. Después los revisas en la tabla antes de guardar.</p>
                  <div className="flex flex-wrap gap-2">
                    {!paste && (
                      <Button variant="secondary" className="min-h-11" onClick={() => setPaste(SAMPLE)}>
                        Ver un ejemplo
                      </Button>
                    )}
                    <Button variant="dark" className="min-h-11" disabled={!paste.trim()} onClick={readPaste}>
                      Leer contactos
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink/50">
                  {ready.length} listo{ready.length === 1 ? '' : 's'} para guardar. Completa la tabla{' '}
                  <span className="hidden lg:inline">de la derecha</span>
                  <span className="lg:hidden">de abajo</span>.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {branch === undefined ? (
            <p className="rounded-2xl bg-sand/60 p-4 text-sm text-ink/55">Elige la sucursal para ver a quién se le puede asignar.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink/80">
                  Asignar a<span className="text-gold-dark"> *</span>
                </span>
                {people.filter((p) => p.role === 'field_assistant').length > 1 && (
                  <Tabs
                    label="Cómo asignar"
                    value={assign}
                    onChange={(v) => {
                      setAssign(v)
                      if (v === 'even') setOne(null)
                    }}
                    items={[
                      { v: 'even', label: 'Repartir parejo' },
                      { v: 'one', label: 'Todos a una persona' },
                    ]}
                  />
                )}
              </div>
              {assignees.isLoading ? (
                <p className="text-sm text-ink/45">Cargando responsables…</p>
              ) : people.length === 0 ? (
                <p className="rounded-2xl bg-rb-red/10 p-4 text-sm text-rb-red">La sucursal no tiene auxiliares, supervisores ni encargado activos. Se guardarán sin responsable.</p>
              ) : (
                <AssigneeList people={people} counts={counts} mode={assign} one={one} onPick={pickAssignee} />
              )}
              <p className="text-sm text-ink/50">
                {!hasAux && people.length > 0
                  ? 'No hay auxiliares activos: elige el responsable de cada fila en la tabla.'
                  : assign === 'even'
                    ? 'Reparte entre los auxiliares, primero al que tiene menos pendientes. Al supervisor o encargado se le asigna a mano en la tabla.'
                    : 'Todos van a la persona marcada. Puedes cambiar cualquier fila en la tabla.'}
              </p>
            </div>
          )}

          {branch !== undefined && mode === 'rows' && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm" aria-label="Contactos a cargar">
                  <thead>
                    <tr className="border-b border-ink/10 text-ink/50">
                      {['Nombre', 'Celular', 'Producto', 'Responsable', ''].map((h, i) => (
                        <th key={i} scope="col" className={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const issue = isBlank(r) ? null : rowIssue(r, rows, hits)
                      const auto = autoOf.get(r.key)
                      return (
                        <tr key={r.key} className="border-b border-ink/5 align-top" data-testid={`load-row-${i}`}>
                          <td className="py-2 pr-2">
                            <input
                              aria-label={`Nombre ${i + 1}`}
                              value={r.full_name}
                              maxLength={120}
                              autoCapitalize="words"
                              onChange={(e) => setRow(r.key, { full_name: e.target.value })}
                              className={`${inputCls} w-full ${issue === 'name' ? 'border-rb-red' : ''}`}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              aria-label={`Celular ${i + 1}`}
                              value={r.phone}
                              inputMode="tel"
                              maxLength={20}
                              onChange={(e) => setRow(r.key, { phone: e.target.value })}
                              className={`${inputCls} w-full tabular-nums ${issue && issue !== 'name' ? 'border-rb-red' : ''}`}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <ProductSelect products={products} value={r.product_id} label={`Producto ${i + 1}`} onChange={(v) => setRow(r.key, { product_id: v })} />
                          </td>
                          <td className="py-2 pr-2">
                            <select
                              aria-label={`Responsable ${i + 1}`}
                              value={r.assigned_to ?? ''}
                              onChange={(e) => setRow(r.key, { assigned_to: e.target.value || null })}
                              className={`${inputCls} w-full`}
                            >
                              <option value="">{auto ? `Auto · ${people.find((p) => p.id === auto)?.full_name ?? ''}` : 'Auto'}</option>
                              {people.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.full_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2">
                            <button type="button" aria-label={`Quitar fila ${i + 1}`} onClick={() => removeRow(r.key)} className="min-h-10 w-10 rounded-lg text-ink/45 active:bg-sand">
                              ✕
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="flex flex-col gap-1 text-sm text-rb-red" aria-live="polite">
                {rows.map((r, i) => {
                  const issue = isBlank(r) ? null : rowIssue(r, rows, hits)
                  const msg = issueText(issue, hits.get(normalizePhone(r.phone)))
                  return msg ? <li key={r.key}>Fila {i + 1}: {msg}</li> : null
                })}
              </ul>
              <button type="button" onClick={addRow} disabled={rows.length >= MAX_ROWS} className="min-h-11 self-start text-sm font-semibold text-gold-dark disabled:text-ink/30">
                + Otro contacto
              </button>
            </>
          )}

          {result && <ResultCard result={result} people={people} onSeeContacts={() => s.setSearch({ seccion: 'contactos' }, { push: true })} />}

          {branch !== undefined && unassigned > 0 && people.length > 0 && (
            <p className="text-sm font-medium text-rb-red">{unassigned} quedarán sin responsable: elige uno en la tabla.</p>
          )}
          <Button className="w-full" disabled={!canSave} onClick={() => void onSave()}>
            {save.isPending ? 'Guardando…' : `Guardar y asignar ${ready.length ? `${ready.length} ` : ''}referido${ready.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Card>
  )
}
