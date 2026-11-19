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
  // Compartidas y estados: solo meta de compartidas (spec 004, US1 escenario 2). Desde la 006, dos tipos y sin el genérico.
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Compartidas y estados' })
  await expect(dlg.getByRole('spinbutton', { name: /^Meta de captación/ })).toHaveCount(0)
  await expect(dlg.getByRole('spinbutton', { name: /^Meta de compartidas/ })).toBeVisible()
  await expect(dlg.getByRole('checkbox', { name: 'Compartidas y estados', exact: true })).toHaveCount(0)
  await expect(dlg.getByRole('checkbox', { name: 'Compartidas redes sociales' })).toBeVisible()
  await dlg.getByRole('checkbox', { name: 'Compartidas WhatsApp' }).check()
  const shareOnly = dlg.getByRole('group', { name: 'Metas de Compartidas WhatsApp' })
  await expect(shareOnly.getByRole('spinbutton')).toHaveCount(1)
  await expect(shareOnly.getByRole('spinbutton', { name: /^Meta de compartidas/ })).toBeVisible()
  // Canales nuevos de Tienda (spec 006, US2), sin metas
  for (const name of ['Creación de contenido', 'Atención en tienda y venta', 'Seguimiento de contactos de la app']) {
    await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: name })
    await expect(dlg.getByTestId('no-goal-note')).toBeVisible()
  }
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Comentarios' })
  await expect(dlg.getByRole('spinbutton', { name: /^Meta/ })).toHaveCount(0)
  await expect(dlg.getByTestId('no-goal-note')).toBeVisible()
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Tareas administrativas' })
  // 008: si el canal tiene un solo subcanal, se marca solo; sin marcar, la meta es la del canal (ninguna)
  for (const cb of await dlg.getByRole('group', { name: 'Subcanales' }).getByRole('checkbox').all()) await cb.uncheck()
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
  // 007: compartidas es opcional; falta la captación de Barrios chinos. El aviso queda junto a los botones (FR-006)
  // y el foco va al campo que falta (FR-007).
  await expect(dlg.getByTestId('form-error')).toHaveText('Escribe la meta de captación de «Barrios chinos - grupos».')
  await expect(dlg.getByTestId('form-error')).toBeInViewport()
  await expect(bc.getByRole('spinbutton', { name: /^Meta de captación/ })).toBeFocused()
  await expect(wa.getByText('Meta de compartidas (opcional)')).toBeVisible()
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

  // «+ Agregar otro…»: crea el subcanal (o usa el que ya existe) y lo deja marcado. Desde la 006 toma las metas de su
  // canal: en Compartidas y estados pide solo la meta de compartidas (FR-004).
  const name = 'Compartidas grupos e2e'
  await page.getByRole('button', { name: '＋ Mañana' }).click()
  await dlg.getByRole('combobox', { name: /^Persona/ }).selectOption({ label: 'Volantera Trinidad' })
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Tienda' })
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Compartidas y estados' })
  await dlg.getByRole('button', { name: '+ Agregar otro…' }).click()
  await dlg.getByRole('textbox', { name: 'Nombre del subcanal nuevo' }).fill(name)
  await dlg.getByRole('button', { name: 'Agregar', exact: true }).click()
  await expect(dlg.getByRole('checkbox', { name })).toBeChecked()
  // El mismo nombre escrito distinto usa el existente
  await dlg.getByRole('button', { name: '+ Agregar otro…' }).click()
  await dlg.getByRole('textbox', { name: 'Nombre del subcanal nuevo' }).fill('  COMPARTIDAS  grupos E2E ')
  await dlg.getByRole('button', { name: 'Agregar', exact: true }).click()
  await expect(page.getByText('Ya existía un subcanal con ese nombre: se marcó ese.').last()).toBeVisible()
  await expect(dlg.getByRole('checkbox', { name })).toHaveCount(1)
  await dlg.getByLabel('Hora inicio').fill('14:00')
  await dlg.getByLabel('Hora fin').fill('15:00')
  const added = dlg.getByRole('group', { name: `Metas de ${name}` })
  await expect(added.getByRole('spinbutton', { name: /^Meta de captación/ })).toHaveCount(0)
  await added.getByRole('spinbutton', { name: /^Meta de compartidas/ }).fill('5')
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
  await page.getByRole('button', { name: 'Subcanales de Compartidas y estados' }).click()
  const k = page.getByTestId('catalog-row-org_subchannels').filter({ has: page.locator('input[value="Compartidas grupos e2e"]') })
  await expect(k.getByTestId('added-by-sales')).toContainText('Agregado por Encargado Trinidad el')
  await expect(k.getByRole('checkbox', { name: 'Captación' })).not.toBeChecked()
  await expect(k.getByRole('checkbox', { name: 'Compartidas' })).toBeChecked()
  // El genérico queda desactivado; Activación pide volanteras (spec 006)
  const generic = page.getByTestId('catalog-row-org_subchannels').filter({ has: page.locator('input[value="Compartidas y estados"]') })
  await expect(generic.getByRole('checkbox', { name: 'Activo' })).not.toBeChecked()
  const activation = page.getByTestId('catalog-row-org_channels').filter({ has: page.locator('input[value="Activación"]') })
  await expect(activation.getByRole('checkbox', { name: 'Pide volanteras' })).toBeChecked()
})

