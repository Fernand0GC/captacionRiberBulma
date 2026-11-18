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
  await dlg.getByRole('checkbox', { name: 'Activaciones en barrios' }).check()
  await expect(dlg.getByLabel('Hora inicio')).toHaveValue('10:00')
  await expect(dlg.getByLabel('Hora fin')).toHaveValue('12:00')
  // Cambiar el turno propone el horario de la tarde
  await dlg.getByRole('combobox', { name: /^Turno/ }).selectOption({ label: 'Tarde' })
  await expect(dlg.getByLabel('Hora inicio')).toHaveValue('16:30')
  await dlg.getByRole('combobox', { name: /^Turno/ }).selectOption({ label: 'Mañana' })
  await dlg.getByRole('textbox', { name: /^Ubicación/ }).fill(place)
  // Meta de captación obligatoria (spec 004, FR-004)
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(dlg.getByText(/Escribe la meta de captación/)).toBeVisible()
  await expect(dlg.getByRole('spinbutton', { name: /^Meta de compartidas/ })).toHaveCount(0)
  await dlg.getByRole('spinbutton', { name: /^Meta de captación/ }).fill('30')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Asignación agregada')).toBeVisible()

  const card = page.getByTestId('assignment-card').filter({ hasText: place })
  await expect(card).toContainText('Pendiente')
  await expect(card).toContainText('Activaciones en barrios')
  await expect(card).toContainText('Gerente: Jefe de Ventas Prueba')

  // Resultado
  await card.getByRole('button', { name: 'Resultado' }).click()
  const res = page.getByRole('dialog', { name: 'Resultado' })
  await expect(res.getByRole('spinbutton', { name: /^Compartidas/ })).toHaveCount(0)
  await res.getByRole('spinbutton', { name: /^Captados/ }).fill('15')
  await res.getByRole('textbox', { name: /^Observaciones/ }).fill('5 ventas concretadas')
  await res.getByRole('button', { name: 'Guardar' }).click()
  await expect(card).toContainText('15 de 30 · 50 %')
  await expect(card).toContainText('5 ventas concretadas')

  // Filtro por canal: la fila sigue; por otro canal, desaparece
  const filters = page.getByRole('region', { name: 'Filtros' })
  await filters.getByRole('combobox', { name: 'Canal', exact: true }).selectOption('Activación')
  await expect(card).toBeVisible()
  await expect(page.getByTestId('org-totals')).toContainText('Captados')
  await expect(page.getByTestId('org-totals')).toContainText('Meta de compartidas')

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
  await expect(dlg.getByRole('spinbutton', { name: /^Meta de captación/ })).toBeVisible()
  await expect(dlg.getByRole('spinbutton', { name: /^Meta de compartidas/ })).toHaveCount(0)
  // Compartidas y estados: solo meta de compartidas (spec 004, US1 escenario 2)
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Compartidas y estados' })
  await expect(dlg.getByRole('spinbutton', { name: /^Meta de captación/ })).toHaveCount(0)
  await expect(dlg.getByRole('spinbutton', { name: /^Meta de compartidas/ })).toBeVisible()
  await dlg.getByRole('checkbox', { name: 'Compartidas y estados' }).check()
  const shareOnly = dlg.getByRole('group', { name: 'Metas de Compartidas y estados' })
  await expect(shareOnly.getByRole('spinbutton')).toHaveCount(1)
  await expect(shareOnly.getByRole('spinbutton', { name: /^Meta de compartidas/ })).toBeVisible()
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

