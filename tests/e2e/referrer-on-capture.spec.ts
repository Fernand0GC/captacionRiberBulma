import { expect, test, type Page } from '@playwright/test'
import { fillCapture, login, logoutFromManage, randomPhone } from './helpers'

// Spec 010: quien registra escribe quién recomendó al cliente aunque no esté en la lista de la sucursal.
// Los referidores de prueba empiezan con "E2E " (los borra `pnpm db:clean`).

const cells = (page: Page, name: string) => page.getByTestId(`referrer-row-${name}`).locator('td')

test('referido al registrar: referidor nuevo con señal, el mismo sin señal, reporte y lista del jefe', async ({ page, context }) => {
  const tag = String(Date.now()).slice(-6)
  const susi = `E2E Doña Susi ${tag}`

  // 1) La auxiliar escribe un referidor que no existe, elige el tipo y guarda
  await login(page, 'aux.verdolago')
  await fillCapture(page, `Recomendada Uno ${tag}`, randomPhone())
  await page.getByRole('checkbox', { name: 'Es referido' }).check()
  // Sin indicar quién lo recomendó no se guarda
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Escribe quién lo recomendó.')).toBeVisible()
  await page.getByLabel(/Quién lo recomendó/).fill(`  ${susi}  `)
  // Escrito sin elegir ni agregar tampoco se guarda
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Elige uno de la lista o toca «Agregar».')).toBeVisible()
  await page.getByRole('button', { name: `＋ Agregar «${susi}»` }).click()
  await page.getByRole('group', { name: /Quién es/ }).getByRole('button', { name: 'Cliente' }).click()
  await expect(page.getByTestId('referrer-chosen')).toContainText(susi)
  await expect(page.getByTestId('referrer-chosen')).toContainText('nuevo, se agrega a la lista')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/registrar$/)
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })

  // 2) Sin señal: el recién escrito ya se sugiere (con otras mayúsculas y sin tilde) y no se ofrece agregarlo otra vez
  await context.setOffline(true)
  await fillCapture(page, `Recomendada Dos ${tag}`, randomPhone())
  await page.getByRole('checkbox', { name: 'Es referido' }).check()
  await page.getByLabel(/Quién lo recomendó/).fill(`e2e dona susi ${tag}`)
  const suggestions = page.getByRole('group', { name: 'Sugerencias de referidores' })
  await expect(suggestions.getByRole('button', { name: /Agregar/ })).toHaveCount(0)
  await suggestions.getByRole('button', { name: susi }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('1 por subir')).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 45_000 })
  await logoutFromManage(page)

  // 3) La jefa ve un solo referidor con los dos clientes, y de dónde salió
  await login(page, 'jefe.ventas')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/referidos')
  await expect(cells(page, susi).nth(1)).toHaveText('2')
  await page.getByRole('tab', { name: 'Referidores y metas' }).click()
  await expect(page.getByTestId(`referrer-edit-${susi}`)).toHaveCount(1)
  await expect(page.getByTestId(`referrer-source-${susi}`)).toContainText('Agregado en el registro')
})