test('organización (006): observaciones al crear, volanteras que van, orden por persona y Excel con totales numéricos', async ({ page }) => {
  const tag = String(Date.now()).slice(-6)
  const placeA = `Plaza e2e A ${tag}`
  const placeB = `Plaza e2e B ${tag}`
  page.on('dialog', (d) => void d.accept()) // confirmación al quitar
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/planificacion')
  await page.getByRole('button', { name: 'Día siguiente', exact: true }).click()

  // 1) La volantera a las 09:00, en una carga de dos subcanales con observación (va a las dos)
  await page.getByRole('button', { name: '＋ Mañana' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nueva asignación' })
  await dlg.getByRole('combobox', { name: /^Persona/ }).selectOption({ label: 'Volantera Trinidad' })
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Calle' })
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Volantes' })
  await expect(dlg.getByRole('group', { name: 'Volanteras que van' })).toHaveCount(0) // Volantes no las pide
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Activación' })
  await dlg.getByRole('checkbox', { name: 'Activaciones en plazas' }).check()
  await expect(dlg.getByLabel('Hora inicio')).toHaveValue('10:00') // horario sugerido (FR-007)
  await dlg.getByRole('checkbox', { name: 'Activaciones en barrios' }).check()
  await dlg.getByLabel('Hora inicio').fill('09:00')
  await dlg.getByLabel('Hora fin').fill('09:30')
  await dlg.getByRole('textbox', { name: /^Ubicación/ }).fill(placeB)
  await dlg.getByRole('group', { name: 'Metas de Activaciones en plazas' }).getByRole('spinbutton').fill('10')
  await dlg.getByRole('group', { name: 'Metas de Activaciones en barrios' }).getByRole('spinbutton').fill('20')
  await dlg.getByRole('textbox', { name: /^Observaciones/ }).fill('Llevar banner')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ 2 asignaciones agregadas')).toBeVisible()
  const bCards = page.getByTestId('assignment-card').filter({ hasText: placeB })
  await expect(bCards).toHaveCount(2)
  await expect(bCards.filter({ hasText: '“Llevar banner”' })).toHaveCount(2)

  // 2) El encargado a las 16:00, con la volantera que acompaña
  await page.getByRole('button', { name: '＋ Tarde' }).click()
  await dlg.getByRole('combobox', { name: /^Persona/ }).selectOption({ label: 'Encargado Trinidad' })
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Calle' })
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Negociación' })
  const flyers = dlg.getByRole('group', { name: 'Volanteras que van' })
  await expect(flyers.getByRole('checkbox', { name: 'Encargado Trinidad' })).toHaveCount(0) // solo volanteras
  await flyers.getByRole('checkbox', { name: 'Volantera Trinidad' }).check()
  await dlg.getByRole('checkbox', { name: 'Negociaciones convenio' }).check() // 008: subcanal obligatorio
  await dlg.getByLabel('Hora inicio').fill('16:00')
  await dlg.getByLabel('Hora fin').fill('17:00')
  await dlg.getByRole('textbox', { name: /^Ubicación/ }).fill(placeA)
  await dlg.getByRole('spinbutton', { name: /^Meta de captación/ }).fill('5')
  await dlg.getByRole('textbox', { name: /^Observaciones/ }).fill('Convenio con la alcaldía')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Asignación agregada')).toBeVisible()
  const aCard = page.getByTestId('assignment-card').filter({ hasText: placeA })
  await expect(aCard).toContainText('Volanteras: Volantera Trinidad')
  await expect(aCard).toContainText('“Convenio con la alcaldía”')

  // 3) Orden por persona: el encargado (E…) va antes que la volantera (V…) aunque su horario sea más tarde
  const texts = await page.getByTestId('assignment-card').allInnerTexts()
  const iA = texts.findIndex((t) => t.includes(placeA))
  const iB = texts.findIndex((t) => t.includes(placeB))
  expect(iA).toBeGreaterThanOrEqual(0)
  expect(iA).toBeLessThan(iB)
  await expect(page.getByTestId('person-group-card').filter({ hasText: placeB })).toContainText('Volantera Trinidad')

  // 4) Editar: la observación y la volantera vienen cargadas
  await aCard.getByRole('button', { name: 'Editar' }).click()
  const edit = page.getByRole('dialog', { name: 'Editar asignación' })
  await expect(edit.getByRole('textbox', { name: /^Observaciones/ })).toHaveValue('Convenio con la alcaldía')
  await expect(edit.getByRole('group', { name: 'Volanteras que van' }).getByRole('checkbox', { name: 'Volantera Trinidad' })).toBeChecked()
  await edit.getByRole('textbox', { name: /^Observaciones/ }).fill('Convenio confirmado')
  await edit.getByRole('button', { name: 'Guardar' }).click()
  await expect(aCard).toContainText('“Convenio confirmado”')

  // 5) Excel: totales como números enteros y columnas nuevas (FR-001, SC-001)
  const filters = page.getByRole('region', { name: 'Filtros' })
  await filters.getByRole('combobox', { name: 'Canal', exact: true }).selectOption('Activación')
  await filters.getByRole('combobox', { name: 'Personal', exact: true }).selectOption('Volantera Trinidad')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Exportar Excel/ }).click()
  const file = await (await download).path()
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)
  const ws = wb.getWorksheet('ORGANIZACION')!
  for (const col of [1, 3, 5, 7, 9]) {
    expect(typeof ws.getCell(4, col).value).toBe('number')
    expect(ws.getCell(4, col).numFmt).toBe('#,##0')
  }
  const headers = (ws.getRow(6).values as unknown[]).filter((v): v is string => typeof v === 'string')
  expect(headers).toEqual(expect.arrayContaining(['Volanteras', 'Compartidas verificadas', 'Observaciones']))
  await filters.getByRole('button', { name: 'Quitar filtros' }).click()

  // Limpieza
  await aCard.getByRole('button', { name: 'Quitar asignación de Encargado Trinidad' }).click()
  await expect(aCard).toHaveCount(0)
  for (let i = 0; i < 2; i++) {
    await bCards.first().getByRole('button', { name: 'Quitar asignación de Volantera Trinidad' }).click()
    await expect(bCards).toHaveCount(1 - i)
  }
})

