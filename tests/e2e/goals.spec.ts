import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('metas diarias: el encargado pone la base y el Panel muestra el avance de hoy', async ({ page }) => {
  await login(page, 'enc.trinidad') // Trinidad: no choca con las pruebas de Verdolago
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/metas')
  await page.locator('#base-captures').fill('25')
  await page.locator('#base-potential').fill('9')
  await page.getByRole('button', { name: 'Guardar meta base' }).click()
  await expect(page.getByText('✓ Meta base guardada')).toBeVisible()

  await page.goto('/panel')
  await expect(page.getByRole('heading', { name: 'Metas de hoy' })).toBeVisible()
  await expect(page.getByTestId('goal-captures')).toContainText('/ 25')
  await expect(page.getByTestId('goal-potential')).toContainText('/ 9')

  // Ajuste de hoy
  await page.goto('/metas')
  // El ajuste arranca con la base cuando termina de cargar; recién ahí se escribe (si no, se mezclan los números)
  await expect(page.locator('#adj-captures')).toHaveValue('25')
  await page.locator('#adj-captures').fill('40')
  await page.getByLabel(/Motivo/).fill('Feria')
  await page.getByRole('button', { name: 'Guardar ajuste' }).click()
  await expect(page.getByText('✓ Ajuste guardado')).toBeVisible()
  await page.goto('/panel')
  await expect(page.getByTestId('goal-captures')).toContainText('/ 40')
  await expect(page.getByText(/Ajustada · Feria/)).toBeVisible()

  // Limpieza: quitar el ajuste
  await page.goto('/metas')
  await page.getByRole('button', { name: 'Quitar ajuste' }).click()
  await expect(page.getByText('Ajuste quitado: vuelve la base')).toBeVisible()
})
