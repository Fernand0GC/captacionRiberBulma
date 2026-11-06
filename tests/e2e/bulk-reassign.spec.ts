import { expect, test } from '@playwright/test'
import { fillCapture, login, randomPhone } from './helpers'

test('reasignar por montón: avisa de quién son, pide confirmar y cambia el responsable', async ({ page }) => {
  const tag = `Reasig ${String(Date.now()).slice(-5)}`
  const names = [`${tag} A`, `${tag} B`]

  await login(page, 'enc.verdolago')
  await expect(page).toHaveURL(/\/panel/)
  for (const n of names) {
    await page.goto('/registrar')
    await fillCapture(page, n, randomPhone())
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  }

  // Primero se asignan a la auxiliar (sin dueño: el botón dice Asignar, sin confirmar)
  await page.goto('/gestion')
  await page.getByLabel('Buscar por nombre o celular').fill(tag)
  // La búsqueda se aplica con retardo: esperar al filtro (cambiar filtros limpia la selección).
  await expect(page.getByTestId('total')).toHaveText('2')
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  for (const n of names) await page.getByLabel(`Seleccionar ${n}`).filter({ visible: true }).check()
  await expect(page.getByTestId('selected-owners')).toHaveText('2 sin responsable')
  await page.getByLabel('Asignar a').selectOption({ label: 'Auxiliar Verdolago (Auxiliar)' })
  await page.getByRole('button', { name: 'Asignar', exact: true }).click()
  await expect(page.getByText('✓ 2 asignadas')).toBeVisible()

  // Reasignar: la barra dice de quién son, el botón cambia a Reasignar y pide confirmar
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  for (const n of names) await page.getByLabel(`Seleccionar ${n}`).filter({ visible: true }).check()
  await expect(page.getByTestId('selected-owners')).toHaveText('2 de Auxiliar Verdolago')
  await page.getByLabel('Asignar a').selectOption({ label: 'Supervisor Verdolago (Supervisor)' })
  await page.getByRole('button', { name: 'Reasignar', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: '¿Reasignar?' })
  await expect(confirm).toContainText('pasarlas a Supervisor Verdolago')
  await expect(confirm).toContainText('2 de Auxiliar Verdolago')
  await confirm.getByRole('button', { name: 'Reasignar 2' }).click()
  await expect(page.getByText('✓ 2 reasignadas')).toBeVisible()

  // Quedan a nombre del supervisor
  await page.getByLabel('Responsable').selectOption({ label: 'Supervisor Verdolago' })
  for (const n of names) await expect(page.getByRole('link', { name: n, exact: true }).filter({ visible: true })).toBeVisible()
})
