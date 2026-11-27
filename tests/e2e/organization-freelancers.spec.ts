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
  // Otro canal: no se muestra.
  await dlg.getByRole('combobox', { name: /^Canal/ }).selectOption({ label: 'Llamadas' })
  await expect(dlg.getByTestId('freelancer-count')).toHaveCount(0)
  await dlg.getByRole('button', { name: 'Cancelar' }).click()
})
