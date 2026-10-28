import { expect, type Page } from '@playwright/test'

// Usuarios de prueba del seed local (supabase/seed.sql). Solo existen en el entorno local.
export const SEED_PASSWORD = 'Captacion.2026'

export async function login(page: Page, username: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(username)
  await page.getByLabel('Contraseña').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
}

/** Teléfono celular aleatorio (8 dígitos, empieza con 7) para no chocar con corridas anteriores. */
export function randomPhone(): string {
  return '7' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0')
}

/** Abre el formulario; si el canal de hoy no está elegido, elige "Activación" (FR-011b). */
export async function fillCapture(page: Page, name: string, phone: string): Promise<void> {
  await page.getByRole('button', { name: 'Nuevo Registro' }).click()
  const picker = page.getByRole('dialog', { name: '¿Por qué canal captas hoy?' })
  const nameField = page.getByLabel(/Nombre completo/)
  await expect(picker.or(nameField)).toBeVisible()
  if (await picker.isVisible()) await picker.getByRole('button', { name: 'Activación' }).click()
  await expect(page).toHaveURL(/\/registrar\/nuevo$/)
  await page.getByLabel(/Nombre completo/).fill(name)
  await page.getByLabel(/^Celular/).fill(phone)
}

export async function todayCount(page: Page): Promise<number> {
  return Number(await page.getByTestId('today-count').innerText())
}

/** En gestión, "Salir" está en el menú lateral; en celular, dentro del menú ☰. */
export async function logoutFromManage(page: Page): Promise<void> {
  const menu = page.getByRole('button', { name: 'Abrir menú' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('button', { name: 'Salir' }).click()
  await expect(page).toHaveURL(/\/login$/)
}
