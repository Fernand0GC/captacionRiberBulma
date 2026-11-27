import { expect, test } from '@playwright/test'
import { login, openNewWithChannel, randomPhone } from './helpers'

// Spec 031: «Ocupación del cliente» no aparece si el canal de la jornada es Messenger o Marketplace. Cada prueba
// arranca con el navegador limpio, así que el diálogo de canal sale siempre.

async function openFormWith(page: import('@playwright/test').Page, channel: string) {
  await login(page, 'sup.verdolago')
  await openNewWithChannel(page, channel, 'Publicación e2e')
  await expect(page.getByLabel(/Nombre completo/)).toBeVisible()
}

for (const channel of ['Marketplace', 'Messenger']) {
  test(`registro (031): con ${channel} no se pide la ocupación y se guarda`, async ({ page }) => {
    await openFormWith(page, channel)
    await expect(page.getByText('Ocupación del cliente')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Dependiente/Asalariado' })).toHaveCount(0)
    // El resto del formulario no cambia (criterio 5).
    await expect(page.getByText('Producto de interés')).toBeVisible()
    await expect(page.getByText('Nivel de interés')).toBeVisible()

    await page.getByLabel(/Nombre completo/).fill(`Cliente ${channel} e2e`)
    await page.getByLabel(/^Celular/).fill(randomPhone())
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('✓ Guardado')).toBeVisible()
  })
}

test('registro (031): con otro canal la ocupación se sigue pidiendo', async ({ page }) => {
  await openFormWith(page, 'Activación')
  await expect(page.getByText('Ocupación del cliente')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dependiente/Asalariado' })).toBeVisible()
})
