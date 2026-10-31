import { expect, test, type Browser } from '@playwright/test'
import { fillCapture, login, logoutFromManage, randomPhone } from './helpers'

async function capture(browser: Browser, user: string, name: string, phone: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await login(page, user)
  await fillCapture(page, name, phone)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/registrar$/)
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  await ctx.close()
}

test('panel de captaciones: el encargado ve solo su sucursal con autor, fecha y hora; el gerente ve todas', async ({ browser, page }) => {
  const tag = String(Date.now()).slice(-5)
  const verdolago = { name: `Cliente Verdolago ${tag}`, phone: randomPhone() }
  const trinidad = { name: `Cliente Trinidad ${tag}`, phone: randomPhone() }
  await capture(browser, 'sup.verdolago', verdolago.name, verdolago.phone)
  await capture(browser, 'vol.trinidad', trinidad.name, trinidad.phone)

  // Encargado Verdolago
  await login(page, 'enc.verdolago')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/gestion')
  // En celular (proyecto de prueba) el panel muestra tarjetas; en escritorio, tabla.
  const row = page.getByRole('listitem').filter({ hasText: verdolago.name })
  await expect(row).toBeVisible()
  await expect(row).toContainText('Supervisor Verdolago')
  await expect(row).toContainText(/\d{2}\/\d{2}\/\d{4}/)
  await expect(row).toContainText(/\d{2}:\d{2}/)
  await expect(page.getByText(trinidad.name)).toHaveCount(0)

  // Búsqueda por celular con otro formato; la búsqueda no queda en la URL
  await page.getByLabel('Buscar por nombre o celular').fill(`+591 ${verdolago.phone}`)
  await expect(page.getByTestId('total')).toHaveText('1')
  expect(page.url()).not.toContain(verdolago.phone)
  await logoutFromManage(page) // espera el cierre de sesión antes de entrar con otro usuario

  // Gerente: ambas sucursales
  await login(page, 'gerente')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/gestion')
  await expect(page.getByRole('listitem').filter({ hasText: verdolago.name })).toContainText('VERDOLAGO')
  await expect(page.getByRole('listitem').filter({ hasText: trinidad.name })).toContainText('TRINIDAD')
})
