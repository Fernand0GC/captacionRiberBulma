import { expect, test } from '@playwright/test'
import { login, logoutFromManage, openRegister, pickChannel, randomPhone } from './helpers'

test('panel: el gestor entra al Panel con métricas; los chips de canal filtran Captaciones', async ({ page }) => {
  // Una captación por Visita, con descripción (sup.verdolago, para no chocar con otras pruebas)
  const name = `Panel Chip ${String(Date.now()).slice(-5)}`
  await login(page, 'sup.verdolago')
  await openRegister(page)
  await page.getByRole('button', { name: 'Nuevo Registro' }).click()
  const picker = page.getByRole('dialog', { name: '¿Por qué canal captas hoy?' })
  await expect(picker.or(page.getByLabel(/Nombre completo/))).toBeVisible()
  if (await picker.isVisible()) {
    await expect(picker.getByRole('group', { name: 'Calle' }).getByRole('button', { name: 'Visita', exact: true })).toBeVisible()
    await pickChannel(page, 'Visita', 'Colegio Don Bosco')
  }
  else {
    await page.goto('/registrar')
    await page.getByRole('button', { name: /Cambiar|Elegir/ }).first().click()
    await pickChannel(page, 'Visita', 'Colegio Don Bosco')
    await page.getByRole('button', { name: 'Nuevo Registro' }).click()
  }
  await page.getByLabel(/Nombre completo/).fill(name)
  await page.getByLabel(/^Celular/).fill(randomPhone())
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  await logoutFromManage(page)

  // Encargado: Panel con indicadores y embudo
  await login(page, 'enc.verdolago')
  await expect(page).toHaveURL(/\/panel/)
  const kpis = page.getByTestId('kpis')
  await expect(kpis).toContainText('Captaciones')
  await expect(kpis).toContainText('Ventas')
  await expect(page.getByRole('heading', { name: 'Embudo' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Por canal de captación' })).toBeVisible()
  await expect(page.getByTestId('by-group')).toContainText('Calle')


  // Captaciones: los chips van agrupados por Calle / Tienda; el chip del canal filtra
  await page.goto('/gestion')
  await expect(page.getByTestId('group-Calle').getByTestId('chip-Visita')).toBeVisible()
  await page.getByTestId('chip-Visita').click()
  await expect(page).toHaveURL(/canal=/)
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
  // La descripción del canal se ve y se puede buscar
  await expect(page.getByRole('listitem').filter({ hasText: name })).toContainText('Colegio Don Bosco')
  await page.getByRole('searchbox').fill('don bosco')
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
})
