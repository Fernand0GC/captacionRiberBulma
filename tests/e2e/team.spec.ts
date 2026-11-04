import { expect, test, type Page } from '@playwright/test'
import { login, logoutFromManage } from './helpers'

async function loginAs(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(username)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
}

test('Mi equipo: el encargado crea una volantera, la desactiva, la reactiva y la elimina', async ({ page }) => {
  const name = `Volantera E2E ${String(Date.now()).slice(-6)}`

  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/equipo')
  await page.getByRole('button', { name: '＋ Nueva volantera' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nueva volantera' })
  await dialog.getByLabel(/Nombre y apellido/).fill(name)
  await dialog.getByRole('button', { name: 'Crear' }).click()

  const created = page.getByRole('dialog', { name: 'Volantera creada' })
  // Crear la cuenta pasa por el servidor de autenticación: con las demás pruebas en paralelo tarda más de 5 s
  await expect(created.getByTestId('team-password')).toHaveText(/^\d{6}$/, { timeout: 15_000 })
  const username = (await created.getByTestId('team-username').innerText()).trim()
  const password = (await created.getByTestId('team-password').innerText()).trim()
  expect(username).toMatch(/^vol\.trini\.volantera\d*$/)
  await expect(created.getByRole('link', { name: 'Enviar por WhatsApp' })).toHaveAttribute('href', /wa\.me/)
  await created.getByRole('button', { name: 'Listo' }).click()
  await expect(page.getByTestId(`member-${username}`)).toContainText(name)
  await logoutFromManage(page)

  // Entra con la clave de 6 números
  await loginAs(page, username, password)
  await expect(page).toHaveURL(/\/registrar$/)
  await logoutFromManage(page)

  // Desactivar con el interruptor (con "Deshacer" en el aviso)
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/equipo')
  await page.getByRole('switch', { name: `Activa: ${name}` }).click()
  await expect(page.getByRole('button', { name: 'Deshacer' })).toBeVisible()
  await page.getByRole('tab', { name: /Inactivas/ }).click()
  await expect(page.getByRole('switch', { name: `Activa: ${name}` })).toHaveAttribute('aria-checked', 'false')
  await logoutFromManage(page)

  await loginAs(page, username, password)
  await expect(page.getByRole('heading', { name: 'Usuario desactivado' })).toBeVisible()
  await page.getByRole('button', { name: 'Salir' }).click()

  // Vuelve a la temporada: al escribir su nombre se ofrece reactivarla en vez de crear otra cuenta
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/equipo')
  await page.getByRole('button', { name: '＋ Nueva volantera' }).click()
  await page.getByRole('dialog', { name: 'Nueva volantera' }).getByLabel(/Nombre y apellido/).fill(name.toLowerCase())
  await page.getByRole('button', { name: /^Reactivar a/ }).click()
  await expect(page.getByRole('switch', { name: `Activa: ${name}` })).toHaveAttribute('aria-checked', 'true')

  // No registró nada: se elimina de verdad
  await page.getByRole('button', { name: `Opciones de ${name}` }).click()
  await page.getByRole('dialog', { name }).getByRole('button', { name: 'Eliminar' }).click()
  await page.getByRole('dialog', { name: `¿Eliminar a ${name}?` }).getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByTestId(`member-${username}`)).toHaveCount(0)
})

test('Mi equipo: el jefe de ventas elige entre sus sucursales', async ({ page }) => {
  await login(page, 'jefe.ventas')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/equipo')
  const branch = page.getByLabel('Sucursal')
  await expect(branch.locator('option')).toHaveText(['VERDOLAGO', 'TRINIDAD'])
  await branch.selectOption({ label: 'TRINIDAD' })
  await expect(page.getByTestId('member-vol.trinidad')).toBeVisible()
})
