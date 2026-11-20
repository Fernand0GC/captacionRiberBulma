import { expect, test, type Page } from '@playwright/test'
import { login, logoutFromManage } from './helpers'

// Spec 006, US4: Cobros verifica las compartidas de sus sucursales. Usuario de prueba cobros.verdolago (seed local,
// sucursal Verdolago). Día siguiente para que el encargado pueda quitar la asignación al final.

const tomorrow = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' }))
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function openTomorrowPlanning(page: Page): Promise<void> {
  await page.goto('/planificacion')
  await page.getByRole('button', { name: 'Día siguiente', exact: true }).click()
}

test('verificar compartidas: Cobros anota las verificadas y la Planificación las muestra; el encargado no puede', async ({ page }) => {
  page.on('dialog', (d) => void d.accept()) // confirmación al quitar
  // Horario único para encontrar la fila en las dos pantallas
  const m = String(10 + (Date.now() % 50)).padStart(2, '0')
  const hours = `06:${m}–07:${m}`

  // 1) El encargado carga Compartidas WhatsApp con meta 15 y reporta 15
  await login(page, 'enc.verdolago')
  await expect(page).toHaveURL(/\/panel/)
  await openTomorrowPlanning(page)
  await page.getByRole('button', { name: '＋ Mañana' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nueva asignación' })
  await dlg.getByRole('combobox', { name: /^Persona/ }).selectOption({ label: 'Auxiliar Verdolago' })
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Tienda' })
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Compartidas y estados' })
  await dlg.getByRole('checkbox', { name: 'Compartidas WhatsApp' }).check()
  await dlg.getByLabel('Hora inicio').fill(`06:${m}`)
  await dlg.getByLabel('Hora fin').fill(`07:${m}`)
  await dlg.getByRole('group', { name: 'Metas de Compartidas WhatsApp' }).getByRole('textbox', { name: /^Meta de compartidas/ }).fill('15')
  await dlg.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Asignación agregada')).toBeVisible()
  const card = page.getByTestId('assignment-card').filter({ hasText: hours }).filter({ hasText: 'Compartidas WhatsApp' })
  await card.getByRole('button', { name: 'Resultado' }).click()
  const res = page.getByRole('dialog', { name: 'Resultado' })
  await res.getByRole('textbox', { name: /^Compartidas/ }).fill('15')
  await res.getByRole('button', { name: 'Guardar' }).click()
  await expect(card).toContainText('Compartidas 15 de 15')
  await expect(card.getByTestId('share-verified')).toHaveCount(0)

  // El encargado no tiene la pantalla de verificación
  await page.goto('/verificar-compartidas')
  await expect(page).toHaveURL(/\/panel$/)
  await logoutFromManage(page)

  // 2) Cobros entra directo a «Verificar compartidas» y no ve el resto de la app
  await login(page, 'cobros.verdolago')
  await expect(page).toHaveURL(/\/verificar-compartidas$/)
  await page.goto('/planificacion')
  await expect(page).toHaveURL(/\/verificar-compartidas$/)
  await page.goto('/gestion')
  await expect(page).toHaveURL(/\/verificar-compartidas$/)
  await page.getByRole('button', { name: 'Abrir menú' }).click()
  const nav = page.getByRole('dialog', { name: 'Menú' }).getByRole('navigation', { name: 'Secciones' })
  await expect(nav.getByRole('link')).toHaveText(['Verificar compartidas'])
  await page.getByRole('dialog', { name: 'Menú' }).getByRole('button', { name: 'Cerrar menú' }).last().click()

  await page.getByLabel('Desde').fill(tomorrow())
  await page.getByLabel('Hasta').fill(tomorrow())
  const row = page.getByTestId('share-row').filter({ hasText: hours })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Auxiliar Verdolago')
  await expect(row).toContainText('VERDOLAGO')
  await expect(row.getByTestId('share-reported')).toHaveText('15')
  await expect(row.getByTestId('share-verified-by')).toHaveText('Sin verificar')
  await row.getByLabel('Verificadas').fill('12')
  await row.getByLabel('Comentario').fill('Faltan 3')
  await row.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Verificación guardada')).toBeVisible()
  await expect(row.getByTestId('share-verified-by')).toContainText('Verificó Cobros Verdolago Prueba el')
  // Se puede corregir
  await row.getByLabel('Verificadas').fill('13')
  await row.getByRole('button', { name: 'Guardar' }).click()
  await expect(row.getByLabel('Verificadas')).toHaveValue('13')
  await row.getByLabel('Verificadas').fill('12')
  await row.getByRole('button', { name: 'Guardar' }).click()
  await expect(row.getByLabel('Verificadas')).toHaveValue('12')
  await expect(row.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  await logoutFromManage(page)

  // 3) La Planificación muestra reportado y verificado; ventas no lo cambia
  await login(page, 'enc.verdolago')
  await expect(page).toHaveURL(/\/panel/)
  await openTomorrowPlanning(page)
  await expect(card).toContainText('Compartidas 15 de 15')
  await expect(card.getByTestId('share-verified')).toContainText('verificadas 12')
  await expect(card.getByTestId('share-verified')).toContainText('Faltan 3')

  // Limpieza
  await card.getByRole('button', { name: 'Quitar asignación de Auxiliar Verdolago' }).click()
  await expect(card).toHaveCount(0)
})

test('Usuarios: Sistemas hace Cobros a un usuario con sus sucursales y al editarlo las conserva', async ({ page }) => {
  const username = `vol.e2e${String(Date.now()).slice(-6)}`
  await login(page, 'admin')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/admin/usuarios')
  await page.getByRole('button', { name: '＋ Nuevo usuario' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo usuario' })
  await dialog.getByLabel(/Usuario \(para entrar\)/).fill(username)
  await dialog.getByLabel(/Nombre completo/).fill('Cobros de Prueba')
  await dialog.getByLabel(/^Sucursal/).selectOption({ label: 'TRINIDAD' })
  await dialog.getByRole('button', { name: 'Crear usuario' }).click()
  const created = page.getByRole('dialog', { name: 'Usuario creado' })
  await expect(created.getByTestId('new-username')).toHaveText(username, { timeout: 15_000 })
  const password = (await created.getByTestId('new-password').innerText()).trim()
  await created.getByRole('button', { name: 'Listo' }).click()

  // Hacer Cobros: elige sucursales
  await page.getByLabel('Buscar usuario').fill(username)
  const user = page.getByTestId(`user-${username}`)
  await user.getByRole('button', { name: 'Hacer Cobros' }).click()
  const make = page.getByRole('dialog', { name: '¿Hacer Cobros a Cobros de Prueba?' })
  await expect(make.getByRole('button', { name: 'Hacer Cobros' })).toBeDisabled()
  await make.getByRole('checkbox', { name: 'VERDOLAGO' }).check()
  await make.getByRole('checkbox', { name: 'TRINIDAD' }).check()
  await make.getByRole('button', { name: 'Hacer Cobros' }).click()
  await expect(page.getByText('✓ Cobros de Prueba ahora es de Cobros')).toBeVisible()
  await expect(user).toContainText(/Cobros · (VERDOLAGO, TRINIDAD|TRINIDAD, VERDOLAGO)/)

  // Editar el nombre no le quita el rol ni las sucursales
  await user.getByRole('button', { name: 'Editar' }).click()
  const edit = page.getByRole('dialog', { name: 'Editar a Cobros de Prueba' })
  await edit.getByLabel(/Nombre completo/).fill('Cobros de Prueba Dos')
  await edit.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('✓ Usuario actualizado')).toBeVisible()
  await expect(user).toContainText('Cobros de Prueba Dos')
  await expect(user).toContainText(/Cobros · (VERDOLAGO, TRINIDAD|TRINIDAD, VERDOLAGO)/)

  // Cambiar sus sucursales
  await user.getByRole('button', { name: 'Sucursales de Cobros' }).click()
  const branches = page.getByRole('dialog', { name: 'Sucursales de Cobros de Cobros de Prueba Dos' })
  await branches.getByRole('checkbox', { name: 'TRINIDAD' }).uncheck()
  await branches.getByRole('button', { name: 'Guardar' }).click()
  await expect(user).toContainText('Cobros · VERDOLAGO ·')
  await logoutFromManage(page)

  // Entra directo a Verificar compartidas
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(username)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/verificar-compartidas$/)
  await expect(page.getByTestId('shares-no-branches')).toHaveCount(0)
})
