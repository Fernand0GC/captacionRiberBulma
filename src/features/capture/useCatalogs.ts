import { useEffect, useState } from 'react'
import { normalizeText } from '@/lib/search'
import { supabase } from '@/lib/supabase'
import type { Option } from '@/ui/Select'
import type { ChannelGroup } from './channelGroups'

export type ProductGroup = 'phones' | 'major_appliances' | 'small_appliances'

export const GROUP_LABEL: Record<ProductGroup, string> = {
  phones: 'Celulares',
  major_appliances: 'Electro mayor',
  small_appliances: 'Electro menor',
}

export type Product = { id: number; name: string; group: ProductGroup; search: string }
export type ChannelOption = Omit<Option, 'group'> & { group: ChannelGroup | null }
/** branches: para quien elige sucursal al registrar (puede faltar en cachés viejas). */
export type Catalogs = { channels: ChannelOption[]; products: Product[]; branches?: { id: number; name: string }[] }

// Catálogos (no son datos de clientes): se cachean para poder registrar sin señal.
const KEY = 'captacion.catalogs.v4'
// La versión anterior (sin grupo de canal) sirve de respaldo si la app se actualiza sin señal.
const PREVIOUS_KEY = 'captacion.catalogs.v3'

function readCache(): Catalogs | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Catalogs
    const old = localStorage.getItem(PREVIOUS_KEY)
    if (!old) return null
    const c = JSON.parse(old) as Catalogs
    return { ...c, channels: c.channels.map((ch) => ({ ...ch, group: ch.group ?? null })) }
  } catch {
    return null
  }
}

async function fetchCatalogs(): Promise<Catalogs> {
  const [ch, pr, br] = await Promise.all([
    supabase.from('channels').select('id, name, channel_group').eq('active', true).order('sort'),
    supabase.from('products').select('id, name, product_group').eq('active', true).order('sort'),
    supabase.from('branches').select('id, name').eq('active', true).order('id'),
  ])
  if (ch.error) throw ch.error
  if (pr.error) throw pr.error
  if (br.error) throw br.error
  return {
    branches: br.data,
    channels: ch.data.map((c) => ({
      value: String(c.id),
      label: c.name,
      group: c.channel_group as ChannelGroup | null,
    })),
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
