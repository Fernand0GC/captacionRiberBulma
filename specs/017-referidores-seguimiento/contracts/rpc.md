# Contrato RPC — 017

Métodos: `whatsapp_call` | `message` | `in_person`. Resultados: `no_answer` | `waiting` | `promised` | `passed` |
`none_now` | `quit`. Fechas `YYYY-MM-DD` (La Paz).

## referrer_ask_save(p jsonb) → integer

`p = { referrer_ids: int[1..50], method, result, note?: string(≤500), next_on?: date }` → cantidad guardada.
Errores: `forbidden` (alguna sucursal ajena), `invalid_input` con detail `referrer_ids | method | result | note | next_on`.
Referidor unido → se guarda en el que quedó.

## referrer_followup(p jsonb) → jsonb

`p = { branch_id?: int, from: date, to: date }` (≤ 366 días). Período anterior = mismo largo justo antes.

```
{ today, from, to, prev_from, prev_to,
  branches: [{ id, name }],
  referrers: [{ id, branch_id, name, kind, active, phone, created_at, created_by, created_by_name,
                last_ask: { at, method, result, next_on, kept, actor_name } | null, last_load_at | null }],
  asks: [{ id, referrer_id, at, day, method, result, next_on, note, auto, kept, actor_id, actor_name }],   // prev_from..to
  arrivals: [{ referrer_id, day, n }],                                                                   // prev_from..to
  staff: [{ id, full_name, role, branch_ids }] }                                                         // jefes del alcance + quien pidió
```

## referrer_history(p_referrer smallint) → jsonb

`[{ at, method, result, next_on, note, auto, kept, actor_name }]` (últimos 100, del más nuevo al más viejo).

## referrer_save(p) — cambio

Acepta `phone`: ausente = no cambia; `''`/null = lo borra. `invalid_input/phone`, `invalid_input/phone_taken`
(mensaje: nombre del otro referidor en `hint`).

## referral_batch_save — cambio

Con `accepted > 0` inserta `{ auto: true, result: 'passed', note: 'N referidos cargados' }` para el referidor.
