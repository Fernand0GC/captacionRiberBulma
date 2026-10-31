import { useEffect, useRef, useState, type ReactNode } from 'react'

// Gráficos livianos (SVG/HTML, sin librerías) según la guía de visualización: una serie = un color
// (dorado de marca #a8861c, validado ≥3:1 sobre blanco), marcas finas con punta redondeada de 4px,
// grilla recesiva, valor en la punta de las barras y detalle al pasar el mouse.
export const SERIES = '#a8861c'
const MUTED = '#a3a29c' // "Sin interés": énfasis bajo, no es un color de serie

export function Card({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/5 ${className}`}>
      <header>
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-ink/50">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

export function StatTile({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-3xl p-5 shadow-sm ring-1 ${accent ? 'bg-ink-gradient text-white ring-ink' : 'bg-white ring-ink/5'}`}>
      <p className={`text-sm font-semibold ${accent ? 'text-white/60' : 'text-ink/55'}`}>{label}</p>
      <p className={`font-display text-4xl font-bold tabular-nums ${accent ? 'text-gold-light' : 'text-ink'}`}>{value}</p>
      {hint && <p className={`text-sm ${accent ? 'text-white/50' : 'text-ink/45'}`}>{hint}</p>}
    </div>
  )
}

/** Barras horizontales: etiqueta, barra (≤14px, punta redondeada, base recta) y valor en la punta. */
export function HBars({
  data,
  format = (n) => String(n),
  muted = [],
  total,
}: {
  data: { label: string; value: number; note?: string }[]
  format?: (n: number) => string
  muted?: string[]
  total?: number
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d) => {
        const pct = total ? Math.round((d.value / Math.max(1, total)) * 100) : null
        const tip = `${d.label}: ${format(d.value)}${pct !== null ? ` (${pct}%)` : ''}${d.note ? ` · ${d.note}` : ''}`
        return (
          <li key={d.label} className="group relative grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[10rem_1fr_auto]" title={tip}>
            <span className="truncate text-sm text-ink/75">{d.label}</span>
            <span className="relative h-3.5 rounded-r bg-transparent" aria-hidden>
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[filter] group-hover:brightness-110"
                style={{ width: `${(d.value / max) * 100}%`, minWidth: d.value > 0 ? 3 : 0, background: muted.includes(d.label) ? MUTED : SERIES }}
              />
            </span>
            <span className="text-right text-sm font-semibold tabular-nums text-ink">
              {format(d.value)}
              {pct !== null && <span className="ml-1 font-normal text-ink/45">{pct}%</span>}
            </span>
            <span role="tooltip" className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs text-white shadow-lg group-hover:block">
              {tip}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function niceMax(n: number): number {
  if (n <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(n))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => n / s <= 4) ?? 10 * pow
  return Math.ceil(n / step) * step
}

/** Columnas por día (una serie). Valor solo en el máximo; el resto en el detalle al pasar el mouse. */
export function DayColumns({ data, label }: { data: { day: string; n: number }[]; label: (d: string) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  // Se dibuja al ancho real del contenedor (no escalado), para que el texto quede siempre a 11–12px.
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = 220
  const pad = { l: 32, r: 8, t: 16, b: 28 }
  const top = niceMax(Math.max(...data.map((d) => d.n), 0))
  const ticks = [0, top / 4, top / 2, (3 * top) / 4, top]
  const band = (W - pad.l - pad.r) / data.length
  const bw = Math.min(24, band * 0.6)
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top)
  const maxIdx = data.reduce((m, d, i) => (d.n > (data[m]?.n ?? -1) ? i : m), 0)
  const every = Math.ceil(data.length / Math.max(2, Math.floor(W / 56)))

  return (
    <div className="relative" ref={box}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img" aria-label="Captaciones por día">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#ecebe6" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#8a897f">
              {Number.isInteger(t) ? t : ''}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + band * i + band / 2
          const h = Math.max(0, H - pad.b - y(d.n))
          const x = cx - bw / 2
          const r = Math.min(4, h)
          const path = h > 0 ? `M${x},${H - pad.b} V${y(d.n) + r} Q${x},${y(d.n)} ${x + r},${y(d.n)} H${x + bw - r} Q${x + bw},${y(d.n)} ${x + bw},${y(d.n) + r} V${H - pad.b} Z` : ''
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + band * i} y={pad.t} width={band} height={H - pad.t - pad.b} fill="transparent" />
              {path && <path d={path} fill={SERIES} opacity={hover === null || hover === i ? 1 : 0.55} />}
              {i === maxIdx && d.n > 0 && (
                <text x={cx} y={y(d.n) - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="#0b0b0c">
                  {d.n}
                </text>
              )}
              {(i % every === 0 || i === data.length - 1) && (
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="#8a897f">
                  {label(d.day)}
                </text>
              )}
            </g>
          )
        })}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#d9d8d1" strokeWidth={1} />
      </svg>
      {hover !== null && data[hover] && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 rounded-lg bg-ink px-2.5 py-1 text-xs text-white shadow-lg"
          style={{ left: `${((pad.l + band * hover + band / 2) / W) * 100}%`, transform: 'translateX(-50%)' }}
        >
          {label(data[hover].day)}: <strong>{data[hover].n}</strong> captaciones
        </div>
      )}
      {/* Vista de tabla para lectores de pantalla */}
      <table className="sr-only">
        <caption>Captaciones por día</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{label(d.day)}</th>
              <td>{d.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Barra inline para tablas (proporción dentro de la fila). */
export function InlineBar({ value, max }: { value: number; max: number }) {
  return (
    <span className="mt-1 block h-1.5 w-full max-w-40 rounded-r bg-transparent" aria-hidden>
      <span className="block h-1.5 rounded-r-[4px]" style={{ width: `${(value / Math.max(1, max)) * 100}%`, background: SERIES }} />
    </span>
  )
}
