import { expect, test } from '@playwright/test'
import { fillCapture, login, randomPhone, todayCount } from './helpers'

test('registro de campo: online, sin señal, recarga sin red y sincronización (US1, SC-002/003)', async ({ page, context }) => {
  await login(page, 'vol.verdolago')
  await expect(page).toHaveURL(/\/registrar$/)
  await expect(page.getByText('Todo subido')).toBeVisible()

  // Esperar a que el service worker controle la página (necesario para recargar sin red).
  await page.evaluate(() => navigator.serviceWorker.ready)
  const stats = page.waitForResponse((r) => r.url().includes('/rpc/my_capture_stats') && r.ok())
  await page.reload()
  await stats // el contador base tiene que venir del servidor, no del valor inicial
  await expect(page.getByTestId('today-count')).toBeVisible()
  const base = await todayCount(page)

  // 1) Con señal
  await fillCapture(page, 'Prueba Online', randomPhone())
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/registrar$/)
  await expect(page.getByTestId('today-count')).toHaveText(String(base + 1))
  // Con todas las pruebas en paralelo la subida puede tardar: que suba antes de cortar la red
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })

  // 2) Sin señal: dos captaciones quedan pendientes
  await context.setOffline(true)
  for (const name of ['Prueba Offline Uno', 'Prueba Offline Dos']) {
    await fillCapture(page, name, randomPhone())
    // Guardar sin red: medido dentro de la página (constitución II, ≤100 ms hasta volver a Registrar)
    const elapsed = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const t0 = performance.now()
          const obs = new MutationObserver(() => {
            if (location.pathname === '/registrar' && document.querySelector('[data-testid="today-count"]')) {
              obs.disconnect()
              resolve(performance.now() - t0)
            }
          })
          obs.observe(document.body, { childList: true, subtree: true })
          ;(document.querySelector('button[type="submit"]') as HTMLButtonElement).click()
        }),
    )
    expect(elapsed, `Guardar sin red tardó ${elapsed.toFixed(0)} ms`).toBeLessThan(100)
  }
  await expect(page.getByText('Sin conexión')).toBeVisible()
  await expect(page.getByText('2 por subir')).toBeVisible()
  await expect(page.getByTestId('today-count')).toHaveText(String(base + 3))

  // 3) Recargar sin red: la app abre y las pendientes siguen ahí
  await page.reload()
  await expect(page.getByText('2 por subir')).toBeVisible()

  // 4) Vuelve la red: se suben solas (SC-003: < 2 min; acá esperamos hasta 45 s)
  await context.setOffline(false)
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 45_000 })
  await expect(page.getByTestId('today-count')).toHaveText(String(base + 3))
})

test('teléfono ya registrado: con señal se bloquea sin mostrar la ficha (FR-016)', async ({ page }) => {
  const phone = randomPhone()
  await login(page, 'vol.verdolago')
  await fillCapture(page, 'Original Uno', phone)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/registrar$/)
  await expect(page.getByText('Todo subido')).toBeVisible({ timeout: 15_000 })

  await fillCapture(page, 'Repetido Dos', `+591 ${phone.slice(0, 4)}-${phone.slice(4)}`)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Este teléfono ya está registrado.')).toBeVisible()
  await expect(page).toHaveURL(/\/registrar\/nuevo$/)
  await expect(page.getByText('Original Uno')).toHaveCount(0)
})

test('el usuario de campo no entra a gestión (SC-005, UI)', async ({ page }) => {
  await login(page, 'vol.verdolago')
  await expect(page).toHaveURL(/\/registrar$/)
  await page.goto('/gestion')
  await expect(page).toHaveURL(/\/registrar$/)
})
