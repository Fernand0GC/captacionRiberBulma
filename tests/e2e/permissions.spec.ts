import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { login, logoutFromManage } from './helpers'

// Spec 029: la jefa de ventas le da «Referidos» a la encargada de Verdolago (seed) y ella entra, solo a su sucursal.

const ENC_VERDOLAGO = '00000000-0000-4000-8000-000000000003'

function psql(sql: string): string {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_riber-captacion', 'psql', '-U', 'postgres', '-t', '-A', '-q'], {
    input: sql,
  })
    .toString()
    .trim()
}

const clean = () => psql(`delete from public.profile_permissions where profile_id = '${ENC_VERDOLAGO}'`)

async function menuLink(page: Page, name: string) {
  await page.getByRole('button', { name: 'Abrir menú' }).click()
  return page.getByRole('dialog', { name: 'Menú' }).getByRole('link', { name, exact: true })
}

test.beforeEach(clean)
test.afterEach(clean)

test('la jefa otorga Referidos y la encargada entra solo a su sucursal', async ({ page }) => {
  // Sin permiso: la encargada no lo ve, y por la dirección vuelve a su inicio (criterio 12).
  await login(page, 'enc.verdolago')
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await expect(await menuLink(page, 'Referidos')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Menú' }).getByRole('link', { name: 'Permisos' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cerrar menú' }).last().click()
  await page.goto('/referidos')
  await expect(page).toHaveURL(/\/panel$/)
  await logoutFromManage(page)

  // La jefa lo otorga desde «Permisos» (criterio 2).
  await login(page, 'jefe.ventas')
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await page.goto('/permisos')
  const sw = page.getByRole('switch', { name: 'Referidos: Encargado Verdolago' })
  await expect(sw).toHaveAttribute('aria-checked', 'false')
  await sw.click()
  await expect(page.getByText('✓ Encargado: Referidos activado')).toBeVisible()
  await expect(sw).toHaveAttribute('aria-checked', 'true')
  expect(psql(`select granted_by from public.profile_permissions
    where profile_id = '${ENC_VERDOLAGO}' and permission = 'referrals'`)).toBe('00000000-0000-4000-8000-000000000009')
  await logoutFromManage(page)

  // Con permiso: ve Referidos, de Verdolago y sin selector de sucursal (criterio 13).
  await login(page, 'enc.verdolago')
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await (await menuLink(page, 'Referidos')).click()
  await expect(page).toHaveURL(/\/referidos/)
  await expect(page.getByRole('heading', { name: 'Referidos' })).toBeVisible()
  await expect(page.getByText(/^verdolago$/i).first()).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Sucursal' })).toHaveCount(0)
  await expect(page.getByText('No tienes permiso')).toHaveCount(0)
})
