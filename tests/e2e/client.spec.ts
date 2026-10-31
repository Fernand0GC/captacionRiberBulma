import { expect, test, type Browser } from '@playwright/test'
import { fillCapture, login, logoutFromManage, randomPhone } from './helpers'

async function capture(browser: Browser, name: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await login(page, 'vol.trinidad')
  await fillCapture(page, name, randomPhone())
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  await ctx.close()
}

test('ficha del cliente: historial, edición auditada, contacto desde la ficha y anulación por Sistemas', async ({ browser, page }) => {
  const name = `Ficha ${String(Date.now()).slice(-5)}`
  await capture(browser, name)

  // Encargado Trinidad abre la ficha desde Captaciones
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/gestion')
  await page.getByRole('link', { name }).filter({ visible: true }).click()
  await expect(page).toHaveURL(/\/cliente\//)
  await expect(page.getByTestId('client-name')).toHaveText(name)
  await expect(page.getByTestId('timeline-capture')).toContainText('Captado por Volantera Trinidad')

  // Editar: queda en el historial
  await page.getByRole('button', { name: 'Editar datos' }).click()
  await page.getByRole('dialog').getByLabel('Dirección o referencia').fill('Barrio Central, frente a la plaza')
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Datos actualizados')).toBeVisible()
  await expect(page.getByTestId('timeline-edit')).toContainText('Barrio Central, frente a la plaza')
  await expect(page.getByTestId('timeline-edit')).toContainText('por Encargado Trinidad')

  // Registrar contacto desde la ficha
  await page.getByRole('button', { name: 'Registrar contacto' }).click()
  await page.getByRole('radio', { name: 'Muy interesado' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByTestId('client-stage')).toHaveText('Cliente potencial')
  await expect(page.getByTestId('timeline-contact')).toContainText('Muy interesado')
  const url = page.url()
  await expect(page.getByRole('button', { name: 'Anular' })).toHaveCount(0) // el encargado no anula
  await logoutFromManage(page)

  // Sistemas anula con motivo
  await login(page, 'admin')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto(url)
  await page.getByRole('button', { name: 'Anular' }).click()
  await page.getByRole('dialog').getByLabel(/Motivo/).fill('Registro de prueba')
  await page.getByRole('dialog').getByRole('button', { name: 'Anular' }).click()
  await expect(page.getByTestId('client-stage')).toHaveText('Anulado')
  await expect(page.getByText(/Registro de prueba/).first()).toBeVisible()
})