test('organización (007): copiar dos veces no duplica y el aviso dice cuál es la asignación igual', async ({ page }) => {
  // Un día lejano y al azar para no chocar con corridas anteriores (los datos de e2e no se borran).
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 100 + Math.floor(Math.random() * 3000))
  const day = d.toISOString().slice(0, 10)
  page.on('dialog', (x) => void x.accept()) // confirmación al copiar
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/planificacion')
  await page.getByLabel('Desde').fill(day)
  await page.getByLabel('Hasta').fill(day)

  await page.getByRole('button', { name: '＋ Mañana' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nueva asignación' })
  await dlg.getByRole('combobox', { name: /^Persona/ }).selectOption({ label: 'Volantera Trinidad' })
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Tienda' })
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Llamadas' })
  await dlg.getByRole('checkbox', { name: 'Llamadas a clientes de pedidos' }).check()
  await dlg.getByRole('spinbutton', { name: /^Meta de captación/ }).fill('12')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Asignación agregada')).toBeVisible()
  // Esperar a que cierre el formulario y se vea la asignación antes de copiar.
  await expect(dlg).toHaveCount(0)
  await expect(page.getByTestId('assignment-card')).toHaveCount(1)

  // Primera copia: copia 1 y pasa al día siguiente. Segunda copia desde el mismo día: no agrega nada (FR-001, FR-002).
  await page.getByRole('button', { name: 'Copiar al día siguiente' }).click()
  await expect(page.getByText('✓ 1 copiadas al día siguiente')).toBeVisible()
  await page.getByRole('button', { name: 'Día anterior', exact: true }).click()
  await page.getByRole('button', { name: 'Copiar al día siguiente' }).click()
  await expect(page.getByText('Ya estaban todas: no se copió nada (1)')).toBeVisible()
  await expect(page.getByTestId('assignment-card')).toHaveCount(1)

  // Cargar otra igual: el aviso nombra el subcanal y el horario (FR-008, FR-009)
  await page.getByRole('button', { name: '＋ Mañana' }).click()
  await dlg.getByRole('combobox', { name: /^Persona/ }).selectOption({ label: 'Volantera Trinidad' })
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Tienda' })
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Llamadas' })
  await dlg.getByRole('checkbox', { name: 'Llamadas a clientes de pedidos' }).check()
  await expect(dlg.getByTestId('clash-warning')).toContainText('Ya existe una asignación igual')
  await expect(dlg.getByTestId('clash-warning')).toContainText('Llamadas a clientes de pedidos (10:00–12:30)')
  await dlg.getByRole('button', { name: 'Cancelar' }).click()
})

test.describe('pantalla ancha', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false })

  test('organización (007): tabla compacta con la gerente arriba y la carga múltiple en una fila', async ({ page }) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() + 100 + Math.floor(Math.random() * 3000))
    const day = d.toISOString().slice(0, 10)
    page.on('dialog', (x) => void x.accept())
    await login(page, 'enc.trinidad')
    await expect(page).toHaveURL(/\/panel/)
    await page.goto('/planificacion')
    await page.getByLabel('Desde').fill(day)
    await page.getByLabel('Hasta').fill(day)

    // Carga de dos subcanales sin meta de compartidas (opcional desde la 007)
    await page.getByRole('button', { name: '＋ Mañana' }).click()
    const dlg = page.getByRole('dialog', { name: 'Nueva asignación' })
    await dlg.getByRole('combobox', { name: /^Persona/ }).selectOption({ label: 'Volantera Trinidad' })
    await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Tienda' })
    await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'RRSS-Mensajería' })
    await dlg.getByRole('checkbox', { name: 'Mensajería WhatsApp' }).check()
    await dlg.getByRole('checkbox', { name: 'Barrios chinos - grupos' }).check()
    await dlg.getByRole('group', { name: 'Metas de Mensajería WhatsApp' }).getByRole('spinbutton', { name: /^Meta de captación/ }).fill('10')
    await dlg.getByRole('group', { name: 'Metas de Barrios chinos - grupos' }).getByRole('spinbutton', { name: /^Meta de captación/ }).fill('5')
    await dlg.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('✓ 2 asignaciones agregadas')).toBeVisible()

    // Sucursal y gerente una sola vez arriba; sin columnas repetidas (FR-012, FR-013)
    await expect(page.getByTestId('scope-header')).toContainText('TRINIDAD')
    await expect(page.getByTestId('scope-header')).toContainText('Gerente: Jefe de Ventas Prueba')
    const table = page.getByRole('table')
    await expect(table.getByRole('columnheader')).toHaveText(['Horario', 'Canal › Subcanal', 'Lugar', 'Metas', 'Resultado', 'Observaciones', ''])
    // La carga de dos subcanales: el canal y el horario una vez; una fila por subcanal con su meta (FR-015)
    const first = table.getByTestId('assignment')
    await expect(first).toHaveCount(1)
    await expect(first).toHaveAttribute('data-count', '2')
    await expect(first).toContainText('RRSS-Mensajería ›')
    await expect(table.getByTestId('assignment-sub')).toHaveCount(1)
    await expect(table.getByRole('cell', { name: 'Mensajería WhatsApp', exact: true })).toHaveCount(1)
    await expect(table.getByRole('cell', { name: 'Barrios chinos - grupos', exact: true })).toHaveCount(1)
    await expect(table.getByRole('cell', { name: 'Capt 10', exact: true })).toHaveCount(1)
    await expect(table.getByRole('cell', { name: 'Capt 5', exact: true })).toHaveCount(1)
    await expect(table.getByRole('button', { name: 'Editar' })).toHaveCount(2)
    await expect(table.getByTestId('person-group')).toContainText('Volantera Trinidad · 2 asignaciones')
  })
})

