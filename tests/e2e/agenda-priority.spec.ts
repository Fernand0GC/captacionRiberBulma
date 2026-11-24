import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { login } from './helpers'

// Spec 026: desglose de Atrasados y «Poner para hoy» desde el detalle de la «Agenda de recontacto» («Del día»).
// La base local no está vacía: se crean dos auxiliares propias (Origen y Destino, con un tag) en Verdolago, con dos
// atrasados de Origen —uno nunca contactado asignado hace 10 días y uno agendado ayer—, y se borra todo al final.

const ENC = '00000000-0000-4000-8000-000000000003' // Encargado Verdolago (asigna)
const VOL = '00000000-0000-4000-8000-000000000006' // Volantera Verdolago (capta)
const tag = String(Date.now()).slice(-5)
const ORIGEN = `00000000-0000-4000-8000-000026${tag}1`
const DESTINO = `00000000-0000-4000-8000-000026${tag}2`
const origen = `E2E Origen ${tag}`
const destino = `E2E Destino ${tag}`

function psql(sql: string): void {
  execFileSync('docker', ['exec', '-i', 'supabase_db_riber-captacion', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], {
    input: sql,
  })
}

const laPaz = (daysAgo: number, time: string) =>
  `(((now() at time zone 'America/La_Paz')::date - ${daysAgo}) + time '${time}') at time zone 'America/La_Paz'`

test.beforeAll(() => {
  psql(`
    begin;
    insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
      ('00000000-0000-0000-0000-000000000000', '${ORIGEN}', 'authenticated', 'authenticated', 'e2e.origen.${tag}@captacion.riberbulma.local', now(), now()),
      ('00000000-0000-0000-0000-000000000000', '${DESTINO}', 'authenticated', 'authenticated', 'e2e.destino.${tag}@captacion.riberbulma.local', now(), now());
    insert into public.profiles (id, username, full_name, role, branch_id, contract_type, active, deactivated_at) values
      ('${ORIGEN}', 'e2e.origen.${tag}', '${origen}', 'field_assistant', 5, 'permanent', true, null),
      ('${DESTINO}', 'e2e.destino.${tag}', '${destino}', 'field_assistant', 5, 'permanent', true, null);
    create temp table e2e on commit drop as
    select n, gen_random_uuid() as id, 'Prioridad ' || n || ' ${tag}' as name, '6${tag}' || lpad(n::text, 2, '0') as phone
    from generate_series(1, 2) n;
    insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
      stage, assigned_to, next_contact_at, contact_attempts)
    select id, name, phone, phone, 5, '${VOL}', ${laPaz(12, '09:00')}, 'morning',
           case n when 1 then 'capture' else 'recapture' end::public.prospect_stage, '${ORIGEN}',
           case n when 2 then ${laPaz(1, '09:00')} end, case n when 1 then 0 else 1 end
    from e2e;
    insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at)
    select id, null, '${ORIGEN}', '${ENC}', case n when 1 then ${laPaz(10, '10:00')} else ${laPaz(3, '10:00')} end from e2e;
    commit;
  `)
})

test.afterAll(() => {
  psql(`
    begin;
    create temp table gone on commit drop as select id from public.prospects where full_name like 'Prioridad % ${tag}';
    alter table public.assignment_events disable trigger assignment_events_immutable;
    alter table public.audit_log disable trigger audit_log_immutable;
    delete from public.assignment_events where prospect_id in (select id from gone);
    delete from public.audit_log where table_name = 'prospects' and row_id::text in (select id::text from gone);
    delete from public.contact_priorities where prospect_id in (select id from gone);
    delete from public.prospects where id in (select id from gone);
    delete from public.audit_log where table_name = 'profiles' and row_id::text in ('${ORIGEN}', '${DESTINO}');
    alter table public.assignment_events enable trigger assignment_events_immutable;
    alter table public.audit_log enable trigger audit_log_immutable;
    delete from public.profiles where id in ('${ORIGEN}', '${DESTINO}');
    delete from auth.users where id in ('${ORIGEN}', '${DESTINO}');
    commit;
  `)
})

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false })

test('026 desglose de atrasados y «Poner para hoy» en la agenda', async ({ page }) => {
  await login(page, 'enc.verdolago')
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await page.goto('/gestion')
  await page.getByRole('button', { name: 'Del día', exact: true }).click()
  const agenda = page.getByTestId('agenda')
  const rowOf = (name: string) => agenda.getByTestId('agenda-row').filter({ hasText: name })
  const cells = (name: string) => rowOf(name).locator('td')
  await expect(cells(origen).nth(3)).toHaveText('2')

  await rowOf(origen).getByRole('button', { name: origen }).click()
  const dialog = page.getByRole('dialog', { name: `${origen} · Agenda de hoy` })
  await dialog.getByRole('tab', { name: /^Atrasados/ }).click()

  // A7: el desglose cuenta por antigüedad y por tipo.
  const filters = dialog.getByTestId('late-filters')
  await expect(filters.getByRole('button', { name: '1 día 1' })).toBeVisible()
  await expect(filters.getByRole('button', { name: 'Más de 7 días 1' })).toBeVisible()
  await expect(filters.getByRole('button', { name: 'Nunca contactado 1' })).toBeVisible()
  await expect(filters.getByRole('button', { name: 'Fecha vencida 1' })).toBeVisible()
  await filters.getByRole('button', { name: 'Más de 7 días 1' }).click()
  await expect(dialog.getByTestId('agenda-clients').getByRole('listitem')).toHaveCount(1)
  await expect(dialog.getByText('Atrasado · asignado hace 10 días')).toBeVisible()

  // B7: «Poner para hoy» sobre lo filtrado; sigue con la misma persona.
  await dialog.getByRole('button', { name: 'Seleccionar' }).click()
  await dialog.getByRole('checkbox', { name: `Seleccionar Prioridad 1 ${tag}` }).check()
  await dialog.getByRole('button', { name: 'Poner para hoy' }).click()
  await expect(page.getByText(`✓ 1 cliente queda como prioridad de hoy para ${origen}`)).toBeVisible()

  // B2: pasa a Pendientes con el atraso a la vista; la tabla lo cuenta como prioridad.
  await dialog.getByRole('tab', { name: /^Pendientes/ }).click()
  await expect(dialog.getByText('Prioridad de hoy · atrasado 10 días')).toBeVisible()
  await expect(dialog.getByTestId('priority-badge')).toBeVisible()
  await expect(cells(origen).nth(2)).toContainText('★ 1 prioridad')
  await expect(cells(origen).nth(3)).toHaveText('1')

  // B8: se puede quitar el mismo día y vuelve a Atrasados.
  await dialog.getByRole('button', { name: 'Quitar prioridad de hoy' }).click()
  await expect(page.getByText('✓ Prioridad quitada')).toBeVisible()
  await expect(cells(origen).nth(3)).toHaveText('2')
})
