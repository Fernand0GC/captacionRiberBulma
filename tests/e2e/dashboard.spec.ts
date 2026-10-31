import { expect, test } from '@playwright/test'
import { login, openRegister, randomPhone } from './helpers'

test('panel: el gestor entra al Panel con métricas; los chips de canal filtran Captaciones', async ({ page }) => {
  // Una captación por Volantes (sup.verdolago, para no chocar con otras pruebas)
  const name = `Panel Chip ${String(Date.now()).slice(-5)}`
  await login(page, 'sup.verdolago')
  await openRegister(page)
  await page.getByRole('button', { name: 'Nuevo Registro' }).click()
  const picker = page.getByRole('dialog', { name: '¿Por qué canal captas hoy?' })
  await expect(picker.or(page.getByLabel(/Nombre completo/))).toBeVisible()
  if (await picker.isVisible()) await picker.getByRole('button', { name: 'Volantes' }).click()
  else {
    await page.goto('/registrar')
    await page.getByRole('button', { name: /Cambiar|Elegir/ }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Volantes' }).click()
    await page.getByRole('button', { name: 'Nuevo Registro' }).click()
  }
  await page.getByLabel(/Nombre completo/).fill(name)
  await page.getByLabel(/^Celular/).fill(randomPhone())
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  const menu = page.getByRole('button', { name: 'Abrir menú' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('button', { name: 'Salir' }).click()
  await expect(page).toHaveURL(/\/login$/)

  // Encargado: Panel con indicadores y embudo
  await login(page, 'enc.verdolago')
  await expect(page).toHaveURL(/\/panel/)
  const kpis = page.getByTestId('kpis')
  await expect(kpis).toContainText('Captaciones')
  await expect(kpis).toContainText('Ventas')
  await expect(page.getByRole('heading', { name: 'Embudo' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Por canal de captación' })).toBeVisible()

  // Captaciones: chip Volantes filtra
  await page.goto('/gestion')
  await page.getByTestId('chip-Volantes').click()
  await expect(page).toHaveURL(/canal=/)
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
})