test('organización (007): con varias sucursales hay que elegir dónde cargar antes de cargar o copiar', async ({ page }) => {
  await login(page, 'jefe.ventas')
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await page.goto('/planificacion')
  const target = page.getByRole('combobox', { name: 'Cargar en' })
  await expect(target).toHaveValue('')
  await expect(page.getByRole('button', { name: '＋ Mañana' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Copiar del día anterior' })).toBeDisabled()
  await target.selectOption({ label: 'Cargar en TRINIDAD' })
  await expect(page.getByRole('button', { name: '＋ Mañana' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Copiar del día anterior' })).toBeEnabled()
})

test('organización (008): subcanal único marcado solo; subcanal y horas obligatorios', async ({ page }) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 100 + Math.floor(Math.random() * 3000))
  const day = d.toISOString().slice(0, 10)
  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/planificacion')
  await page.getByLabel('Desde').fill(day)
  await page.getByLabel('Hasta').fill(day)

  await page.getByRole('button', { name: '＋ Tarde' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nueva asignación' })
  await dlg.getByRole('combobox', { name: /^Persona/ }).selectOption({ label: 'Volantera Trinidad' })
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Tienda' })

  // Canal de varios subcanales sin marcar ninguno: no guarda (FR-001)
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Llamadas' })
  await expect(dlg.getByRole('group', { name: 'Subcanales' })).toContainText('Subcanales * (uno o varios)')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(dlg.getByTestId('form-error')).toHaveText('Elige al menos un subcanal.')

  // Canal de un solo subcanal: queda marcado y propone su horario de la tarde (FR-002)
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Freelancers' })
  await expect(dlg.getByRole('checkbox', { name: 'Freelancers' })).toBeChecked()
  await expect(dlg.getByLabel('Hora inicio')).toHaveValue('16:00')
  await expect(dlg.getByLabel('Hora fin')).toHaveValue('16:20')

  // Sin hora de fin: no guarda y lleva a las horas (FR-003, FR-004)
  await dlg.getByRole('spinbutton', { name: /^Meta de captación/ }).fill('3')
  await dlg.getByLabel('Hora fin').fill('')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(dlg.getByTestId('form-error')).toHaveText('Escribe la hora de inicio y la de fin.')
  await expect(dlg.getByLabel('Hora inicio')).toBeFocused()
  await dlg.getByLabel('Hora fin').fill('16:20')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Asignación agregada')).toBeVisible()
  await expect(page.getByTestId('assignment-card').filter({ hasText: 'Freelancers' })).toContainText('16:00–16:20')
})
