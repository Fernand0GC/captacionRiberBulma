import { expect, test, type Browser } from '@playwright/test'
import { fillCapture, login, randomPhone } from './helpers'

async function capture(browser: Browser, user: string, name: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await login(page, user)
  await fillCapture(page, name, randomPhone())
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/registrar$/)
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  await ctx.close()
}

test('Hacer seguimiento: sin responsable, quien registra el contacto queda como responsable', async ({ browser, page }) => {
  const tag = String(Date.now()).slice(-5)
  const fromVol = `Toma Vol ${tag}`
  // Trinidad: no choca con el conteo del día de vol.verdolago (capture-offline)
  await capture(browser, 'vol.trinidad', fromVol)

  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/gestion')
  await page.getByRole('link', { name: `Hacer seguimiento a ${fromVol}` }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: /Busca un producto/ }).click()
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(/\/cliente\/[^?]+$/)
  await expect(page.getByRole('combobox', { name: 'Responsable' })).toHaveValue('00000000-0000-4000-8000-000000000007')

  await page.goto('/gestion')
  await expect(page.getByRole('listitem').filter({ hasText: fromVol })).toContainText('Encargado Trinidad')
})
