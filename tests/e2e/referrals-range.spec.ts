import { expect, test, type Page } from '@playwright/test'
import { fillCapture, login, logoutFromManage, randomPhone } from './helpers'

// Spec 014: referidos por período y sucursales, contactos, quién registra, unir referidores y filtro en Captaciones.
// Los referidores de prueba empiezan con "E2E " (los borra `pnpm db:clean`).

const cells = (page: Page, name: string) => page.getByTestId(`referrer-row-${name}`).locator('td')

async function captureReferred(page: Page, client: string, referrer: string, isNew: boolean): Promise<void> {
  await fillCapture(page, client, randomPhone())
  await page.getByRole('checkbox', { name: 'Es referido' }).check()
  await page.getByLabel(/Quién lo recomendó/).fill(referrer)
  if (isNew) {
    await page.getByRole('button', { name: `＋ Agregar «${referrer}»` }).click()
    await page.getByRole('group', { name: /Quién es/ }).getByRole('button', { name: 'Cliente' }).click()
  } else {
    await page.getByRole('group', { name: 'Sugerencias de referidores' }).getByRole('button', { name: referrer }).click()
  }
  await expect(page.getByTestId('referrer-chosen')).toContainText(referrer)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/registrar$/)
}

test('referidos 014: rango, sucursales, contactos, quién registra, unir y Captaciones', async ({ page }) => {
  const tag = String(Date.now()).slice(-6)
  const main = `E2E Contacto Rosa ${tag}`
  const dup = `E2E Rosa ${tag}`
  const c1 = `Rango Uno ${tag}`
  const c2 = `Rango Dos ${tag}`

  // 1) La jefa crea el referidor «oficial»; la auxiliar registra uno con él y otro escribiendo una variante
  await login(page, 'jefe.ventas')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/referidos?seccion=referidores')
  const form = page.getByRole('group', { name: 'Agregar referidor' })
  await form.getByLabel('Nuevo referidor').fill(main)
  await form.getByRole('button', { name: 'Agregar' }).click()
  await expect(page.getByTestId(`referrer-edit-${main}`)).toBeVisible()
  await logoutFromManage(page)

  await login(page, 'aux.verdolago')
  await captureReferred(page, c1, main, false)
  await captureReferred(page, c2, dup, true)
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  await logoutFromManage(page)

  // 2) Reporte del mes (por defecto) con tarjetas; los filtros quedan en la URL
  await login(page, 'jefe.ventas')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/referidos')
  await expect(cells(page, main).nth(1)).toHaveText('1')
  await expect(cells(page, dup).nth(1)).toHaveText('1')
  await expect(page.getByTestId('referral-kpis')).toBeVisible()

  // Rango de un día que no es hoy: nada, con el mensaje que lleva a «Quién registra»
  await page.getByRole('group', { name: 'Período' }).getByRole('button', { name: 'Rango' }).click()
  await page.getByLabel('Desde').fill('2026-01-05')
  await page.getByLabel('Hasta').fill('2026-01-06')
  await expect(page).toHaveURL(/periodo=rango/)
  await expect(page.getByTestId('referrals-empty')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Desde')).toHaveValue('2026-01-05')
  await page.getByRole('group', { name: 'Período' }).getByRole('button', { name: 'Hoy' }).click()
  await expect(cells(page, main).nth(1)).toHaveText('1')

  // Ordenar por llegados y filtrar por tipo
  await page.getByRole('button', { name: 'Llegados' }).click()
  await expect(page).toHaveURL(/orden=arrived/)
  await page.getByLabel('Tipo de referidor').selectOption({ label: 'Freelance' })
  await expect(page.getByTestId(`referrer-row-${main}`)).toHaveCount(0)
  await page.getByLabel('Tipo de referidor').selectOption({ label: 'Todos' })

  // 3) Todas mis sucursales → tabla por sucursal → bajar a Verdolago y volver
  await page.getByRole('combobox', { name: 'Sucursal' }).selectOption({ label: 'Todas mis sucursales' })
  await expect(page.getByRole('table', { name: 'Referidos por sucursal' })).toBeVisible()
  await expect(page.getByTestId('branch-row-TRINIDAD')).toBeVisible()
  await page.getByRole('button', { name: 'VERDOLAGO →' }).click()
  await expect(page.getByTestId('branch-drill')).toContainText('VERDOLAGO')
  await page.getByRole('button', { name: 'Todas las sucursales' }).click()
  await expect(page.getByRole('table', { name: 'Referidos por sucursal' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Sucursal' }).selectOption({ label: 'VERDOLAGO' })

  // 4) Contactos: filtro por referidor en el título
  await page.getByRole('tab', { name: 'Contactos' }).click()
  await expect(page.getByTestId(`contact-row-${c1}`)).toBeVisible()
  await expect(page.getByTestId(`contact-row-${c2}`)).toBeVisible()
  await page.getByRole('button', { name: /^Referidor/ }).click()
  await page.getByRole('button', { name: dup, exact: true }).click()
  await expect(page.getByTestId(`contact-row-${c1}`)).toHaveCount(0)
  await expect(page.getByTestId(`contact-row-${c2}`)).toBeVisible()

  // 5) Quién registra: la auxiliar marcó al menos 2 referidos hoy
  await page.getByRole('tab', { name: 'Quién registra' }).click()
  await expect(page.getByRole('table', { name: 'Quién registra referidos' })).toBeVisible()
  await expect(page.locator('[data-testid^="registrar-row-"]').first()).toBeVisible()

  // 6) Unir la variante con el oficial: el reporte los suma y la variante queda en «Unidos»
  await page.getByRole('tab', { name: 'Referidores y metas' }).click()
  await page.getByRole('searchbox', { name: 'Buscar referidor' }).fill(`Rosa ${tag}`)
  await page.getByTestId(`referrer-edit-${dup}`).getByRole('button', { name: 'Unir con…' }).click()
  const dialog = page.getByRole('dialog', { name: `Unir «${dup}» con…` })
  await dialog.getByLabel('Unir con').selectOption({ label: main })
  await expect(dialog.getByTestId('merge-summary')).toContainText(main)
  await dialog.getByRole('button', { name: 'Unir', exact: true }).click()
  await expect(page.getByTestId(`referrer-edit-${dup}`)).toHaveCount(0)
  await page.getByRole('button', { name: /^Unidos/ }).click()
  await expect(page.getByTestId(`referrer-merged-${dup}`)).toContainText(main)
  await page.getByRole('tab', { name: 'Reporte' }).click()
  await expect(cells(page, main).nth(1)).toHaveText('2')

  // 7) Captaciones: «Referido por» en la columna y en el filtro
  await page.goto('/gestion?periodo=hoy&sucursal=5')
  await page.getByRole('combobox', { name: 'Referido por' }).selectOption({ label: main })
  await expect(page).toHaveURL(/origen=referidos/)
  // En el celular se ven tarjetas con «Referido · …»
  await expect(page.getByText(`Referido · ${main}`)).toHaveCount(2)
  await expect(page.getByRole('link', { name: c1 }).filter({ visible: true })).toHaveCount(1)
  await expect(page.getByRole('link', { name: c2 }).filter({ visible: true })).toHaveCount(1)
})
