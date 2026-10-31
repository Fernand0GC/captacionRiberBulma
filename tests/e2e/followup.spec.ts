import { expect, test, type Browser } from '@playwright/test'
import { fillCapture, login, logoutFromManage, randomPhone } from './helpers'

// Capta el encargado (también registra): las pruebas corren en paralelo y cada una usa sus propios usuarios.
async function capture(browser: Browser, name: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await login(page, 'enc.verdolago')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/registrar')
  await fillCapture(page, name, randomPhone())
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
