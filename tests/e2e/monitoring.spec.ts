import { expect, test, type Browser, type Page } from '@playwright/test'
import { fillCapture, login, randomPhone } from './helpers'

// Monitoreo (specs/002-monitoreo-seguimiento): Seguimientos, Actividad, detalle, ficha y Excel.
// Las pruebas corren en paralelo sobre la misma base: no se comparan números exactos de la sucursal, solo
// lo que esta prueba agrega (clientes con nombre propio) y las invariantes (pestañas = Todos, Total = suma).

async function newPage(browser: Browser, user: string): Promise<Page> {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await login(page, user)
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  return page
}

async function capture(browser: Browser, name: string) {
  const page = await newPage(browser, 'enc.verdolago')
  await page.goto('/registrar')
  await fillCapture(page, name, randomPhone())
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  await page.context().close()
}

const num = async (page: Page, testId: string) => Number(await page.getByTestId(testId).innerText())

test('monitoreo: seguimientos, actividad por persona, detalle, ficha y Excel', async ({ browser }) => {
  const tag = String(Date.now()).slice(-5)
  const a = `Monitoreo Uno ${tag}`
  const b = `Monitoreo Dos ${tag}`
  await capture(browser, a)
  await capture(browser, b)

  // Encargado asigna ambos al supervisor
  const enc = await newPage(browser, 'enc.verdolago')
  await enc.goto('/gestion')
  // Esperar a que la búsqueda se aplique: si cambia el filtro después de marcar, la selección se limpia.
  await enc.getByLabel('Buscar por nombre o celular').fill(tag)
  await expect(enc.getByTestId('total')).toHaveText('2')
  await enc.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  await enc.getByLabel(`Seleccionar ${a}`).filter({ visible: true }).check()
  await enc.getByLabel(`Seleccionar ${b}`).filter({ visible: true }).check()
  await enc.getByLabel('Asignar a').selectOption({ label: 'Supervisor Verdolago (Supervisor)' })
  await enc.getByRole('button', { name: 'Asignar', exact: true }).click()
  await expect(enc.getByText('✓ 2 asignadas')).toBeVisible()

  // Supervisor: A por mensaje "Visitará la tienda" con observación; B no contestó
  const sup = await newPage(browser, 'sup.verdolago')
  await expect(sup).toHaveURL(/\/seguimiento$/)
  const cardA = sup.getByTestId('contact-card').filter({ hasText: a })
  await cardA.getByRole('button', { name: 'Registrar contacto' }).click()
  await sup.getByRole('radio', { name: 'Mensaje' }).click()
  await sup.getByRole('radio', { name: 'Visitará la tienda' }).click()
  await sup.getByLabel('Observación').fill(`Viene el sábado ${tag}`)
  await sup.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(sup.getByText('✓ Visitará la tienda → Seguimiento')).toBeVisible()
  const cardB = sup.getByTestId('contact-card').filter({ hasText: b })
  await cardB.getByRole('button', { name: 'Registrar contacto' }).click()
  await sup.getByRole('radio', { name: /No contestó/ }).click()
  await sup.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(sup.getByText('No contestó (1/3). Vuelve mañana.')).toBeVisible()
  await sup.context().close()

  // --- US1 Seguimientos ---
  await enc.goto('/gestion?ver=seguimiento')
  await expect(enc.getByRole('button', { name: 'Seguimientos', pressed: true })).toBeVisible()
  // Pestañas: la suma de los estados da "Todos"
  const tabs = enc.getByRole('tablist', { name: 'Estado del cliente' }).getByRole('tab')
  await expect(tabs.first()).not.toContainText('…')
  const counts = (await tabs.allInnerTexts()).map((t) => Number(t.match(/(\d+)\s*$/)?.[1] ?? NaN))
  expect(counts.slice(1).reduce((s, n) => s + n, 0)).toBe(counts[0])
  // Celular: tarjetas; la observación del último contacto; sin scroll horizontal de la página
  await enc.getByLabel('Buscar por nombre o celular').fill(a)
  const card = enc.getByTestId('status-card').filter({ hasText: a })
  await expect(card).toContainText(`Viene el sábado ${tag}`)
  await expect(card).toContainText('1 contacto')
  expect(await enc.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  // B: pestaña Seguimiento / Recaptación, con su "no contestó"
  await enc.getByLabel('Buscar por nombre o celular').fill(b)
  await enc.getByRole('tab', { name: /^Seguimiento \/ Recaptación/ }).click()
  await expect(enc).toHaveURL(/estado=seguimiento/)
  await expect(enc.getByTestId('status-card').filter({ hasText: b })).toContainText('No contestó 1/3')
  // Solo vencidos queda en la URL; la búsqueda no
  await enc.getByRole('button', { name: 'Solo vencidos' }).click()
  await expect(enc).toHaveURL(/vencidos=true/)
  expect(enc.url()).not.toContain('Monitoreo')
  // Excel de Seguimientos
  await enc.getByRole('button', { name: 'Solo vencidos' }).click()
  await enc.getByRole('tab', { name: /^Todos/ }).click()
  await enc.getByLabel('Buscar por nombre o celular').fill(a)
  await expect(enc.getByTestId('total')).toHaveText('1')
  const dl1 = enc.waitForEvent('download')
  await enc.getByRole('button', { name: 'Exportar Excel' }).click()
  expect((await dl1).suggestedFilename()).toMatch(/^Seguimientos_.+\.xlsx$/)

  // --- US2 Actividad ---
  await enc.getByRole('button', { name: 'Actividad', exact: true }).click()
  await expect(enc).toHaveURL(/ver=actividad/)
  const supRow = enc.getByTestId('activity-row').filter({ hasText: 'Supervisor Verdolago' })
  await expect(supRow).toBeVisible()
  const visits = supRow.getByRole('button', { name: /^Visitas pactadas de Supervisor Verdolago: \d+$/ })
  await expect(visits).toBeVisible()
  await expect(supRow.getByRole('button', { name: /^No contestó de Supervisor Verdolago: \d+$/ })).toBeVisible()
  // Total = suma de las filas (columna Total; la 10.ª desde que está «Asignados», spec 012)
  const totalCol = await enc.getByTestId('activity-row').evaluateAll((rows) =>
    rows.reduce((s, r) => s + Number(r.querySelectorAll('td')[9]?.textContent ?? 0), 0),
  )
  const footer = Number(await enc.getByTestId('activity-total').locator('td').nth(9).innerText())
  expect(footer).toBe(totalCol)
  expect(await num(enc, 'total')).toBe(footer)
  // Ordenar por Ventas lo deja en la URL
  await enc.getByRole('columnheader', { name: /^Ventas/ }).getByRole('button').click()
  await expect(enc).toHaveURL(/orden=sales/)
  const dl2 = enc.waitForEvent('download')
  await enc.getByRole('button', { name: 'Exportar Excel' }).click()
  expect((await dl2).suggestedFilename()).toMatch(/^Actividad_.+\.xlsx$/)

  // --- US3 Detalle ---
  const n = Number((await visits.innerText()).trim())
  await visits.click()
  const dialog = enc.getByRole('dialog', { name: /Supervisor Verdolago · Visitas pactadas/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('list', { name: 'Contactos' }).getByRole('listitem')).toHaveCount(Math.min(n, 50))
  await dialog.getByRole('link', { name: new RegExp(a) }).click()
  await expect(enc).toHaveURL(/\/cliente\//)

  // --- US4 Ficha: contactos por persona ---
  const byPerson = enc.getByRole('region', { name: 'Contactos por persona' })
  await expect(byPerson.getByTestId('contacts-by-person').filter({ hasText: 'Supervisor Verdolago' })).toContainText('1 mensaje')

  // Atrás: vuelve a Actividad con el detalle abierto y el orden
  await enc.goBack()
  await expect(enc).toHaveURL(/ver=actividad.*persona=|persona=.*ver=actividad/)
  await expect(enc).toHaveURL(/orden=sales/)
  await expect(enc.getByRole('dialog', { name: /Supervisor Verdolago · Visitas pactadas/ })).toBeVisible()
  await enc.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()
  await expect(enc).not.toHaveURL(/persona=/)

  // --- 012 Asignados del día: A y B se los asignó el encargado; A pasó a Seguimiento y B a Recaptación ---
  await expect(supRow.getByText(/contactados · \d+%/)).toBeVisible()
  await supRow.getByRole('button', { name: /^Clientes asignados de Supervisor Verdolago: \d+$/ }).click()
  await expect(enc).toHaveURL(/metrica=assigned/)
  const det = enc.getByRole('dialog')
  await expect(det.getByRole('tab', { name: /^Asignados del día/ })).toHaveAttribute('aria-selected', 'true')
  const rowA = det.getByTestId('assigned-row').filter({ hasText: a })
  const rowB = det.getByTestId('assigned-row').filter({ hasText: b })
  await expect(rowA).toContainText('Asignó Encargado Verdolago')
  await expect(rowA).toContainText('Captación')
  await expect(rowA).toContainText('Seguimiento')
  await expect(rowA).toContainText(`Viene el sábado ${tag}`)
  await expect(rowB).toContainText('Recaptación')
  await expect(det.getByRole('region', { name: 'De dónde vienen' }).getByRole('button', { name: /^Captación/ })).toBeEnabled()
  // Filtro «A qué proceso pasaron»: solo los que pasaron a Recaptación
  await det.getByRole('button', { name: /^Recaptación \(no contestó\)/ }).click()
  await expect(rowA).toHaveCount(0)
  await expect(rowB).toHaveCount(1)
  // Excel de la lista
  const dl3 = enc.waitForEvent('download')
  await det.getByRole('button', { name: 'Descargar Excel' }).click()
  expect((await dl3).suggestedFilename()).toMatch(/^Asignados_.+\.xlsx$/)
  // Pestaña de contactos: los dos son «Asignado hoy»
  await det.getByRole('tab', { name: /^Todos los contactos/ }).click()
  await expect(enc).toHaveURL(/metrica=all/)
  const items = det.getByRole('list', { name: 'Contactos' }).getByRole('listitem')
  await expect(items.filter({ hasText: a })).toContainText('Asignado hoy')
  await expect(items.filter({ hasText: b })).toContainText('Asignado hoy')
  await expect(det.getByTestId('contacts-split')).toContainText('Cartera')
  // Ancha y sin scroll horizontal en el celular
  expect(await enc.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await det.getByRole('button', { name: 'Cerrar' }).click()
  await expect(enc).not.toHaveURL(/persona=/)
})

test('monitoreo: el encargado no ve otra sucursal y la auxiliar no entra', async ({ browser }) => {
  const enc = await newPage(browser, 'enc.verdolago')
  await enc.goto('/gestion?ver=seguimiento&sucursal=7')
  // El encargado no tiene selector: la sucursal de la URL se ignora y la consulta sigue en la suya.
  await expect(enc.getByText('No se pudo cargar')).toHaveCount(0)
  await expect(enc.getByLabel('Sucursal')).toHaveCount(0)
  await enc.context().close()

  const aux = await newPage(browser, 'aux.verdolago')
  await aux.goto('/gestion?ver=actividad')
  await expect(aux.getByRole('table', { name: 'Actividad por persona' })).toHaveCount(0)
  await aux.context().close()
})
