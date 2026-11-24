import { expect, test, type Browser, type Locator, type Page } from '@playwright/test'
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

async function capture(browser: Browser, name: string, phone = randomPhone()) {
  const page = await newPage(browser, 'enc.verdolago')
  await page.goto('/registrar')
  await fillCapture(page, name, phone)
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

// Spec 020: lupa y reasignación de los sin contactar en «Clientes asignados». Filtra por sus propios nombres (tag):
// la base local puede tener otros asignados de hoy en Verdolago.
test('020 clientes asignados: buscar por nombre o celular y reasignar los sin contactar', async ({ browser }) => {
  const tag = String(Date.now()).slice(-5)
  const a = `Reasignar Uno ${tag}`
  const b = `Reasignar Dos ${tag}`
  const c = `Reasignar Tres ${tag}`
  const phoneA = randomPhone()
  await capture(browser, a, phoneA)
  await capture(browser, b)
  await capture(browser, c)

  // El encargado asigna los tres a la auxiliar
  const enc = await newPage(browser, 'enc.verdolago')
  await enc.goto('/gestion')
  await enc.getByLabel('Buscar por nombre o celular').fill(tag)
  await expect(enc.getByTestId('total')).toHaveText('3')
  await enc.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  for (const n of [a, b, c]) await enc.getByLabel(`Seleccionar ${n}`).filter({ visible: true }).check()
  await enc.getByLabel('Asignar a').selectOption({ label: 'Auxiliar Verdolago (Auxiliar)' })
  await enc.getByRole('button', { name: 'Asignar', exact: true }).click()
  await expect(enc.getByText('✓ 3 asignadas')).toBeVisible()

  // La auxiliar contacta a C (no contestó): C ya no se puede reasignar desde el modal
  const aux = await newPage(browser, 'aux.verdolago')
  await expect(aux).toHaveURL(/\/seguimiento$/)
  await aux.getByTestId('contact-card').filter({ hasText: c }).getByRole('button', { name: 'Registrar contacto' }).click()
  await aux.getByRole('radio', { name: /No contestó/ }).click()
  await aux.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(aux.getByText(/No contestó \(1\/3\)/)).toBeVisible()
  await aux.context().close()

  // Actividad → Auxiliar → «Clientes asignados»
  await enc.goto('/gestion?ver=actividad')
  const auxRow = enc.getByTestId('activity-row').filter({ hasText: 'Auxiliar Verdolago' })
  await auxRow.getByRole('button', { name: /^Clientes asignados de Auxiliar Verdolago: \d+$/ }).click()
  const det = enc.getByRole('dialog', { name: /Auxiliar Verdolago · Clientes asignados/ })
  const rows = det.getByTestId('assigned-row')
  const search = det.getByLabel('Buscar por nombre o celular')

  // Lupa: por nombre (los tres) y por celular (solo A, con el celular visible en la fila).
  // El tag solo son dígitos: sin la palabra se buscaría como celular.
  await search.fill(`reasignar ${tag}`)
  await expect(rows).toHaveCount(3)
  await search.fill(phoneA)
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(a)
  await expect(rows.first().getByTestId('assigned-phone')).toContainText(phoneA)
  await search.fill(`zzz ${tag}`)
  await expect(rows).toHaveCount(0)
  await expect(det.getByText('Ningún cliente con este filtro.')).toBeVisible()
  await search.fill(`reasignar ${tag}`)
  await expect(rows).toHaveCount(3)

  // 024: números antes de reasignar (la base local puede tener otros asignados de hoy: se comparan diferencias)
  const kpi = (id: string) => det.getByTestId(id)
  const num = async (l: Locator) => Number((await l.innerText()).match(/\d+/)?.[0] ?? 0)
  const note = det.getByTestId('reassigned-note')
  const assignedBefore = await num(kpi('kpi-assigned'))
  const pendingBefore = await num(kpi('kpi-pending'))
  const noteBefore = (await note.count()) ? await num(note) : 0

  // Seleccionar: solo los sin contactar que siguen a su cargo tienen casilla
  await det.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  await expect(det.getByLabel(`Seleccionar ${c}`)).toHaveCount(0)
  await det.getByLabel(`Seleccionar ${a}`).check()
  await det.getByLabel(`Seleccionar ${b}`).check()
  // A y B son todos los reasignables de la búsqueda (C ya fue contactado): la barra dice «Los 2 del filtro».
  await expect(det.getByTestId('selected-count')).toHaveText('Los 2 del filtro')
  await det.getByLabel('Asignar a').selectOption({ label: 'Supervisor Verdolago (Supervisor)' })
  await det.getByRole('button', { name: 'Reasignar', exact: true }).click()
  await enc.getByRole('dialog', { name: '¿Reasignar?' }).getByRole('button', { name: 'Reasignar 2' }).click()
  await expect(enc.getByText('✓ 2 reasignados')).toBeVisible()

  // 024: A y B nunca fueron contactados por la auxiliar → dejan de contarle y salen de la lista; C sigue
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(c)
  await expect(kpi('kpi-assigned')).toHaveText(String(assignedBefore - 2))
  await expect(kpi('kpi-pending')).toHaveText(String(pendingBefore - 2))
  await expect(note).toContainText(`${noteBefore + 2} reasignados sin contactar`)

  // La nota gris muestra a A y B «Reasignado a Supervisor» (no suman a las tarjetas)
  await note.click()
  await expect(rows.filter({ hasText: a })).toContainText('Reasignado a Supervisor Verdolago')
  await expect(rows.filter({ hasText: b })).toContainText('Reasignado a Supervisor Verdolago')
  await expect(rows.filter({ hasText: c })).toHaveCount(0)
  await expect(kpi('kpi-assigned')).toHaveText(String(assignedBefore - 2))
  expect(await enc.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

  // La tabla Actividad dice lo mismo que el modal
  await enc.keyboard.press('Escape')
  await enc.reload()
  await expect(auxRow.getByRole('button', { name: `Clientes asignados de Auxiliar Verdolago: ${assignedBefore - 2}` })).toBeVisible()
  await enc.context().close()
})
