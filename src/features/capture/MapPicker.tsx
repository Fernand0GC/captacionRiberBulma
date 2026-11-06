import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MdArrowBack, MdLayers, MdMyLocation, MdPlace } from 'react-icons/md'
import { Button } from '@/ui/Button'

export type LatLng = { lat: number; lng: number }

/** Último punto elegido: la próxima captación abre el mapa ahí (suelen ser del mismo barrio). */
const LAST_KEY = 'captacion:map-last'
/** Sin GPS ni punto previo: Riberalta. */
const FALLBACK: LatLng = { lat: -11.0067, lng: -66.0714 }
const ZOOM = 17
const MAX_ZOOM = 19

const LAYERS = {
  mapa: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    maxNativeZoom: 19,
  },
  satelite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    // En ciudades chicas (Riberalta) no hay foto más allá del 17: se amplía esa en vez de mostrar "Map data not yet available".
    maxNativeZoom: 17,
  },
} as const
type Layer = keyof typeof LAYERS

function lastPoint(): LatLng | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as LatLng | null
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? v : null
  } catch {
    return null
  }
}

function gps(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('sin_gps'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    )
  })
}

/**
 * Mapa a pantalla completa para marcar dónde vive o trabaja el cliente.
 * El pin queda fijo al centro y se mueve el mapa debajo (más fácil con el dedo que arrastrar un marcador).
 */
export default function MapPicker({
  value,
  onPick,
  onClose,
}: {
  value: LatLng | null
  onPick: (p: LatLng) => void
  onClose: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const tiles = useRef<L.TileLayer | null>(null)
  const [center, setCenter] = useState<LatLng>(value ?? lastPoint() ?? FALLBACK)
  const [layer, setLayer] = useState<Layer>('mapa')
  const [locating, setLocating] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  function goToGps() {
    setLocating(true)
    setGpsError(null)
    gps()
      .then((p) => map.current?.setView(p, ZOOM))
      .catch(() => setGpsError('No se pudo obtener tu ubicación. Revisa que el GPS esté activado.'))
      .finally(() => setLocating(false))
  }

  useEffect(() => {
    if (!box.current) return
    const start = value ?? lastPoint() ?? FALLBACK
    const m = L.map(box.current, { zoomControl: false, attributionControl: true, maxZoom: MAX_ZOOM }).setView(start, ZOOM)
    m.on('move', () => {
      const c = m.getCenter()
      setCenter({ lat: c.lat, lng: c.lng })
    })
    map.current = m
    // Primera vez sin punto guardado: centrar en donde está la volantera.
    if (!value && !lastPoint()) {
      gps()
        .then((p) => m.setView(p, ZOOM))
        .catch(() => undefined)
    }
    return () => {
      m.remove()
      map.current = null
    }
  }, [value])

  useEffect(() => {
    const m = map.current
    if (!m) return
    tiles.current?.remove()
    const cfg = LAYERS[layer]
    tiles.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxNativeZoom: cfg.maxNativeZoom, maxZoom: MAX_ZOOM }).addTo(m)
  }, [layer])

  // Pantalla completa: Esc cierra y el formulario de atrás no se desplaza.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  function confirm() {
    const p = { lat: Number(center.lat.toFixed(6)), lng: Number(center.lng.toFixed(6)) }
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(p))
    } catch {
      // sin almacenamiento: solo se pierde el "abrir donde quedé"
    }
    onPick(p)
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Marcar ubicación del cliente" className="fixed inset-0 z-50 flex flex-col bg-cream">
      <header className="flex items-center gap-2 bg-ink px-2 py-2 text-gold-light" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <button type="button" onClick={onClose} aria-label="Volver" className="grid size-11 place-items-center rounded-full active:bg-white/10">
          <MdArrowBack className="size-6" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold leading-tight">Ubicación del cliente</p>
          <p className="truncate text-xs text-gold-light/70">Mueve el mapa hasta que el pin quede en su casa o negocio</p>
        </div>
      </header>

      <div className="relative flex-1">
        <div ref={box} className="absolute inset-0" data-testid="map" />

        {/* Pin fijo al centro: la punta marca el punto exacto. */}
        <MdPlace aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-[500] size-12 -translate-x-1/2 -translate-y-full text-rb-red drop-shadow-lg" />

        {!navigator.onLine && (
          <p className="absolute inset-x-3 top-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-sm text-ink shadow">
            Sin señal: el mapa puede no cargar. Usa <b>Mi ubicación</b> para guardar el GPS igual.
          </p>
        )}
        {gpsError && (
          <p role="alert" className="absolute inset-x-3 top-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-sm text-rb-red shadow">
            {gpsError}
          </p>
        )}

        <div className="absolute bottom-4 right-3 z-[500] flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setLayer(layer === 'mapa' ? 'satelite' : 'mapa')}
            className="flex min-h-12 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink shadow-lg active:bg-sand"
          >
            <MdLayers className="size-5" />
            {layer === 'mapa' ? 'Satélite' : 'Mapa'}
          </button>
          <button
            type="button"
            onClick={goToGps}
            disabled={locating}
            className="flex min-h-12 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink shadow-lg active:bg-sand disabled:opacity-60"
          >
            <MdMyLocation className={`size-5 ${locating ? 'animate-pulse' : ''}`} />
            {locating ? 'Buscando…' : 'Mi ubicación'}
          </button>
        </div>
      </div>

      <footer className="flex flex-col gap-2 bg-white px-4 pt-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <p className="text-center text-xs text-ink/50" data-testid="map-coords">
          {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
        </p>
        <Button onClick={confirm} className="min-h-14 font-display text-lg">
          Usar esta ubicación
        </Button>
      </footer>
    </div>
  )
}
