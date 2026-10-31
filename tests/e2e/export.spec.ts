import { expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { fillCapture, login, logoutFromManage, randomPhone } from './helpers'

test('Excel de captaciones: el encargado descarga la hoja CLIENTES con lo filtrado (US6)', async ({ page }) => {
  const name = `Excel Prueba ${Date.now() % 100000}`
  await login(page, 'vol.trinidad') // Trinidad: no choca con las pruebas de Verdolago
  await expect(page).toHaveURL(/\/registrar/)
  await fillCapture(page, name, randomPhone())
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/registrar$/)
  await logoutFromManage(page)

  await login(page, 'enc.trinidad')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/gestion')
  await expect(page.getByText(name).filter({ visible: true })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar Excel' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^captacion_TRINIDAD_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.xlsx$/)

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(await file.path())
  const ws = wb.getWorksheet('CLIENTES')!
  expect(ws.getRow(6).getCell(2).value).toBe('Nombre completo')
  const names = ws.getColumn(2).values.slice(7)
  expect(names).toContain(name)
  expect(ws.getCell('A4').value).toBe(names.length) // "Clientes registrados" = filas exportadas
  await expect(page.getByText(/Excel descargado/)).toBeVisible()
})
