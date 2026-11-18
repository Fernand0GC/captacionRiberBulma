import { expect, test } from '@playwright/test'
import { login, logoutFromManage } from './helpers'

// Planificación anterior (spec 001, US4): desde la spec 003 es historial de solo lectura.
test('planificación anterior: el encargado la consulta sin editar y la volantera ya no la ve', async ({ page }) => {
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/planificacion')
  await page.getByRole('link', { name: 'Planificación anterior' }).click()
  await expect(page).toHaveURL(/\/planificacion\/historial$/)
  await expect(page.getByText(/Solo consulta/)).toBeVisible()
  await expect(page.getByTestId('plan-day')).toContainText('Hoy')
  await expect(page.getByRole('button', { name: /Agregar/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Copiar/ })).toHaveCount(0)

  await logoutFromManage(page)
  await login(page, 'vol.trinidad')
  await expect(page).toHaveURL(/\/registrar/)
  await expect(page.getByTestId('current-activity')).toHaveCount(0)
  await page.goto('/planificacion/historial')
  await expect(page).toHaveURL(/\/registrar$/)
})
