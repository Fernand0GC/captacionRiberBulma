import { expect, test } from '@playwright/test'
import { fillCapture, login, randomPhone } from './helpers'

const SHOTS = process.env.MAP_SHOTS

test('captación con ubicación marcada en el mapa: se guarda y se ve en la ficha', async ({ browser, page }) => {
  const name = `Mapa ${String(Date.now()).slice(-5)}`
  const ctx = await browser.newContext({
    ...test.info().project.use,
    geolocation: { latitude: -14.833452, longitude: -64.904217 },
    permissions: ['geolocation'],
  })
  const vol = await ctx.newPage()
  await login(vol, 'vol.trinidad')
  await fillCapture(vol, name, randomPhone())
  await vol.getByPlaceholder('Escribe la dirección').fill('Barrio Pompeya, a media cuadra del mercado')
  if (SHOTS) await vol.screenshot({ path: `${SHOTS}/1-formulario.png` })

  await vol.getByRole('button', { name: 'Abrir mapa' }).click()
  const map = vol.getByRole('dialog', { name: 'Marcar ubicación del cliente' })
  await expect(map).toBeVisible()
  await map.getByRole('button', { name: 'Mi ubicación' }).click()
  await expect(map.getByTestId('map-coords')).toHaveText('-14.83345, -64.90422')
  if (SHOTS) {
    await vol.waitForTimeout(1500)
    await vol.screenshot({ path: `${SHOTS}/2-mapa.png` })
    await map.getByRole('button', { name: 'Satélite' }).click()
    await vol.waitForTimeout(2000)
    await vol.screenshot({ path: `${SHOTS}/3-satelite.png` })
  }
  await map.getByRole('button', { name: 'Usar esta ubicación' }).click()
  await expect(map).toBeHidden()
  await expect(vol.getByTestId('location-chip')).toBeVisible()
  if (SHOTS) await vol.screenshot({ path: `${SHOTS}/4-marcada.png` })

  await vol.getByRole('button', { name: 'Guardar' }).click()
  await expect(vol.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  await ctx.close()

  // El encargado ve la dirección escrita y el enlace al mapa con las coordenadas
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/gestion')
  await page.getByRole('link', { name, exact: true }).filter({ visible: true }).click()
  await expect(page.getByText('Barrio Pompeya, a media cuadra del mercado')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver en el mapa' })).toHaveAttribute('href', 'https://www.google.com/maps?q=-14.833452,-64.904217')
})
