import { expect, test } from '@playwright/test'
import { fillCapture, login, randomPhone } from './helpers'

test('reparto: vista previa con cupos y reparto de una vez (Trinidad, para no chocar con otras pruebas)', async ({ page }) => {
  const tag = String(Date.now()).slice(-5)
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)

  // El encargado capta 2 (también registra)
  for (const n of ['Uno', 'Dos']) {
    await page.goto('/registrar')
    await fillCapture(page, `Repartir ${n} ${tag}`, randomPhone())
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page).toHaveURL(/\/registrar$/)
  }
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })

  // Repartir: hay al menos 2; por defecto todo va al único que puede recibir en Trinidad (el encargado)
  await page.goto('/repartir')
  // Esperar a que cargue la vista previa (antes de cargar muestra 0)
  await expect.poll(async () => Number(await page.getByTestId('pool-total').innerText())).toBeGreaterThanOrEqual(2)
  // Otras pruebas captan en Trinidad en paralelo: el total puede cambiar si la vista previa se recarga,
  // así que se toma la cifra que muestra cada paso en vez de fijarla al inicio.
  const quota = page.getByLabel('Recibirá Encargado Trinidad')
  await expect.poll(async () => Number(await quota.inputValue())).toBeGreaterThanOrEqual(2)

  // Ajustar: uno menos → queda 1 sin repartir
  await page.getByRole('button', { name: 'Menos a Encargado Trinidad' }).click()
  await expect(page.getByText('quedan 1 sin repartir')).toBeVisible()
  const button = page.getByRole('button', { name: /^Repartir \d+$/ })
  const count = Number((await button.innerText()).replace(/\D/g, ''))
  await button.click()
  await expect(page.getByText(`✓ ${count} captaciones repartidas`)).toBeVisible()
  await expect.poll(async () => Number(await page.getByTestId('pool-total').innerText())).toBeGreaterThanOrEqual(1)
})
