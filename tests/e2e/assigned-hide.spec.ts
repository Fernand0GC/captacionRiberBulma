import { expect, test, type Browser, type Locator, type Page } from '@playwright/test'
import { fillCapture, login, randomPhone } from './helpers'

// Spec 021: depurar «Clientes asignados» (ocultar contactados, «Ver ocultos», ocultar por fila, «Mantener»).
// La base local tiene otros datos: las comprobaciones filtran por el tag del test y, como el «Ocultar» del aviso
// oculta todos los contactados del día de la auxiliar, al final se vuelven a mostrar solo los que ocultó este test.

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

const AUX = 'Auxiliar Verdolago'

async function openAssigned(page: Page): Promise<Locator> {
  await page.goto('/gestion?ver=actividad')
  const auxRow = page.getByTestId('activity-row').filter({ hasText: AUX })
  await auxRow.getByRole('button', { name: new RegExp(`^Clientes asignados de ${AUX}: \\d+$`) }).click()
  const det = page.getByRole('dialog', { name: new RegExp(`${AUX} · Clientes asignados`) })
  await expect(det.getByTestId('assigned-row').first()).toBeVisible()
  return det
}

async function closeDialog(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

/** Nombres de las filas marcadas «Oculto» (enciende «Ver ocultos» si hace falta y lo deja como estaba). */
async function hiddenNames(det: Locator): Promise<string[]> {
  const sw = det.getByRole('switch', { name: 'Ver ocultos' })
  if ((await sw.count()) === 0) return []
  const wasOn = (await sw.getAttribute('aria-checked')) === 'true'
  if (!wasOn) await sw.click()
  const names = await det
    .getByTestId('assigned-row')
    // `has` se busca dentro de cada fila: va desde la página, no encadenado al diálogo.
    .filter({ has: det.page().getByTestId('hidden-badge') })
    .getByTestId('assigned-name')
    .allInnerTexts()
  if (!wasOn) await sw.click()
  return names
}

test('021 clientes asignados: ocultar contactados, ver ocultos, mostrar, ocultar por fila y mantener', async ({ browser }) => {
  const tag = String(Date.now()).slice(-5)
  const a = `Oculto ${tag} Uno` // la auxiliar lo contacta
  const b = `Oculto ${tag} Dos` // sin contactar
  await capture(browser, a)
  await capture(browser, b)

  // El encargado asigna los dos a la auxiliar
  const enc = await newPage(browser, 'enc.verdolago')
  await enc.goto('/gestion')
  await enc.getByLabel('Buscar por nombre o celular').fill(`oculto ${tag}`)
  await expect(enc.getByTestId('total')).toHaveText('2')
  await enc.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  for (const n of [a, b]) await enc.getByLabel(`Seleccionar ${n}`).filter({ visible: true }).check()
  await enc.getByLabel('Asignar a').selectOption({ label: `${AUX} (Auxiliar)` })
  await enc.getByRole('button', { name: 'Asignar', exact: true }).click()
  await expect(enc.getByText('✓ 2 asignadas')).toBeVisible()

  // La auxiliar contacta a A (no contestó)
  const aux = await newPage(browser, 'aux.verdolago')
  await expect(aux).toHaveURL(/\/seguimiento$/)
  await aux.getByTestId('contact-card').filter({ hasText: a }).getByRole('button', { name: 'Registrar contacto' }).click()
  await aux.getByRole('radio', { name: /No contestó/ }).click()
  await aux.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(aux.getByText(/No contestó \(1\/3\)/)).toBeVisible()

  // Números de Actividad antes de ocultar
  await enc.goto('/gestion?ver=actividad')
  const auxRow = enc.getByTestId('activity-row').filter({ hasText: AUX })
  await expect(auxRow).toBeVisible()
  const before = await auxRow.textContent()

  let det = await openAssigned(enc)
  const preHidden = await hiddenNames(det)
  // Guarda contra una limpieza que no detecta ocultos: al final debe haber al menos uno para mostrar.
  let cleaned = 0
  const rows = det.getByTestId('assigned-row')
  const search = det.getByLabel('Buscar por nombre o celular')

  // 1) Aviso → «Ocultar»: A (contactado) sale; B (sin contactar) queda
  const notice = det.getByRole('alert').filter({ hasText: /ya fue(ron)? contactad/ })
  await expect(notice).toBeVisible()
  await notice.getByRole('button', { name: 'Ocultar', exact: true }).click()
  await expect(enc.getByText(/✓ \d+ ocultos?/)).toBeVisible()
  await expect(notice).toHaveCount(0)
  await search.fill(`oculto ${tag}`)
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(b)
  await expect(det.getByTestId('hidden-count')).toBeVisible()

  // 2) «Ver ocultos» → A marcado «Oculto» → «Mostrar»
  const sw = det.getByRole('switch', { name: 'Ver ocultos' })
  await sw.click()
  await expect(rows).toHaveCount(2)
  await expect(rows.filter({ hasText: a }).getByTestId('hidden-badge')).toBeVisible()
  await det.getByRole('button', { name: `Mostrar ${a}` }).click()
  await expect(enc.getByText('✓ Visible de nuevo')).toBeVisible()
  await expect(rows.filter({ hasText: a }).getByTestId('hidden-badge')).toHaveCount(0)
  await sw.click()
  await expect(rows).toHaveCount(2)

  // 3) Ocultar a mano un sin contactar (B) desde su fila
  await det.getByRole('button', { name: `Ocultar ${b}` }).click()
  await expect(enc.getByText('✓ Oculto', { exact: true })).toBeVisible()
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(a)
  expect(await enc.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await closeDialog(enc)

  // Los números de Actividad no cambiaron (se recarga para leerlos de nuevo del servidor)
  await enc.reload()
  await expect(auxRow).toBeVisible()
  expect(await auxRow.textContent()).toBe(before)

  // 4) Reabrir: A sigue contactado y visible → aviso → «Mantener»; al reabrir hoy no vuelve a preguntar
  det = await openAssigned(enc)
  await expect(det.getByRole('alert').filter({ hasText: /ya fue(ron)? contactad/ })).toBeVisible()
  await det.getByRole('button', { name: 'Mantener', exact: true }).click()
  await expect(det.getByRole('alert').filter({ hasText: /ya fue(ron)? contactad/ })).toHaveCount(0)
  await closeDialog(enc)
  det = await openAssigned(enc)
  await expect(det.getByRole('alert').filter({ hasText: /ya fue(ron)? contactad/ })).toHaveCount(0)

  // 5) La auxiliar sigue viendo a B (oculto) en Mis contactos
  await aux.reload()
  await expect(aux.getByTestId('contact-card').filter({ hasText: b })).toBeVisible()
  await aux.context().close()

  // Limpieza: volver a mostrar solo lo que ocultó este test
  const toShow = (await hiddenNames(det)).filter((n) => !preHidden.includes(n))
  if (toShow.length) {
    await det.getByRole('switch', { name: 'Ver ocultos' }).click()
    for (const n of toShow) {
      await det.getByRole('button', { name: `Mostrar ${n}` }).click()
      await expect(det.getByRole('button', { name: `Mostrar ${n}` })).toHaveCount(0)
      cleaned++
    }
  }
  expect(cleaned).toBeGreaterThanOrEqual(1) // al menos B, que ocultó este test
  expect(await hiddenNames(det)).toEqual(preHidden)
  await enc.context().close()
})
