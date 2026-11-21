import { expect, test, type Page } from '@playwright/test'
import { fillCapture, login, logoutFromManage, randomPhone } from './helpers'

// Spec 005: referidores y metas, registro referido (con y sin señal), corrección en la ficha y reporte.
// Los referidores de prueba empiezan con "E2E " (los borra `pnpm db:clean`).

async function addReferrer(page: Page, name: string, kind: string, goal: string): Promise<void> {
  const form = page.getByRole('group', { name: 'Agregar referidor' })
  await form.getByLabel('Nuevo referidor').fill(name)
  await form.getByLabel('Tipo').selectOption({ label: kind })
  await form.getByLabel('Meta del mes').fill(goal)
  await form.getByRole('button', { name: 'Agregar' }).click()
  await expect(page.getByTestId(`referrer-edit-${name}`)).toBeVisible()
}

/** Celdas del resumen: 0 nombre, 1 llegados, 2 sin contactar, 3 seguimiento, 4 compraron, 5 sin interés, 6 %, 7 meta, 8 cumplimiento. */
const cells = (page: Page, name: string) => page.getByTestId(`referrer-row-${name}`).locator('td')

async function captureReferred(page: Page, client: string, referrer: string): Promise<void> {
  await fillCapture(page, client, randomPhone())
  const referred = page.getByRole('checkbox', { name: 'Es referido' })
  await referred.check()
  // Spec 010: se escribe el nombre y se elige de las sugerencias de la sucursal.
  await page.getByLabel(/Quién lo recomendó/).fill(referrer)
  await page.getByRole('group', { name: 'Sugerencias de referidores' }).getByRole('button', { name: referrer }).click()
  await expect(page.getByTestId('referrer-chosen')).toContainText(referrer)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/registrar$/)
}

test('referidos: alta con meta, registro referido con y sin señal, corrección en la ficha y reporte', async ({ page, context }) => {
  const tag = String(Date.now()).slice(-6)
  const fernanda = `E2E Fernanda ${tag}`
  const walker = `E2E Walker ${tag}`
  const clientOnline = `Referida Online ${tag}`
  const clientOffline = `Referida Offline ${tag}`

  // 1) La jefa de ventas crea los referidores de Verdolago con su meta del mes
  await login(page, 'jefe.ventas')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/referidos')
  await expect(page.getByRole('combobox', { name: 'Sucursal' }).locator('option')).toHaveText(['Todas mis sucursales', 'VERDOLAGO', 'TRINIDAD'])
  await page.getByRole('tab', { name: 'Referidores y metas' }).click()
  await addReferrer(page, fernanda, 'Personal', '4')
  await addReferrer(page, walker, 'Freelance', '10')
  await logoutFromManage(page)

  // 2) La auxiliar registra una referida con señal y otra sin señal (lista del catálogo guardado)
  await login(page, 'aux.verdolago')
  await captureReferred(page, clientOnline, fernanda)
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  await context.setOffline(true)
  await captureReferred(page, clientOffline, fernanda)
  await expect(page.getByText('1 por subir')).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 45_000 })

  // Sin elegir de quién vino no se guarda
  await fillCapture(page, `Sin Origen ${tag}`, randomPhone())
  await page.getByRole('checkbox', { name: 'Es referido' }).check()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Escribe quién lo recomendó.')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await logoutFromManage(page)

  // 3) Reporte: 2 llegados de Fernanda, meta 4 → 50 %
  await login(page, 'jefe.ventas')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/referidos')
  await expect(cells(page, fernanda).nth(1)).toHaveText('2')
  await expect(cells(page, fernanda).nth(2)).toHaveText('2')
  await expect(cells(page, fernanda).nth(7)).toHaveText('4')
  await expect(cells(page, fernanda).nth(8)).toHaveText('50%')
  await expect(cells(page, walker).nth(1)).toHaveText('0')

  // Detalle del referidor (ventana de la spec 016) → ficha del contacto con «Referido por»
  await page.getByRole('button', { name: fernanda }).click()
  const detail = page.getByRole('dialog', { name: `${fernanda} · Referidos` })
  const links = detail.getByRole('list', { name: 'Referidos' }).getByRole('link')
  await expect(links).toHaveCount(2)
  await expect(links.filter({ hasText: clientOnline })).toHaveCount(1)
  await expect(links.filter({ hasText: clientOffline })).toHaveCount(1)
  await detail.getByRole('button', { name: 'Cerrar' }).click()
  await page.getByRole('tab', { name: 'Por día' }).click()
  await expect(page.getByRole('table', { name: 'Avance por día' })).toContainText(fernanda)
  await page.getByRole('tab', { name: 'Resumen' }).click()
  await page.getByRole('button', { name: fernanda }).click()
  await page.getByRole('dialog', { name: `${fernanda} · Referidos` }).getByRole('link', { name: clientOffline }).click()
  await expect(page).toHaveURL(/\/cliente\//)
  await expect(page.locator('dt', { hasText: 'Referido por' }).locator('..')).toContainText(fernanda)

  // 4) Corregir el origen: queda en el historial
  await page.getByRole('button', { name: 'Editar datos' }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar datos del cliente' })
  await dialog.getByLabel('Referido por').selectOption({ label: walker })
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.locator('dt', { hasText: 'Referido por' }).locator('..')).toContainText(walker)
  await expect(page.getByTestId('timeline-edit').first()).toContainText(`Referido por: ${fernanda} → ${walker}`)

  // 5) El reporte se recalcula
  await page.goto('/referidos')
  await expect(cells(page, fernanda).nth(1)).toHaveText('1')
  await expect(cells(page, walker).nth(1)).toHaveText('1')
  await expect(page.getByTestId('referrals-total').locator('td').nth(1)).not.toHaveText('0')
})

test('referidos: el encargado no ve el menú ni la página', async ({ page }) => {
  await login(page, 'enc.verdolago')
  await expect(page).toHaveURL(/\/panel/)
  await expect(page.getByRole('link', { name: 'Referidos' })).toHaveCount(0)
  await page.goto('/referidos')
  await expect(page).toHaveURL(/\/panel/)
})
