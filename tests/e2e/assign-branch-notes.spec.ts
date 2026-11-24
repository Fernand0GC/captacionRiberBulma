import { expect, test } from '@playwright/test'
import { fillCapture, login, randomPhone } from './helpers'

// Avisos de sucursal al asignar (pedido de ventas, 24/11): con «Todas las sucursales» no se puede asignar y se avisa
// antes de seleccionar; en la barra se aclara que solo aparece el personal de la sucursal elegida.
test('asignar: aviso de elegir sucursal y de personal de la sucursal', async ({ browser }) => {
  const tag = `Avisuc ${String(Date.now()).slice(-5)}`

  // El encargado capta un cliente y ve el aviso de su sucursal en la barra de asignar.
  const encCtx = await browser.newContext()
  const enc = await encCtx.newPage()
  await login(enc, 'enc.verdolago')
  await expect(enc).toHaveURL(/\/panel/)
  await enc.goto('/registrar')
  await fillCapture(enc, tag, randomPhone())
  await enc.getByRole('button', { name: 'Guardar' }).click()
  await expect(enc.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })
  await enc.goto('/gestion')
  await enc.getByLabel('Buscar por nombre o celular').fill(tag)
  await expect(enc.getByTestId('total')).toHaveText('1')
  await expect(enc.getByTestId('select-hint')).toHaveCount(0)
  await enc.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  await expect(enc.getByTestId('assignee-note')).toHaveText('Solo aparece el personal activo de VERDOLAGO')
  await encCtx.close()

  // Admin con «Todas las sucursales»: Seleccionar desactivado y el aviso antes de tocarlo.
  const page = await (await browser.newContext()).newPage()
  await login(page, 'admin')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/gestion')
  await expect(page.getByLabel('Sucursal')).toHaveValue('')
  await page.getByLabel('Buscar por nombre o celular').fill(tag)
  await expect(page.getByTestId('total')).toHaveText('1')
  await expect(page.getByRole('button', { name: 'Seleccionar', exact: true })).toBeDisabled()
  await expect(page.getByTestId('select-hint')).toHaveText('Para asignar, elige una sucursal en el filtro.')

  // Al elegir la sucursal se habilita y el aviso se va.
  await page.getByLabel('Sucursal').selectOption({ label: 'VERDOLAGO' })
  await expect(page.getByTestId('total')).toHaveText('1')
  await expect(page.getByRole('button', { name: 'Seleccionar', exact: true })).toBeEnabled()
  await expect(page.getByTestId('select-hint')).toHaveCount(0)
})
