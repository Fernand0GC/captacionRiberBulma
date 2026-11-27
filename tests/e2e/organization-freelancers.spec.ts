import { expect, test } from '@playwright/test'
import { login } from './helpers'

// Spec 033 (obs. 2): al planificar el canal Freelancers se ve cuántos freelancers hay en la sucursal.
test('planificación (033): el canal Freelancers muestra la cantidad de freelancers de la sucursal', async ({ page }) => {
  await login(page, 'enc.verdolago')
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await page.goto('/planificacion')
  await page.getByRole('button', { name: '＋ Mañana' }).click()
  const dlg = page.getByRole('dialog', { name: 'Nueva asignación' })
  await dlg.getByRole('combobox', { name: /^Estrategia/ }).selectOption({ label: 'Tienda' })
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Freelancers' })
  await expect(dlg.getByTestId('freelancer-count')).toHaveText(
    /^(\d+ freelancers? en la sucursal|No hay freelancers cargados en la sucursal\. Se cargan en Referidos\.)$/,
  )
  // Spec 035: lista «Freelancers que van» con casillas y «+ Agregar freelancer» (no se guarda la asignación).
  const tag = String(Date.now()).slice(-6)
  const nuevo = `E2E Free ${tag}`
  const group = dlg.getByRole('group', { name: 'Freelancers que van' })
  await expect(group).toBeVisible()
  await group.getByRole('button', { name: '+ Agregar freelancer' }).click()
  await group.getByRole('textbox', { name: /Nombre del freelancer/ }).fill(nuevo)
  await group.getByRole('button', { name: 'Agregar', exact: true }).click()
  await expect(group.getByRole('checkbox', { name: nuevo })).toBeChecked()
  // Spec 036: buscador; lo que no existe se agrega desde la búsqueda y queda marcado; los marcados van primero.
  const otro = `E2E Busca ${tag}`
  const search = group.getByRole('searchbox', { name: 'Buscar freelancer' })
  await search.fill(otro.toUpperCase())
  // Lo ya marcado se sigue viendo, así que no sale «Ningún freelancer coincide…» (eso lo prueba freelancerView.test.ts).
  await group.getByRole('button', { name: `Agregar «${otro.toUpperCase()}»` }).click()
  await expect(search).toHaveValue('')
  await expect(group.getByRole('checkbox', { name: otro.toUpperCase() })).toBeChecked()
  await expect(group.getByText('2 marcados')).toBeVisible()
  await expect(group.getByRole('checkbox').first()).toBeChecked()
  await expect(dlg.getByTestId('freelancer-count')).toHaveText(/^\d+ freelancers? en la sucursal$/)
  // Otro canal: no se muestra.
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Llamadas' })
  await expect(dlg.getByTestId('freelancer-count')).toHaveCount(0)
  await expect(dlg.getByRole('group', { name: 'Freelancers que van' })).toHaveCount(0)
  await dlg.getByRole('button', { name: 'Cancelar' }).click()
})
