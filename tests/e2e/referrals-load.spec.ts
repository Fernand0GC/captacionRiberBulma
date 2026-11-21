import { expect, test } from '@playwright/test'
import { login, logoutFromManage, randomPhone } from './helpers'

// Spec 016: el jefe de ventas carga referidos en lote (pegando de WhatsApp) y los asigna; la auxiliar los ve con
// «Referido por» y «te lo asignó»; el Reporte abre la ventana de detalle del referidor.
// Los referidores de prueba empiezan con "E2E " (los borra `pnpm db:clean`).

test('referidos 016: cargar y asignar, Mis contactos y ventana de detalle', async ({ page }) => {
  // Letras y no números: el lector de WhatsApp quita los números del nombre.
  const tag = [...String(Date.now()).slice(-5)].map((d) => 'abcdefghij'[Number(d)]).join('')
  const referrer = `E2E Carga ${tag}`
  const c1 = `Lote Uno ${tag}`
  const c2 = `Lote Dos ${tag}`
  const p1 = randomPhone()
  const p2 = randomPhone()

  // 1) La jefa (VERDOLAGO y TRINIDAD) abre «Cargar»: con «Todas mis sucursales» pide elegir una
  await login(page, 'jefe.ventas')
  await expect(page).toHaveURL(/\/panel/)
  await page.goto('/referidos?seccion=cargar&todas=true')
  await expect(page.getByText('Elige la sucursal para ver a quién se le puede asignar.')).toBeVisible()
  await page.getByRole('group', { name: 'Sucursal de la carga' }).getByRole('button', { name: 'VERDOLAGO' }).click()
  await expect(page).toHaveURL(/sucursal=5/)

  // 2) Quién pasó los contactos: uno nuevo, «Compañero de trabajo»
  await page.getByLabel(/Quién te pasó los contactos/).fill(referrer)
  await page.getByRole('button', { name: `＋ Agregar «${referrer}»` }).click()
  await page.getByRole('group', { name: /Quién es/ }).getByRole('button', { name: 'Compañero de trabajo' }).click()
  await expect(page.getByTestId('referrer-chosen')).toContainText(referrer)

  // 3) Pegar de WhatsApp → la tabla se llena (el saludo se salta)
  await page.getByRole('tab', { name: 'Pegar de WhatsApp' }).click()
  await page.getByLabel('Mensaje con los contactos').fill(`Hola, te paso los contactos 🙌\n${c1} ${p1.slice(0, 4)} ${p1.slice(4)}\n${c2} - ${p2}`)
  await page.getByRole('button', { name: 'Leer contactos' }).click()
  await expect(page.getByLabel('Nombre 1')).toHaveValue(c1)
  await expect(page.getByLabel('Celular 1')).toHaveValue(p1)
  await expect(page.getByLabel('Nombre 2')).toHaveValue(c2)

  // 4) Todos a la auxiliar de la sucursal y guardar
  await page.getByTestId('assignee-Auxiliar Verdolago').click()
  await expect(page.getByTestId('assignee-Auxiliar Verdolago')).toContainText('+2 ahora')
  await page.getByRole('button', { name: 'Guardar y asignar 2 referidos' }).click()
  await expect(page.getByTestId('load-result')).toContainText(`2 referidos de ${referrer} guardados`)
  await expect(page.getByTestId('load-result')).toContainText('Auxiliar Verdolago +2')

  // 5) Celular repetido: avisa en la fila y no cuenta para guardar
  await page.getByLabel('Nombre 1').fill('Repetido Prueba')
  await page.getByLabel('Celular 1').fill(p1)
  await expect(page.getByText(`Fila 1: Ya existe en VERDOLAGO: ${c1} (lo atiende Auxiliar Verdolago).`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar y asignar referidos' })).toBeDisabled()

  // 6) Reporte → ventana de detalle del referidor
  await page.goto('/referidos?sucursal=5')
  await page.getByTestId(`referrer-row-${referrer}`).getByRole('button', { name: referrer }).click()
  const dialog = page.getByRole('dialog', { name: `${referrer} · Referidos` })
  await expect(dialog.getByTestId('referrer-detail-kpis')).toContainText('Llegaron2')
  await expect(dialog.getByTestId('referrer-detail-row')).toHaveCount(2)
  await expect(dialog.getByRole('button', { name: /Auxiliar Verdolago/ })).toContainText('0 contactados · 2 sin contactar')
  await dialog.getByRole('button', { name: 'Cerrar' }).click()
  await logoutFromManage(page)

  // 7) La auxiliar los ve en Mis contactos con la etiqueta
  await login(page, 'aux.verdolago')
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await page.goto('/seguimiento')
  const card = page.getByTestId('contact-card').filter({ hasText: c1 })
  await expect(card.getByTestId('referral-tag')).toContainText(`Referido por ${referrer}`)
  await expect(card.getByTestId('referral-tag')).toContainText('te lo asignó Jefe de Ventas Prueba')
})
