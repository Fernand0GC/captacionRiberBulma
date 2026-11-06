import { expect, test } from '@playwright/test'
import { fillCapture, login, logoutFromManage, randomPhone } from './helpers'

test('cerrados anteriores: el que no le interesó se ve con el check y se vuelve a captar', async ({ page }) => {
  const name = `Recaptar ${String(Date.now()).slice(-5)}`

  // Encargado capta y asigna a la auxiliar
  await login(page, 'enc.verdolago')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/registrar')
  await fillCapture(page, name, randomPhone())
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  await page.goto('/gestion')
  await page.getByLabel('Responsable').selectOption('sin')
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  await page.getByLabel(`Seleccionar ${name}`).filter({ visible: true }).check()
  await page.getByLabel('Asignar a').selectOption({ label: 'Auxiliar Verdolago (Auxiliar)' })
  await page.getByRole('button', { name: 'Asignar', exact: true }).click()
  await expect(page.getByText('✓ 1 asignadas')).toBeVisible()
  await logoutFromManage(page)

  // Auxiliar: no le interesa → sale de Mis contactos
  await login(page, 'aux.verdolago')
  await expect(page).toHaveURL(/\/seguimiento$/)
  const card = page.getByTestId('contact-card').filter({ hasText: name })
  await card.getByRole('button', { name: 'Registrar contacto' }).click()
  await page.getByRole('radio', { name: 'No le interesa' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ No le interesa → Sin interés')).toBeVisible()
  await expect(card).toHaveCount(0)

  // Check "Ver cerrados anteriores": aparece como Sin interés / Interrumpido
  await page.getByLabel('Ver cerrados anteriores').check()
  const closed = page.getByTestId('closed-card').filter({ hasText: name })
  await expect(closed).toContainText('Sin interés')
  await expect(closed).toContainText('Interrumpido')
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/cerrados.png`, fullPage: true })

  // Registrar sobre el cerrado abre un ciclo nuevo: pasa a Cliente potencial y vuelve a Mis contactos
  await closed.getByRole('button', { name: 'Registrar contacto' }).click()
  await page.getByRole('radio', { name: 'Muy interesado' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Muy interesado → Cliente potencial')).toBeVisible()
  await expect(closed).toHaveCount(0)
  await page.getByRole('tab', { name: /^Recaptados/ }).click()
  await page.getByRole('tab', { name: /Seguimiento/ }).click()
  await expect(page.getByTestId('contact-card').filter({ hasText: name })).toContainText('Muy interesado')
})
