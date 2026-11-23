import { expect, test } from '@playwright/test'
import { login } from './helpers'

// Spec 018: la encargada edita y quita asignaciones de HOY; los días pasados siguen sin «Editar» ni «✕».
// Trinidad para no chocar con las pruebas de Verdolago; lugar único para encontrar la fila propia.

test('planificación (018): la encargada edita y quita una asignación de hoy, y ayer no', async ({ page }) => {
  const place = `Hoy e2e ${Date.now() % 100000}`
  page.on('dialog', (d) => void d.accept()) // confirmación al quitar y avisos de cruce
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/planificacion')
  await page.getByRole('button', { name: 'Hoy', exact: true }).click()

  // Crear una asignación de hoy
  await page.getByRole('button', { name: '＋ Mañana' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nueva asignación' })
  await dlg.getByRole('combobox', { name: /^Persona/ }).selectOption({ label: 'Volantera Trinidad' })
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Calle' })
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Activación' })
  await dlg.getByRole('checkbox', { name: 'Activaciones en barrios' }).check()
  await dlg.getByRole('textbox', { name: /^Ubicación/ }).fill(place)
  await dlg.getByRole('textbox', { name: /^Meta de captación/ }).fill('30')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Asignación agregada')).toBeVisible()

  // US1: la fila de hoy muestra «Editar» y «✕», y la meta se puede cambiar
  const card = page.getByTestId('assignment-card').filter({ hasText: place })
  await expect(card).toContainText('Meta captación 30')
  await expect(card.getByRole('button', { name: 'Quitar asignación de Volantera Trinidad' })).toBeVisible()
  await card.getByRole('button', { name: 'Editar' }).click()
  const edit = page.getByRole('dialog', { name: 'Editar asignación' })
  await edit.getByRole('textbox', { name: /^Meta de captación/ }).fill('45')
  await edit.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Asignación actualizada')).toBeVisible()
  await expect(card).toContainText('Meta captación 45')

  // US2: se quita
  await card.getByRole('button', { name: 'Quitar asignación de Volantera Trinidad' }).click()
  await expect(card).toHaveCount(0)

  // US3: en el día anterior ninguna fila deja editar ni quitar (el resultado sí sigue disponible)
  await page.getByRole('button', { name: 'Día anterior', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Quitar asignación de / })).toHaveCount(0)
})
