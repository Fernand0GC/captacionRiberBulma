import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('jefe de ventas: gestiona solo sus sucursales (Verdolago y Trinidad), sin la opción "todas"', async ({ page }) => {
  await login(page, 'jefe.ventas')
  await expect(page).toHaveURL(/\/panel/)

  for (const path of ['/panel', '/gestion', '/repartir', '/metas', '/planificacion']) {
    await page.goto(path)
    const select = page.getByRole('combobox', { name: 'Sucursal' })
    await expect(select, path).toBeVisible()
    await expect(select.locator('option')).toHaveText(['VERDOLAGO', 'TRINIDAD'])
  }

  // Cambiar a Trinidad en Captaciones filtra esa sucursal
  await page.goto('/gestion')
  await page.getByRole('combobox', { name: 'Sucursal' }).selectOption({ label: 'TRINIDAD' })
  await expect(page.getByRole('heading', { level: 1 }).locator('..')).toContainText('TRINIDAD')

  // No administra usuarios ni registra
  await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0)
})

test('Sistemas ve el rol Jefe de ventas con sus sucursales', async ({ page }) => {
  await login(page, 'admin')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/admin/usuarios')
  await page.getByLabel('Buscar usuario').fill('jefe.ventas')
  await expect(page.getByTestId('user-jefe.ventas')).toContainText('Jefe de ventas · VERDOLAGO, TRINIDAD')
  await page.getByTestId('user-jefe.ventas').getByRole('button', { name: 'Editar' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('checkbox', { name: 'VERDOLAGO' })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'TRINIDAD' })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'SAN JOSÉ' })).not.toBeChecked()
})
