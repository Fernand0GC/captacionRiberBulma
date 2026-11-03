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

/** Va a Registrar después del login (auxiliar y supervisor entran a Mis contactos). */
export async function openRegister(page: Page): Promise<void> {
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  if (!page.url().endsWith('/registrar')) await page.goto('/registrar')
}

/** En el diálogo de canal: elige el canal, escribe su descripción (obligatoria) y confirma. */
export async function pickChannel(page: Page, name: string, detail = 'Plaza principal'): Promise<void> {
  const picker = page.getByRole('dialog', { name: '¿Por qué canal captas hoy?' })
  await picker.getByRole('button', { name, exact: true }).click()
  await picker.getByRole('textbox', { name: /^Descripción/ }).fill(detail)
  await picker.getByRole('button', { name: 'Listo' }).click()
}

/** Abre el formulario; si el canal de hoy no está elegido, elige "Activación" (FR-011b). */
export async function fillCapture(page: Page, name: string, phone: string): Promise<void> {
  await openRegister(page)
  await page.getByRole('button', { name: 'Nuevo Registro' }).click()
  const picker = page.getByRole('dialog', { name: '¿Por qué canal captas hoy?' })
  const nameField = page.getByLabel(/Nombre completo/)
  await expect(picker.or(nameField)).toBeVisible()
  if (await picker.isVisible()) await pickChannel(page, 'Activación')
  await expect(page).toHaveURL(/\/registrar\/nuevo$/)
  await page.getByLabel(/Nombre completo/).fill(name)
  await page.getByLabel(/^Celular/).fill(phone)
}

export async function todayCount(page: Page): Promise<number> {
  return Number(await page.getByTestId('today-count').innerText())
}

/** "Salir" está en la barra lateral (escritorio) o dentro del menú ☰ (celular), para todos los roles. */
export async function logoutFromManage(page: Page): Promise<void> {
  const menu = page.getByRole('button', { name: 'Abrir menú' })
  const exit = page.getByRole('button', { name: 'Salir' })
  // Recién entrado, la pantalla aún se re-renderiza y puede cerrar el menú: reintenta abrir y salir.
  await expect(async () => {
    if (!(await exit.isVisible()) && (await menu.isVisible())) await menu.click()
    await exit.click({ timeout: 2_000 })
    await expect(page).toHaveURL(/\/login$/, { timeout: 3_000 })
  }).toPass({ timeout: 15_000 })
}
