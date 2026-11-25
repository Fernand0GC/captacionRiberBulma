import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { login } from './helpers'

// Spec 028: la Agenda de recontacto refleja los asignados del día. Una auxiliar propia (con tag) en Verdolago recibe
// hoy 2 clientes —uno nuevo y uno con la visita ya pactada en 4 días— y tiene 1 rellamada agendada para hoy desde antes.
// Se borra todo al final.

const ENC = '00000000-0000-4000-8000-000000000003' // Encargado Verdolago (asigna)
const VOL = '00000000-0000-4000-8000-000000000006' // Volantera Verdolago (capta)
const tag = String(Date.now()).slice(-5)
const AUX = `00000000-0000-4000-8000-000028${tag}1`
const aux = `E2E Asignados ${tag}`

function psql(sql: string): void {
  execFileSync('docker', ['exec', '-i', 'supabase_db_riber-captacion', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], {
    input: sql,
  })
}

const laPaz = (days: number, time: string) =>
  `(((now() at time zone 'America/La_Paz')::date + ${days}) + time '${time}') at time zone 'America/La_Paz'`

test.beforeAll(() => {
  psql(`
    begin;
    insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
      ('00000000-0000-0000-0000-000000000000', '${AUX}', 'authenticated', 'authenticated', 'e2e.asg.${tag}@captacion.riberbulma.local', now(), now());
    insert into public.profiles (id, username, full_name, role, branch_id, contract_type, active, deactivated_at) values
      ('${AUX}', 'e2e.asg.${tag}', '${aux}', 'field_assistant', 5, 'permanent', true, null);
    -- 1 nuevo (recibido hoy) · 2 visita en 4 días (recibido hoy) · 3 rellamada de hoy (recibido hace 5 días)
    create temp table e2e on commit drop as
    select n, gen_random_uuid() as id, 'Asignado ' || n || ' ${tag}' as name, '7${tag}' || lpad(n::text, 2, '0') as phone
    from generate_series(1, 3) n;
    insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
      stage, assigned_to, next_contact_at, visit_at, contact_attempts)
    select id, name, phone, phone, 5, '${VOL}', ${laPaz(-6, '09:00')}, 'morning',
           (case n when 1 then 'capture' when 2 then 'followup' else 'recapture' end)::public.prospect_stage, '${AUX}',
           case n when 2 then ${laPaz(4, '10:00')} when 3 then ${laPaz(0, '00:30')} end,
           case n when 2 then ${laPaz(4, '10:00')} end, case n when 3 then 1 else 0 end
    from e2e;
    insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at)
    select id, null, '${AUX}', '${ENC}', case n when 3 then ${laPaz(-5, '10:00')} else ${laPaz(0, '00:10')} end from e2e;
    commit;
  `)
})

test.afterAll(() => {
  psql(`
    begin;
    create temp table gone on commit drop as select id from public.prospects where full_name like 'Asignado % ${tag}';
    alter table public.assignment_events disable trigger assignment_events_immutable;
    alter table public.audit_log disable trigger audit_log_immutable;
    delete from public.assignment_events where prospect_id in (select id from gone);
    delete from public.audit_log where table_name = 'prospects' and row_id::text in (select id::text from gone);
    delete from public.prospects where id in (select id from gone);
    delete from public.audit_log where table_name = 'profiles' and row_id::text = '${AUX}';
    alter table public.assignment_events enable trigger assignment_events_immutable;
    alter table public.audit_log enable trigger audit_log_immutable;
    delete from public.profiles where id = '${AUX}';
    delete from auth.users where id = '${AUX}';
    commit;
  `)
})

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false })

test('028 la agenda muestra los asignados de hoy y lo agendado para más adelante', async ({ page }) => {
  await login(page, 'enc.verdolago')
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await page.goto('/gestion')
  await page.getByRole('button', { name: 'Del día', exact: true }).click()
  const agenda = page.getByTestId('agenda')
  const cells = agenda.getByTestId('agenda-row').filter({ hasText: aux }).locator('td')

  // 0 Asignados hoy · 1 Rellamadas · 2 Le tocaba hoy · 3 Contactó · 4 Pendientes · 5 Atrasados
  await expect(cells.nth(0)).toContainText('2')
  await expect(cells.nth(0)).toContainText('1 para más adelante')
  await expect(cells.nth(1)).toHaveText('1')
  await expect(cells.nth(2)).toHaveText('2')
  await expect(cells.nth(4)).toHaveText('2')
  await expect(cells.nth(5)).toHaveText('0')

  await cells.nth(0).getByRole('button', { name: '1 para más adelante' }).click()
  const dialog = page.getByRole('dialog', { name: `${aux} · Agenda de hoy` })
  await expect(dialog.getByRole('tab', { name: /Para más adelante/ })).toHaveAttribute('aria-selected', 'true')
  const list = dialog.getByTestId('agenda-clients')
  await expect(list).toContainText(`Asignado 2 ${tag}`)
  await expect(list).toContainText('Nuevo para ti · visita')
  await expect(list).not.toContainText(`Asignado 1 ${tag}`)
})
