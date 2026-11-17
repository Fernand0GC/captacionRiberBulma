import { expect, test } from '@playwright/test'
import { login, logoutFromManage } from './helpers'

// Organización comercial (spec 003). Trinidad para no chocar con las pruebas de Verdolago; día siguiente para que
// el encargado pueda editar (desde el día de la asignación solo el gerente cambia la meta, FR-029).

test('organización: el encargado carga con horario sugerido, registra resultado, filtra, exporta y quita', async ({ page }) => {
  const place = `Barrio e2e ${Date.now() % 100000}`
  page.on('dialog', (d) => void d.accept()) // confirmación al quitar
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/planificacion')
  // exact: «Copiar al día siguiente» también contiene el texto
  await page.getByRole('button', { name: 'Día siguiente', exact: true }).click()

  await page.getByRole('button', { name: '＋ Mañana' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nueva asignación' })
  await dlg.getByRole('combobox', { name: /^Persona/ }).selectOption({ label: 'Volantera Trinidad' })
  // El canal se habilita por estrategia y el subcanal por canal
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Calle' })
  await expect(dlg.getByRole('combobox', { name: /^Canal/ }).locator('option')).toHaveText(['Elegir…', 'Negociación', 'Activación', 'Volantes'])
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Activación' })
  await dlg.getByRole('combobox', { name: /^Subcanal/ }).selectOption({ label: 'Activaciones en barrios' })
  await expect(dlg.getByLabel('Hora inicio')).toHaveValue('10:00')
  await expect(dlg.getByLabel('Hora fin')).toHaveValue('12:00')
  // Cambiar el turno propone el horario de la tarde
  await dlg.getByRole('combobox', { name: /^Turno/ }).selectOption({ label: 'Tarde' })
  await expect(dlg.getByLabel('Hora inicio')).toHaveValue('16:30')
  await dlg.getByRole('combobox', { name: /^Turno/ }).selectOption({ label: 'Mañana' })
  await dlg.getByRole('textbox', { name: /^Ubicación/ }).fill(place)
  await dlg.getByRole('spinbutton', { name: /^Meta/ }).fill('30')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Asignación agregada')).toBeVisible()

  const card = page.getByTestId('assignment-card').filter({ hasText: place })
  await expect(card).toContainText('Pendiente')
  await expect(card).toContainText('Activaciones en barrios')
  await expect(card).toContainText('Gerente: Jefe de Ventas Prueba')

  // Resultado
  await card.getByRole('button', { name: 'Resultado' }).click()
  const res = page.getByRole('dialog', { name: 'Resultado' })
  await res.getByRole('spinbutton', { name: /^Resultado/ }).fill('15')
  await res.getByRole('textbox', { name: /^Observaciones/ }).fill('5 ventas concretadas')
  await res.getByRole('button', { name: 'Guardar' }).click()
  await expect(card).toContainText('15 de 30 · 50 %')
  await expect(card).toContainText('5 ventas concretadas')

  // Filtro por canal: la fila sigue; por otro canal, desaparece
  const filters = page.getByRole('region', { name: 'Filtros' })
  await filters.getByRole('combobox', { name: 'Canal', exact: true }).selectOption('Activación')
  await expect(card).toBeVisible()
  await expect(page.getByTestId('org-totals')).toContainText('Resultado total')

  // Exportar
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Exportar Excel/ }).click()
  expect((await download).suggestedFilename()).toMatch(/^organizacion_trinidad_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.xlsx$/)

  // Limpieza
  await filters.getByRole('button', { name: 'Quitar filtros' }).click()
  await card.getByRole('button', { name: 'Quitar asignación de Volantera Trinidad' }).click()
  await expect(card).toHaveCount(0)
})

test('organización: en Tienda no se pide ubicación y los canales sin meta no la piden', async ({ page }) => {
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/planificacion')
  await page.getByRole('button', { name: 'Día siguiente', exact: true }).click()
  await page.getByRole('button', { name: '＋ Mañana' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nueva asignación' })
  // En Calle se pide todo
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Calle' })
  await expect(dlg.getByRole('textbox', { name: /^Ubicación/ })).toBeVisible()
  // En Tienda, sin ubicación; Llamadas con meta, Comentarios y Tareas administrativas sin meta
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Tienda' })
  await expect(dlg.getByRole('textbox', { name: /^Ubicación/ })).toHaveCount(0)
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Llamadas' })
  await expect(dlg.getByRole('spinbutton', { name: /^Meta/ })).toBeVisible()
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Comentarios' })
  await expect(dlg.getByRole('spinbutton', { name: /^Meta/ })).toHaveCount(0)
  await expect(dlg.getByTestId('no-goal-note')).toBeVisible()
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Tareas administrativas' })
  await expect(dlg.getByRole('spinbutton', { name: /^Meta/ })).toHaveCount(0)
  await dlg.getByRole('button', { name: 'Cancelar' }).click()
})

test('organización: el auxiliar ve solo «Mi plan» y la volantera no tiene acceso', async ({ page }) => {
  await login(page, 'aux.verdolago')
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await page.goto('/planificacion')
  await expect(page.getByText('Tus asignaciones')).toBeVisible()
  await expect(page.getByRole('button', { name: '＋ Mañana' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Filtros' })).toHaveCount(0)

  await logoutFromManage(page)
  await login(page, 'vol.trinidad')
  await expect(page).toHaveURL(/\/registrar/)
  await page.goto('/planificacion')
  await expect(page).toHaveURL(/\/registrar$/)
})
