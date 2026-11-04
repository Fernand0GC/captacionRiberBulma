import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMode } from '@/features/install/install'

const ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const WHATSAPP_ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A145M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 WhatsApp/2.24'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'

let standalone = false
let store: Record<string, string> = {}

beforeEach(() => {
  standalone = false
  store = {}
  vi.stubGlobal('window', { matchMedia: () => ({ matches: standalone }) })
  vi.stubGlobal('navigator', {})
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) })
})
afterEach(() => vi.unstubAllGlobals())

describe('installMode', () => {
  it('muestra los pasos según el celular', () => {
    expect(installMode(ANDROID)).toBe('android')
    expect(installMode(IPHONE)).toBe('ios')
    expect(installMode(WHATSAPP_ANDROID)).toBe('inapp')
    expect(installMode(DESKTOP)).toBe('none')
  })

  it('no aparece si ya está instalada o si la persona dijo que ya la tiene', () => {
    standalone = true
    expect(installMode(ANDROID)).toBe('none')
    standalone = false
    store['install-hidden'] = '1'
    expect(installMode(IPHONE)).toBe('none')
  })
})
