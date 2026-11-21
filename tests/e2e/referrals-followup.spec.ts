import { expect, test } from '@playwright/test'
import { login, logoutFromManage, randomPhone } from './helpers'

// Spec 017: seguimiento a referidores. El jefe de ventas da de alta un referidor con celular y «Ya le pedí referidos
// hoy», registra pedidos desde «Para hoy», mira la tabla («Ver por») y el historial en la ventana del referidor.
// Los referidores de prueba empiezan con "E2E " (los borra `pnpm db:clean`).

test('referidos 017: alta con celular, pedir desde Para hoy, tabla y historial', async ({ page }) => {
  const tag = String(Date.now()).slice(-6)
  const first = `E2E Seg Uno ${tag}`
  const second = `E2E Seg Dos ${tag}`
  const phone = randomPhone()

  await login(page, 'jefe.ventas')
  await expect(page).toHaveURL(/\/panel/)

  // 1) Padrón: nuevo referidor con celular y «Ya le pedí referidos hoy» → ventana del pedido
  await page.goto('/referidos?seccion=referidores&sucursal=5')
  const add = page.getByRole('group', { name: 'Agregar referidor' })
  await add.getByLabel('Nuevo referidor').fill(first)
  await add.getByLabel('Tipo').selectOption('freelance')
  await add.getByLabel('Celular').fill(phone)
  await add.getByLabel('Ya le pedí referidos hoy').check()
  await add.getByRole('button', { name: 'Agregar' }).click()
  const ask = page.getByRole('dialog', { name: `Pedir referidos a ${first}` })
  await expect(ask.getByTestId('ask-referrer')).toContainText('nunca se le pidió referidos')
  await ask.getByRole('radio', { name: 'Mensaje' }).click()
  await ask.getByRole('radio', { name: 'Prometió pasar' }).click()
  await ask.getByLabel(/Observación/).fill('Junta contactos el fin de semana')
  await ask.getByRole('button', { name: 'Guardar pedido' }).click()
  await expect(page.getByText(`✓ Pedido a ${first} guardado · Prometió pasar`)).toBeVisible()
  await expect(page.getByLabel(`Celular de ${first}`)).toHaveValue(phone)

  // 2) Celular repetido en la sucursal: se rechaza nombrando al otro
  await add.getByLabel('Nuevo referidor').fill(second)
  await add.getByLabel('Celular').fill(phone)
  await add.getByRole('button', { name: 'Agregar' }).click()
  await expect(page.getByText(`Ese celular ya es de «${first}».`)).toBeVisible()
  await add.getByLabel('Celular').fill('')
  await add.getByRole('button', { name: 'Agregar' }).click()
  await expect(page.getByLabel(`Celular de ${second}`)).toHaveValue('')

  // 3) Seguimiento: el nuevo sin pedidos está en «Para hoy»; se le pide y sale de la lista
  await page.getByRole('tab', { name: 'Seguimiento' }).click()
  await expect(page).toHaveURL(/seccion=seguimiento/)
  // «Para hoy» muestra 8; con más, «Ver los N» abre el resto.
  await expect(page.getByTestId('followup-kpis')).toBeVisible()
  const more = page.getByRole('button', { name: /^Ver los \d+$/ })
  if (await more.isVisible()) await more.click()
  const item = page.getByTestId(`today-${second}`)
  await expect(item).toContainText('Nuevo · hacer el primer pedido')
  await expect(page.getByTestId(`today-${first}`)).toHaveCount(0)
  await item.getByRole('button', { name: 'Pedir' }).click()
  const ask2 = page.getByRole('dialog', { name: `Pedir referidos a ${second}` })
  await ask2.getByRole('radio', { name: 'No contestó' }).click()
  await ask2.getByRole('button', { name: 'Guardar pedido' }).click()
  await expect(page.getByTestId(`today-${second}`)).toHaveCount(0)

  // 4) Tabla por referidor y por quién pide
  await expect(page.getByTestId(`followup-row-${first}`)).toContainText('1 de 1')
  await expect(page.getByTestId(`followup-row-${second}`)).toContainText('0 de 1')
  await page.getByRole('tab', { name: 'Quién pide' }).click()
  await expect(page).toHaveURL(/ver=quien/)
  await expect(page.getByTestId('followup-actor-Jefe de Ventas Prueba')).toBeVisible()
  await page.getByRole('tab', { name: 'Referidor', exact: true }).click()

  // 5) Ventana del referidor: historial de pedidos
  await page.getByTestId(`followup-row-${first}`).getByRole('button', { name: first }).click()
  const detail = page.getByRole('dialog', { name: `${first} · Referidos` })
  await expect(detail.getByTestId('referrer-ask-row')).toHaveCount(1)
  await expect(detail.getByTestId('referrer-ask-row')).toContainText('Prometió pasar')
  await expect(detail.getByTestId('referrer-ask-row')).toContainText('Junta contactos el fin de semana')
  await detail.getByRole('button', { name: 'Cerrar' }).click()
  await logoutFromManage(page)
})
