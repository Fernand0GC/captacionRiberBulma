import { expect, test } from '@playwright/test'
import { login, openNewWithChannel, randomPhone } from './helpers'

// Spec 033 (obs. 10 y 11): con el canal Freelance el registro pide solo nombre, celular, freelancer y producto, y
// entra como venta. Los referidores de prueba empiezan con «E2E » (los borra `pnpm db:clean`).
test('registro (033): con Freelance el formulario es corto y guarda la venta', async ({ page }) => {
  const tag = String(Date.now()).slice(-6)
  const freelancer = `E2E Freelancer ${tag}`
  await login(page, 'sup.verdolago')
  await openNewWithChannel(page, 'Freelance', 'Freelancers de la zona')

  // Criterio 1: solo los cuatro campos.
  await expect(page.getByLabel(/Nombre completo/)).toBeVisible()
  await expect(page.getByLabel(/^Celular/)).toBeVisible()
  await expect(page.getByLabel(/^Freelancer/)).toBeVisible()
  await expect(page.getByText('Producto que compró')).toBeVisible()
  await expect(page.getByText('Ocupación del cliente')).toHaveCount(0)
  await expect(page.getByText('Nivel de interés')).toHaveCount(0)
  await expect(page.getByText('Dirección o referencia')).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Es referido' })).toHaveCount(0)

  // Criterio 2: freelancer y producto obligatorios.
  await page.getByLabel(/Nombre completo/).fill(`Cliente Freelance ${tag}`)
  await page.getByLabel(/^Celular/).fill(randomPhone())
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Escribe el nombre del freelancer.')).toBeVisible()
  await expect(page.getByText('Elige el producto que compró.')).toBeVisible()

  // Criterio 3: freelancer nuevo, sin preguntar el tipo.
  await page.getByLabel(/^Freelancer/).fill(freelancer)
  await page.getByRole('button', { name: `＋ Agregar «${freelancer}»` }).click()
  await expect(page.getByRole('group', { name: /Quién es/ })).toHaveCount(0)
  await expect(page.getByTestId('referrer-chosen')).toContainText(freelancer)

  await page.getByRole('tab', { name: 'Celulares' }).click()
  await expect(page.getByTestId('product-choice')).toBeVisible()

  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Guardado')).toBeVisible()
  // Criterio 4: la cola lo sube al servidor (la base lo deja como venta; lo comprueba freelance_sale_test.sql).
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
})

test('registro (033): con otro canal el formulario sigue completo', async ({ page }) => {
  await login(page, 'sup.verdolago')
  await openNewWithChannel(page, 'Activación')
  await expect(page.getByLabel(/^Freelancer/)).toHaveCount(0)
  await expect(page.getByText('Nivel de interés')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Es referido' })).toBeVisible()
})
