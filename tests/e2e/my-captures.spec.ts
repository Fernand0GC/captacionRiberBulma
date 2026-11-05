import { expect, test } from '@playwright/test'
import { fillCapture, login, logoutFromManage, randomPhone } from './helpers'

test('Mis registros: la auxiliar ve solo lo que ella registró', async ({ page }) => {
  const name = `Mio Aux ${String(Date.now()).slice(-5)}`
  await login(page, 'aux.verdolago')
  await fillCapture(page, name, randomPhone())
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })

  await page.goto('/mis-registros')
  await page.getByRole('button', { name: 'Hoy' }).click()
  const card = page.getByTestId('my-capture').filter({ hasText: name })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Captación')
  await expect(card).toContainText('Sin asignar')
  await expect(page.getByTestId('my-total')).not.toHaveText('0')

  // Buscar filtra la lista
  await page.getByLabel('Buscar por nombre o celular').fill(name)
  await expect(page.getByTestId('my-capture')).toHaveCount(1)
  await logoutFromManage(page)

  // Otros roles no tienen esta pantalla
  await login(page, 'sup.verdolago')
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await page.goto('/mis-registros')
  await expect(page).not.toHaveURL(/\/mis-registros/)
})
