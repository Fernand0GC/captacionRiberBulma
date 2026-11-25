import { expect, test, type Locator, type Page } from '@playwright/test'
import { login } from './helpers'

// Spec 023: recontacto visible para jefas. Los datos locales cambian con cada corrida: se prueban las reglas que
// siempre valen (columnas que suman, aviso de «solo hoy», URL del selector), no números fijos.

const num = async (cell: Locator) => Number((await cell.innerText()).trim())

async function openManage(page: Page, view: 'Del día' | 'Actividad' | 'Seguimientos') {
  await login(page, 'enc.verdolago')
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await page.goto('/gestion')
  await page.getByRole('button', { name: view, exact: true }).click()
}

test.describe('pantalla ancha', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false })

  test('US1: agenda de recontacto en «Del día»', async ({ page }) => {
    await openManage(page, 'Del día')
    const agenda = page.getByTestId('agenda')
    await expect(agenda.getByRole('heading', { name: 'Agenda de recontacto' })).toBeVisible()

    // El personal fijo de la sucursal aparece siempre (aunque esté en cero).
    await expect(agenda.getByTestId('agenda-row').first()).toBeVisible()
    const rows = await agenda.getByTestId('agenda-row').count()
    expect(rows).toBeGreaterThan(0)

    // Total: Le tocaba hoy = Contactó + Pendientes.
    const total = agenda.getByTestId('agenda-total').locator('td')
    // Spec 028: 0 Asignados hoy · 1 Rellamadas · 2 Le tocaba hoy · 3 Contactó · 4 Pendientes.
    expect(await num(total.nth(2))).toBe((await num(total.nth(3))) + (await num(total.nth(4))))

    // Detalle de una persona: tres pestañas con sus números.
    await agenda.getByTestId('agenda-row').first().getByRole('button').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('tab', { name: /^Pendientes/ })).toBeVisible()
    await expect(dialog.getByRole('tab', { name: /^Contactados hoy/ })).toBeVisible()
    await expect(dialog.getByRole('tab', { name: /^Atrasados/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    // Otro día: solo para hoy, con botón para volver.
    await page.getByRole('button', { name: 'Día anterior' }).click()
    await expect(agenda.getByTestId('agenda-only-today')).toContainText('solo está disponible para hoy')
    await agenda.getByRole('button', { name: 'Ir a hoy' }).click()
    await expect(page).not.toHaveURL(/dia=/)
    await expect(agenda.getByTestId('agenda-row').first()).toBeVisible()
  })

  test('US2: primer contacto y recontacto en Actividad suman el total', async ({ page }) => {
    await openManage(page, 'Actividad')
    // Con una sola sucursal la vista abre por persona.
    const table = page.getByRole('table', { name: 'Actividad por persona' })
    await expect(table).toBeVisible()
    const headers = table.locator('thead th')
    await expect(headers.filter({ hasText: '1.er contacto' })).toHaveCount(1)
    await expect(headers.filter({ hasText: 'Recontactos' })).toHaveCount(1)

    // Fila Total: las últimas tres celdas son Total, 1.er contacto y Recontactos.
    const cells = page.getByTestId('activity-total').locator('td')
    const n = await cells.count()
    const [tot, first, re] = [await num(cells.nth(n - 3)), await num(cells.nth(n - 2)), await num(cells.nth(n - 1))]
    expect(first + re).toBe(tot)
  })

  test('US3: «Contar por» en Seguimientos', async ({ page }) => {
    await openManage(page, 'Seguimientos')
    await expect(page.getByText('El período cuenta la fecha en que se registró el cliente.')).toBeVisible()

    await page.getByRole('combobox', { name: 'Contar por' }).selectOption('proximo')
    await expect(page).toHaveURL(/contar=proximo/)
    await expect(page.getByText('El período cuenta la fecha agendada para el próximo contacto.')).toBeVisible()
    await expect(page.getByTestId('total')).not.toHaveText('')

    await page.getByRole('combobox', { name: 'Contar por' }).selectOption('ultimo')
    await expect(page).toHaveURL(/contar=ultimo/)
    await expect(page.getByText(/con último contacto/)).toBeVisible()

    // Volver a Registro quita el parámetro.
    await page.getByRole('combobox', { name: 'Contar por' }).selectOption('')
    await expect(page).not.toHaveURL(/contar=/)
  })
})
