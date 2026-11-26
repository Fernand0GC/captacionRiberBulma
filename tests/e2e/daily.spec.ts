import { expect, test, type Page } from '@playwright/test'
import { login } from './helpers'

// Reporte del día (spec 009). Los datos locales cambian con cada corrida: se prueba que número y lista coincidan.

async function countMatchesRows(page: Page, tab: string, table: string, empty: RegExp) {
  await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
  const badge = page.getByRole('tab', { name: new RegExp(`^${tab}`) }).locator('span')
  await expect(badge).not.toHaveText('…')
  const n = Number(await badge.innerText())
  if (n === 0) await expect(page.getByText(empty)).toBeVisible()
  else await expect(page.getByTestId(table).locator('tbody tr')).toHaveCount(n)
  return n
}

test.describe('pantalla ancha', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false })

  test('del día (009): números y listas coinciden, cambio de día, referidos y Excel', async ({ page }) => {
    await login(page, 'enc.trinidad')
    await page.waitForURL((u) => !u.pathname.endsWith('/login'))
    await page.goto('/gestion')
    await page.getByRole('button', { name: 'Del día' }).click()
    await expect(page).toHaveURL(/ver=dia/)
    await expect(page.getByRole('heading', { name: 'Del día' })).toBeVisible()
    await expect(page.getByTestId('daily-totals')).toContainText('Registros nuevos')
    await expect(page.getByTestId('daily-totals')).toContainText('Clientes con seguimiento')

    // Número de cada pestaña = filas de su lista (SC-002)
    await countMatchesRows(page, 'Registros nuevos', 'daily-new', /No hubo registros nuevos/)
    await countMatchesRows(page, 'Clientes con seguimiento', 'daily-followed', /Nadie tuvo seguimiento/)
    await expect(page).toHaveURL(/lista=seguimiento/)

    // Día anterior y vuelta a hoy; no se puede ir al futuro
    await expect(page.getByRole('button', { name: 'Día siguiente' })).toBeDisabled()
    await page.getByRole('button', { name: 'Día anterior' }).click()
    await expect(page).toHaveURL(/dia=\d{4}-\d{2}-\d{2}/)
    await countMatchesRows(page, 'Clientes con seguimiento', 'daily-followed', /Nadie tuvo seguimiento/)
    await page.getByRole('button', { name: 'Hoy', exact: true }).click()
    await expect(page).not.toHaveURL(/dia=/)

    // Solo referidos: aparece el referidor (una sucursal) y las listas siguen coincidiendo
    await page.getByRole('combobox', { name: 'Origen' }).selectOption('referidos')
    await expect(page.getByRole('combobox', { name: 'Referidor' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Del día' })).toBeVisible()
    await countMatchesRows(page, 'Registros nuevos', 'daily-new', /No hubo registros nuevos/)

    // Excel (si hay datos ese día): un archivo con resumen y las dos listas
    await page.getByRole('combobox', { name: 'Origen' }).selectOption('')
    const excel = page.getByRole('button', { name: 'Exportar Excel' })
    if (await excel.isEnabled()) {
      const [download] = await Promise.all([page.waitForEvent('download'), excel.click()])
      expect(download.suggestedFilename()).toMatch(/^del-dia_.+\.xlsx$/)
    }

    // Cómo se calcula
    await page.getByText('Cómo se calcula cada número').click()
    await expect(page.getByText('Un cliente llamado 3 veces cuenta 1.')).toBeVisible()
  })
})

test('del día (009): la tarjeta del Panel lleva a la lista de seguimiento', async ({ page }) => {
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  const tile = page.getByTestId('kpis').getByRole('link', { name: /Clientes con seguimiento/ })
  await expect(tile).toBeVisible()
  await tile.click()
  await expect(page).toHaveURL(/ver=dia/)
  await expect(page).toHaveURL(/lista=seguimiento/)
  await expect(page.getByRole('tab', { name: /^Clientes con seguimiento/ })).toHaveAttribute('aria-selected', 'true')
})

test('del día: la búsqueda por nombre/celular no se escribe en la URL (constitución IV)', async ({ page }) => {
  await login(page, 'enc.trinidad')
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  // Un enlace viejo con ?buscar= se ignora: no filtra ni aparece en el buscador.
  await page.goto('/gestion?ver=dia&lista=seguimiento&buscar=73340001')
  const box = page.getByRole('searchbox', { name: 'Buscar por nombre o celular' })
  await expect(box).toHaveValue('')

  const before = new URL(page.url()).search
  expect(before).not.toContain('buscar')
  await box.fill('73340001')
  await expect(box).toHaveValue('73340001')
  expect(new URL(page.url()).search).toBe(before)
  await box.fill('')
  expect(new URL(page.url()).search).toBe(before)

  // Las lupas no personales siguen en la URL; «Limpiar» vacía también la búsqueda.
  await box.fill('ana')
  await page.getByRole('combobox', { name: 'Resultado' }).selectOption('efectivos')
  await expect(page).toHaveURL(/resultado=efectivos/)
  expect(page.url()).not.toContain('buscar')
  await page.getByRole('search', { name: 'Lupas de la lista' }).getByRole('button', { name: 'Limpiar' }).click()
  await expect(box).toHaveValue('')
  await expect(page).not.toHaveURL(/resultado=/)
})
