import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { login } from './helpers'

// Spec 027: Sistemas actúa como el auxiliar de Verdolago (seed), ve la app como él con la banda, y vuelve a su cuenta.

function psql(sql: string): string {
  return execFileSync(
    'docker',
    ['exec', '-i', 'supabase_db_riber-captacion', 'psql', '-U', 'postgres', '-t', '-A', '-q'],
    {
      input: sql,
    },
  )
    .toString()
    .trim()
}

test('Sistemas actúa como un auxiliar y vuelve a su cuenta', async ({ page }) => {
  await login(page, 'admin')
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await page.goto('/admin/usuarios')

  await page.getByTestId('user-aux.verdolago').getByRole('button', { name: 'Actuar como' }).click()
  const confirm = page.getByRole('dialog', { name: '¿Actuar como Auxiliar Verdolago?' })
  await confirm.getByRole('button', { name: 'Actuar como' }).click()

  // Con su identidad: banda visible, su menú (Mis contactos) y sin las secciones de Sistemas.
  const banner = page.getByRole('status').filter({ hasText: 'Actuando como Auxiliar Verdolago (Auxiliar)' })
  await expect(banner).toBeVisible()
  await page.getByRole('button', { name: 'Abrir menú' }).click()
  const menu = page.getByRole('dialog', { name: 'Menú' })
  await expect(menu.getByRole('link', { name: 'Mis contactos' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Usuarios' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cerrar menú' }).last().click()

  const sid = psql(`select id from public.impersonations
    where actor_id = '00000000-0000-4000-8000-000000000001' and ended_at is null`)
  expect(sid).not.toBe('')

  // Volver: sin banda, vuelve el menú de Sistemas y la suplantación queda cerrada en la base.
  await banner.getByRole('button', { name: 'Volver a mi cuenta' }).click()
  await expect(page.getByText('Actuando como')).toHaveCount(0)
  await page.getByRole('button', { name: 'Abrir menú' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Menú' }).getByRole('link', { name: 'Usuarios' }),
  ).toBeVisible()
  expect(psql(`select end_reason from public.impersonations where id = '${sid}'`)).toBe('returned')
})
