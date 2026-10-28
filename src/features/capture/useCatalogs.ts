import { useEffect, useState } from 'react'
import { normalizeText } from '@/lib/search'
import { supabase } from '@/lib/supabase'
import type { Option } from '@/ui/Select'

export type ProductGroup = 'phones' | 'major_appliances' | 'small_appliances'

export const GROUP_LABEL: Record<ProductGroup, string> = {
  phones: 'Celulares',
  major_appliances: 'Electro mayor',
  small_appliances: 'Electro menor',
}

export type Product = { id: number; name: string; group: ProductGroup; search: string }
export type Catalogs = { channels: Option[]; products: Product[] }

// Catálogos (no son datos de clientes): se cachean para poder registrar sin señal.
const KEY = 'captacion.catalogs.v3'

function readCache(): Catalogs | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Catalogs) : null
  } catch {
    return null
  }
}

async function fetchCatalogs(): Promise<Catalogs> {
  const [ch, pr] = await Promise.all([
    supabase.from('channels').select('id, name').eq('active', true).order('sort'),
    supabase.from('products').select('id, name, product_group').eq('active', true).order('sort'),
  ])
  if (ch.error) throw ch.error
  if (pr.error) throw pr.error
  return {
    channels: ch.data.map((c) => ({ value: String(c.id), label: c.name })),
    products: pr.data.map((p) => ({
      id: p.id,
      name: p.name,
      group: p.product_group as ProductGroup,
      search: normalizeText(`${p.name} ${GROUP_LABEL[p.product_group as ProductGroup]}`),
    })),
  }
}

export function useCatalogs(): { catalogs: Catalogs | null; error: boolean } {
  const [catalogs, setCatalogs] = useState<Catalogs | null>(() => readCache())
  const [error, setError] = useState(() => !navigator.onLine && !readCache())

  useEffect(() => {
    if (!navigator.onLine) return
    fetchCatalogs()
      .then((c) => {
        setCatalogs(c)
        try {
          localStorage.setItem(KEY, JSON.stringify(c))
        } catch {
          /* sin caché */
        }
      })
      .catch(() => {
        if (!readCache()) setError(true)
      })
  }, [])

  return { catalogs, error }
}
