import { expect, test, type Browser } from '@playwright/test'
import { fillCapture, login, randomPhone } from './helpers'

// Seguimientos accionable (specs/015-seguimientos-accionable): abre con «Este mes», asigna desde la lista,
// registra un contacto desde la fila y muestra el contexto del cliente. Sucursal Trinidad (no choca con monitoring).

async function capture(browser: Browser, name: string, phone: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await login(page, 'vol.trinidad')
  await fillCapture(page, name, phone)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/registrar$/)
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  await ctx.close()
}

test('Seguimientos: período por defecto, asignar, Seguimiento desde la fila y contexto', async ({ browser, page }) => {
  const tag = String(Date.now()).slice(-5)
  const a = `Accion Uno ${tag}`
  const b = `Accion Dos ${tag}`
  const c = `Accion Tres ${tag}`
  const phoneA = randomPhone()
  await capture(browser, a, phoneA)
  await capture(browser, b, randomPhone())
  await capture(browser, c, randomPhone())

  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)

  // US1: sin período en la URL abre con «Este mes»; «Hoy» queda explícito
  await page.goto('/gestion?ver=seguimiento')
  const periods = page.getByRole('group', { name: 'Período' })
  await expect(periods.getByRole('button', { name: 'Este mes', pressed: true })).toBeVisible()
  await expect(page.getByText('El período cuenta la fecha en que se registró el cliente.')).toBeVisible()

  // US4: contexto bajo el nombre (celular, quién registró con su cargo)
  await page.getByLabel('Buscar por nombre o celular').fill(tag)
  await expect(page.getByTestId('total')).toHaveText('3')
  const cardA = page.getByTestId('status-card').filter({ hasText: a })
  await expect(cardA).toContainText(phoneA)
  await expect(cardA).toContainText('(Volantero)')

  // US2: seleccionar y asignar desde Seguimientos
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  await page.getByLabel(`Seleccionar ${a}`).filter({ visible: true }).check()
  await page.getByLabel(`Seleccionar ${b}`).filter({ visible: true }).check()
  await expect(page.getByTestId('selected-count')).toHaveText('2 seleccionados')
  await expect(page.getByTestId('selected-owners')).toHaveText('2 sin responsable')
  await page.getByLabel('Asignar a').selectOption({ label: 'Encargado Trinidad (Encargado)' })
  await page.getByRole('button', { name: 'Asignar', exact: true }).click()
  await expect(page.getByText('✓ 2 asignados')).toBeVisible()
  // La lista se refresca sola con el responsable
  await expect(cardA).toContainText('Encargado Trinidad')
  await expect(page.getByTestId('status-card').filter({ hasText: b })).toContainText('Encargado Trinidad')

  // US3: «Seguimiento» en la fila sin responsable; quien registra queda responsable
  await page.getByRole('button', { name: `Seguimiento a ${c}` }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: /Busca un producto/ }).click()
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(/ver=seguimiento/)
  const cardC = page.getByTestId('status-card').filter({ hasText: c })
  await expect(cardC).toContainText('Encargado Trinidad')
  await expect(cardC).toContainText('1 contacto')

  // US1: elegir «Hoy» lo deja en la URL
  await periods.getByRole('button', { name: 'Hoy' }).click()
  await expect(page).toHaveURL(/periodo=hoy/)
  // La búsqueda (dato personal) nunca va a la URL
  expect(page.url()).not.toContain(tag)
})