test('organización (004): carga varios subcanales con dos metas, registra compartidas y agrega un subcanal', async ({ page }) => {
  page.on('dialog', (d) => void d.accept()) // confirmación al quitar
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/planificacion')
  await page.getByRole('button', { name: 'Día siguiente', exact: true }).click()

  // Carga múltiple: WhatsApp y Barrios chinos, cada uno con sus metas
  await page.getByRole('button', { name: '＋ Mañana' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nueva asignación' })
  await dlg.getByRole('combobox', { name: /^Persona/ }).selectOption({ label: 'Volantera Trinidad' })
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Tienda' })
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'RRSS-Mensajería' })
  await dlg.getByRole('checkbox', { name: 'Mensajería WhatsApp' }).check()
  await dlg.getByRole('checkbox', { name: 'Barrios chinos - grupos' }).check()
  // El horario lo propone el primero marcado
  await expect(dlg.getByLabel('Hora inicio')).toHaveValue('09:00')
  await dlg.getByLabel('Hora inicio').fill('08:30')
  await dlg.getByLabel('Hora fin').fill('12:30')
  const wa = dlg.getByRole('group', { name: 'Metas de Mensajería WhatsApp' })
  const bc = dlg.getByRole('group', { name: 'Metas de Barrios chinos - grupos' })
  await wa.getByRole('spinbutton', { name: /^Meta de captación/ }).fill('20')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(dlg.getByText('Escribe la meta de compartidas de «Mensajería WhatsApp».')).toBeVisible()
  await wa.getByRole('spinbutton', { name: /^Meta de compartidas/ }).fill('15')
  await bc.getByRole('spinbutton', { name: /^Meta de captación/ }).fill('10')
  await bc.getByRole('spinbutton', { name: /^Meta de compartidas/ }).fill('30')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ 2 asignaciones agregadas')).toBeVisible()

  const cards = page.getByTestId('assignment-card').filter({ hasText: '08:30–12:30' }).filter({ hasText: 'Volantera Trinidad' })
  const waCard = cards.filter({ hasText: 'Mensajería WhatsApp' })
  const bcCard = cards.filter({ hasText: 'Barrios chinos - grupos' })
  await expect(waCard).toHaveCount(1)
  await expect(waCard).toContainText('Meta captación 20 · Meta compartidas 15')
  await expect(bcCard).toContainText('Meta captación 10 · Meta compartidas 30')
  await expect(waCard.getByTestId('batch-tag')).toHaveText('carga de 2')
  await expect(bcCard.getByTestId('batch-tag')).toHaveText('carga de 2')

  // Resultado por separado, con su cumplimiento
  await waCard.getByRole('button', { name: 'Resultado' }).click()
  const res = page.getByRole('dialog', { name: 'Resultado' })
  await res.getByRole('spinbutton', { name: /^Captados/ }).fill('18')
  await res.getByRole('spinbutton', { name: /^Compartidas/ }).fill('15')
  await res.getByRole('button', { name: 'Guardar' }).click()
  await expect(waCard).toContainText('Captados 18 de 20 · 90 %')
  await expect(waCard).toContainText('Compartidas 15 de 15 · 100 %')
  // Quitar una de la carga no toca la otra
  await bcCard.getByRole('button', { name: 'Quitar asignación de Volantera Trinidad' }).click()
  await expect(bcCard).toHaveCount(0)
  await expect(waCard).toHaveCount(1)
  await expect(waCard.getByTestId('batch-tag')).toHaveCount(0)

  // «+ Agregar otro…»: crea el subcanal (o usa el que ya existe) y lo deja marcado
  const name = 'Kardex de ventas e2e'
  await page.getByRole('button', { name: '＋ Mañana' }).click()
  await dlg.getByRole('combobox', { name: /^Persona/ }).selectOption({ label: 'Volantera Trinidad' })
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Tienda' })
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Tareas administrativas' })
  await dlg.getByRole('button', { name: '+ Agregar otro…' }).click()
  await dlg.getByRole('textbox', { name: 'Nombre del subcanal nuevo' }).fill(name)
  await dlg.getByRole('button', { name: 'Agregar', exact: true }).click()
  await expect(dlg.getByRole('checkbox', { name })).toBeChecked()
  // El mismo nombre escrito distinto usa el existente
  await dlg.getByRole('button', { name: '+ Agregar otro…' }).click()
  await dlg.getByRole('textbox', { name: 'Nombre del subcanal nuevo' }).fill('  KÁRDEX de   ventas E2E ')
  await dlg.getByRole('button', { name: 'Agregar', exact: true }).click()
  await expect(page.getByText('Ya existía un subcanal con ese nombre: se marcó ese.').last()).toBeVisible()
  await expect(dlg.getByRole('checkbox', { name })).toHaveCount(1)
  await dlg.getByLabel('Hora inicio').fill('14:00')
  await dlg.getByLabel('Hora fin').fill('15:00')
  await dlg.getByRole('group', { name: `Metas de ${name}` }).getByRole('spinbutton', { name: /^Meta de captación/ }).fill('5')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Asignación agregada')).toBeVisible()
  const kCard = page.getByTestId('assignment-card').filter({ hasText: name })
  await expect(kCard).toHaveCount(1)

  // Limpieza (el subcanal queda en el catálogo con el mismo nombre y se reutiliza en la próxima corrida)
  await kCard.getByRole('button', { name: 'Quitar asignación de Volantera Trinidad' }).click()
  await waCard.getByRole('button', { name: 'Quitar asignación de Volantera Trinidad' }).click()
  await expect(kCard).toHaveCount(0)
  await expect(waCard).toHaveCount(0)
})

test('organización (004): Sistemas ve las metas por subcanal y quién agregó un subcanal', async ({ page }) => {
  await login(page, 'admin')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/admin/catalogo')
  await page.getByRole('button', { name: 'Subcanales de RRSS-Mensajería' }).click()
  const wa = page.getByTestId('catalog-row-org_subchannels').filter({ has: page.locator('input[value="Mensajería WhatsApp"]') })
  await expect(wa.getByRole('checkbox', { name: 'Captación' })).toBeChecked()
  await expect(wa.getByRole('checkbox', { name: 'Compartidas' })).toBeChecked()
  await page.getByRole('button', { name: 'Subcanales de Tareas administrativas' }).click()
  const k = page.getByTestId('catalog-row-org_subchannels').filter({ has: page.locator('input[value="Kardex de ventas e2e"]') })
  await expect(k.getByTestId('added-by-sales')).toContainText('Agregado por Encargado Trinidad el')
})
