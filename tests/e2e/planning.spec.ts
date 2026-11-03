import { expect, test } from '@playwright/test'
import { fillCapture, login, logoutFromManage, randomPhone } from './helpers'

test('planificación: el encargado arma el día, las captaciones se cuentan solas, lo cierra y el volantero solo lo ve', async ({ page }) => {
  const desc = `Volanteo mercado ${Date.now() % 100000}`
  await login(page, 'enc.trinidad') // Trinidad: no choca con las pruebas de Verdolago
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/planificacion')
  await expect(page.getByTestId('plan-day')).toContainText('Hoy')
  await expect(page.getByTestId('day-goal')).toContainText('Meta del día (Metas)')

  await page.getByRole('region', { name: 'Turno Mañana' }).getByRole('button', { name: /Agregar/ }).click()
  await page.getByRole('textbox', { name: /^Actividad/ }).fill(desc)
  await page.getByRole('textbox', { name: 'Personal a cargo' }).fill('Volantera')
  // Todo el día y canal TikTok (las otras pruebas de Trinidad captan por Activación y anulan, y movían la cuenta)
  await page.getByLabel('Desde').fill('00:00')
  await page.getByLabel('Hasta').fill('23:59')
  await page.getByRole('combobox', { name: 'Canal' }).selectOption({ label: 'TikTok' })
  await page.getByRole('spinbutton', { name: 'Meta de captaciones' }).fill('1000')
  await page.getByRole('textbox', { name: /^Descripción del canal/ }).fill(`Live ${desc}`)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Actividad agregada')).toBeVisible()
  const row = page.getByTestId('activity').filter({ hasText: desc })
  await expect(row.getByTestId('activity-status')).toHaveText('En curso')
  await expect(row.getByTestId('activity-captures')).toContainText('/ 1000 captaciones · TikTok')
  const before = Number(await row.getByTestId('activity-captures').locator('strong').innerText())

  // El volantero la ve sin edición, registra un cliente por TikTok y el plan lo cuenta
  await logoutFromManage(page)
  await login(page, 'vol.trinidad')
  await expect(page).toHaveURL(/\/registrar/)
  await page.goto('/planificacion')
  const seen = page.getByTestId('activity').filter({ hasText: desc })
  await expect(seen).toBeVisible()
  await expect(seen.getByRole('button', { name: 'Editar' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Agregar/ })).toHaveCount(0)
  // Registrar muestra la actividad en curso y toma su canal solo (sin elegirlo a mano)
  await page.goto('/registrar')
  await expect(page.getByTestId('current-activity')).toContainText(`Ahora: ${desc}`)
  await expect(page.getByTestId('day-channel')).toHaveText('TikTok')
  await expect(page.getByTestId('day-channel-detail')).toHaveText(`Live ${desc}`)
  await expect(page.getByText('Según el plan del día')).toBeVisible()
  await fillCapture(page, `Plan ${Date.now() % 100000}`, randomPhone())
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  await page.goto('/planificacion')
  // Otras pruebas de Trinidad corren en paralelo y también pueden tomar el canal del plan: al menos +1
  await expect
    .poll(async () => Number(await seen.getByTestId('activity-captures').locator('strong').innerText()))
    .toBeGreaterThanOrEqual(before + 1)

  // El encargado cierra: el resultado viene sugerido con lo contado
  await logoutFromManage(page)
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/planificacion')
  await row.getByRole('button', { name: 'Cerrar' }).click()
  await expect(page.getByRole('radio', { name: 'No cumplida' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByPlaceholder(/3 ventas/)).toHaveValue(/^\d+ captaciones de 1000$/)
  await page.getByRole('radio', { name: 'Cumplida', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(row).toContainText('✓ Cumplida')
  await expect(row).toContainText(/\d+ captaciones de 1000/)

  // Limpieza
  await page.getByRole('button', { name: `Quitar ${desc}` }).click()
  await expect(page.getByTestId('activity').filter({ hasText: desc })).toHaveCount(0)
})
