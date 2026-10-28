import { expect, test } from '@playwright/test'
import { login, logoutFromManage } from './helpers'

test('Sistemas crea un volantero, el volantero entra; al darlo de baja ya no puede entrar (US7)', async ({ page }) => {
  const username = `vol.e2e${String(Date.now()).slice(-6)}`

  await login(page, 'admin')
  await expect(page).toHaveURL(/\/gestion/)
  await page.goto('/admin/usuarios')
  await page.getByRole('button', { name: '＋ Nuevo usuario' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo usuario' })
  await dialog.getByLabel(/Usuario \(para entrar\)/).fill(username)
  await dialog.getByLabel(/Nombre completo/).fill('Volantera de Prueba')
  await dialog.getByLabel(/^Sucursal/).selectOption({ label: 'TRINIDAD' })
  await dialog.getByRole('button', { name: 'Crear usuario' }).click()

  const created = page.getByRole('dialog', { name: 'Usuario creado' })
  await expect(created.getByTestId('new-username')).toHaveText(username)
  const password = (await created.getByTestId('new-password').innerText()).trim()
  await created.getByRole('button', { name: 'Listo' }).click()
  await logoutFromManage(page)

  // El nuevo volantero entra al registro de campo
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(username)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/registrar$/)
  await page.getByRole('button', { name: 'Salir' }).click()
  await expect(page).toHaveURL(/\/login$/)

  // Baja
  await login(page, 'admin')
  await expect(page).toHaveURL(/\/gestion/)
  await page.goto('/admin/usuarios')
  await page.getByLabel('Buscar usuario').fill(username)
  await page.getByTestId(`user-${username}`).getByRole('button', { name: 'Dar de baja' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Dar de baja' }).click()
  await page.getByLabel('Estado').selectOption('inactive')
  await expect(page.getByTestId(`user-${username}`)).toContainText('Baja')
  await logoutFromManage(page)

  await page.goto('/login')
  await page.getByLabel('Usuario').fill(username)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: 'Usuario desactivado' })).toBeVisible()
})
