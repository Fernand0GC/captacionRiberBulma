import { expect, test, type Browser } from '@playwright/test'
import { fillCapture, login, logoutFromManage, randomPhone } from './helpers'

// Capta el encargado (también registra): las pruebas corren en paralelo y cada una usa sus propios usuarios.
async function capture(browser: Browser, name: string, phone = randomPhone()) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await login(page, 'enc.verdolago')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/registrar')
  await fillCapture(page, name, phone)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  await ctx.close()
}

test('embudo: el encargado asigna; la auxiliar recaptura, hace seguimiento y cierra la venta (US3)', async ({ browser, page }) => {
  const tag = String(Date.now()).slice(-5)
  const a = `Llamar Uno ${tag}`
  const b = `Llamar Dos ${tag}`
  await capture(browser, a)
  await capture(browser, b)

  // Encargado: filtra sin asignar, selecciona y asigna a la auxiliar
  await login(page, 'enc.verdolago')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/gestion')
  await page.getByLabel('Responsable').selectOption('sin')
  // Las casillas salen recién con "Seleccionar"
  await expect(page.getByLabel(`Seleccionar ${a}`)).toHaveCount(0)
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  // Hay tabla (escritorio) y tarjetas (celular) en el DOM: solo la visible.
  await page.getByLabel(`Seleccionar ${a}`).filter({ visible: true }).check()
  await page.getByLabel(`Seleccionar ${b}`).filter({ visible: true }).check()
  await page.getByLabel('Asignar a').selectOption({ label: 'Auxiliar Verdolago (Auxiliar)' })
  await page.getByRole('button', { name: 'Asignar', exact: true }).click()
  await expect(page.getByText('✓ 2 asignadas')).toBeVisible()
  await logoutFromManage(page)

  // Auxiliar: entra directo a Mis contactos → "Captados"
  await login(page, 'aux.verdolago')
  await expect(page).toHaveURL(/\/seguimiento$/)
  await expect(page.getByRole('tab', { name: /^Captados/ })).toHaveAttribute('aria-selected', 'true')
  // La base local puede tener cientos de contactos y cada lista dibuja de a 50 (spec 022): solo los de este test.
  await page.getByLabel('Buscar por nombre o celular').fill(`llamar ${tag}`)
  const cardA = page.getByTestId('contact-card').filter({ hasText: a })
  await expect(cardA).toBeVisible()

  // El celular se toca y ofrece llamar o escribir por WhatsApp
  await cardA.getByRole('button', { name: /Contactar a/ }).click()
  await expect(page.getByRole('menuitem', { name: /Abrir WhatsApp para llamar/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/591\d{8}$/)
  await expect(page.getByRole('menuitem', { name: /Enviar mensaje por WhatsApp/ })).toHaveAttribute('href', /\?text=Hola/)
  await page.keyboard.press('Escape')

  // 2 Recaptación: no contestó → pasa a Recaptados › No contestó, con strike y marcado como resuelto hoy
  await cardA.getByRole('button', { name: 'Registrar contacto' }).click()
  await expect(page.getByRole('radio', { name: 'Llamada WhatsApp' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('radio', { name: 'Llamada', exact: true })).toHaveCount(0)
  await page.getByRole('radio', { name: /No contestó/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('No contestó (1/3). Vuelve mañana.')).toBeVisible()
  await expect(cardA).toHaveCount(0)
  await page.getByRole('tab', { name: /^Recaptados/ }).click()
  await page.getByRole('tab', { name: /No contestó/ }).click()
  const noAnswer = page.getByTestId('contact-card').filter({ hasText: a })
  await expect(noAnswer).toHaveAttribute('data-status', 'done')
  await expect(noAnswer).toContainText('Resuelto hoy · No contestó')
  await expect(noAnswer.getByLabel('1 de 3 sin respuesta')).toBeVisible()

  // 3 Seguimiento: por mensaje, visitará la tienda → Recaptados › Seguimiento, con lo que se hizo
  await page.getByRole('tab', { name: /^Captados/ }).click()
  const cardB = page.getByTestId('contact-card').filter({ hasText: b })
  await cardB.getByRole('button', { name: 'Registrar contacto' }).click()
  await page.getByRole('radio', { name: 'Mensaje' }).click()
  await page.getByRole('radio', { name: 'Visitará la tienda' }).click()
  await page.getByLabel('Observación').fill('Viene con su hermana')
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Visitará la tienda → Seguimiento')).toBeVisible()
  await page.getByRole('tab', { name: /^Recaptados/ }).click()
  await page.getByRole('tab', { name: /Seguimiento/ }).click()
  const visit = page.getByTestId('contact-card').filter({ hasText: b })
  await expect(visit).toContainText('Visitará la tienda')
  await expect(visit).toContainText('Viene con su hermana')
  await expect(visit).toContainText('(mensaje)')

  // 5 Venta: compró, pide el producto (Celulares, un toque) → sale de la bandeja
  await visit.getByRole('button', { name: 'Registrar contacto' }).click()
  await page.getByRole('radio', { name: 'En tienda' }).click()
  await page.getByRole('radio', { name: 'Compró' }).click()
  const save = page.getByRole('dialog').getByRole('button', { name: 'Guardar' })
  await expect(save).toBeDisabled()
  await page.getByRole('dialog').getByRole('tab', { name: 'Celulares' }).click()
  await save.click()
  await expect(page.getByText('✓ Compró → Venta')).toBeVisible()
  await expect(page.getByTestId('contact-card').filter({ hasText: b })).toHaveCount(0)
})

// Spec 020: lupa en «Mis contactos» por nombre o celular. Solo mira sus propios clientes (tag).
test('020 mis contactos: buscar por nombre o celular', async ({ browser, page }) => {
  const tag = String(Date.now()).slice(-5)
  const a = `Lupa Uno ${tag}`
  const b = `Lupa Dos ${tag}`
  const phoneA = randomPhone()
  await capture(browser, a, phoneA)
  await capture(browser, b)

  await login(page, 'enc.verdolago')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/gestion')
  await page.getByLabel('Buscar por nombre o celular').fill(tag)
  await expect(page.getByTestId('total')).toHaveText('2')
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  await page.getByLabel(`Seleccionar ${a}`).filter({ visible: true }).check()
  await page.getByLabel(`Seleccionar ${b}`).filter({ visible: true }).check()
  await page.getByLabel('Asignar a').selectOption({ label: 'Auxiliar Verdolago (Auxiliar)' })
  await page.getByRole('button', { name: 'Asignar', exact: true }).click()
  await expect(page.getByText('✓ 2 asignadas')).toBeVisible()
  await logoutFromManage(page)

  await login(page, 'aux.verdolago')
  await expect(page).toHaveURL(/\/seguimiento$/)
  const cards = page.getByTestId('contact-card')
  const search = page.getByLabel('Buscar por nombre o celular')
  // Por nombre: los dos, y el contador de «Captados» cuenta solo las coincidencias
  await search.fill(`lupa ${tag}`)
  await expect(cards).toHaveCount(2)
  await expect(page.getByRole('tab', { name: /^Captados/ })).toHaveText(/^Captados\s*2(?!\d)/)
  // Por celular (con espacio en medio): solo A
  await search.fill(`${phoneA.slice(0, 4)} ${phoneA.slice(4)}`)
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText(a)
  // Sin coincidencias: mensaje propio
  await search.fill(`zzz ${tag}`)
  await expect(page.getByText(/Ningún contacto coincide con/)).toBeVisible()
  // Al borrar vuelven todos
  await search.fill('')
  await expect(cards.filter({ hasText: b })).toBeVisible()
})
