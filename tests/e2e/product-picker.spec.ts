import { expect, test } from '@playwright/test'
import { fillCapture, login, randomPhone } from './helpers'

test('producto: Celulares con un toque; electro por categorías; buscador general (FR-011c)', async ({ page }) => {
  await login(page, 'aux.verdolago') // otro usuario: las pruebas corren en paralelo y comparten el contador
  await fillCapture(page, 'Prueba Producto', randomPhone())

  // Celulares: una sola opción, queda elegido directo
  await page.getByRole('tab', { name: 'Celulares' }).click()
  await expect(page.getByTestId('product-choice')).toHaveText('Celulares')

  // Electro mayor: 26 categorías, sin marcas
  await page.getByRole('button', { name: 'Cambiar' }).click()
  await page.getByRole('tab', { name: 'Electro mayor' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Electro mayor' }).getByRole('button')).toHaveCount(26)
  await page.getByRole('tab', { name: 'Electro menor' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Electro menor' }).getByRole('button')).toHaveCount(30)

  // Buscador general, sin tildes
  await page.getByLabel('Buscar producto').fill('sillon')
  await page.getByRole('button', { name: /Sillón ejecutivo/ }).click()
  await expect(page.getByTestId('product-choice')).toHaveText('Sillón ejecutivo')

  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/registrar$/)
})
