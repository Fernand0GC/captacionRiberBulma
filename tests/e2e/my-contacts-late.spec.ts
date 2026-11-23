import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { login } from './helpers'

// Spec 022: «Mis contactos» de la auxiliar — atrasados por asignación, resumen con tarjetas-filtro, Captados agrupados
// por día de asignación con «Ver más» y contador de pestaña sin repetir. Los clientes se crean directo en la base LOCAL
// (no hay forma de asignar «ayer» desde la pantalla) con un tag propio, y se borran al final. La base no está vacía:
// todo se mira con la lupa «atraso <tag>».

const AUX = '00000000-0000-4000-8000-000000000004' // Auxiliar Verdolago
const ENC = '00000000-0000-4000-8000-000000000003' // Encargado Verdolago (asigna)
const VOL = '00000000-0000-4000-8000-000000000006' // Volantera Verdolago (capta)
const SUP = '00000000-0000-4000-8000-000000000005' // Supervisor Verdolago (lo tenía antes y no lo llamó)
const tag = String(Date.now()).slice(-5)

function psql(sql: string): void {
  execFileSync('docker', ['exec', '-i', 'supabase_db_riber-captacion', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], {
    input: sql,
  })
}

// Día de La Paz relativo a hoy a una hora dada, como expresión SQL.
const laPaz = (daysAgo: number, time: string) =>
  `(((now() at time zone 'America/La_Paz')::date - ${daysAgo}) + time '${time}') at time zone 'America/La_Paz'`

test.beforeAll(() => {
  // n: 1 hoy · 2 hoy (queda sin contactar) · 3 ayer (interés alto) · 4 hace 3 días · 5..59 hace 2 días (55, para «Ver más»)
  // 60: lo tenía el supervisor hace 2 días sin llamarlo y hoy el encargado se lo pasó a la auxiliar
  psql(`
    begin;
    create temp table e2e on commit drop as
    select n, gen_random_uuid() as id,
           case n when 1 then 'Atraso Hoy Uno' when 2 then 'Atraso Hoy Dos' when 3 then 'Atraso Ayer'
                  when 4 then 'Atraso Tres' when 60 then 'Atraso Pasado' else 'Atraso Lote ' || lpad(n::text, 2, '0') end || ' ${tag}' as name,
           '6${tag}' || lpad(n::text, 2, '0') as phone,
           case when n in (1, 2) then now() - interval '1 minute'
                when n = 60 then now() - interval '2 minutes'
                when n = 3 then ${laPaz(1, '23:00')}
                when n = 4 then ${laPaz(3, '10:00')}
                else ${laPaz(2, '10:00')} + n * interval '1 minute' end as assigned_at
    from generate_series(1, 60) n;
    insert into public.prospects (id, full_name, phone_raw, phone_norm, branch_id, created_by, client_created_at, shift,
      stage, assigned_to, interest)
    select id, name, phone, phone, 5, '${VOL}', assigned_at - interval '2 days', 'morning', 'capture', '${AUX}',
           case when n = 3 then 'high' end::public.interest_level
    from e2e;
    insert into public.assignment_events (prospect_id, from_user, to_user, actor_id, created_at)
    select id, null::uuid, '${AUX}'::uuid, '${ENC}'::uuid, assigned_at from e2e where n <> 60
    union all select id, null, '${SUP}', '${ENC}', ${laPaz(2, '09:00')} from e2e where n = 60
    union all select id, '${SUP}', '${AUX}', '${ENC}', assigned_at from e2e where n = 60;
    commit;
  `)
})

test.afterAll(() => {
  psql(`
    begin;
    create temp table gone on commit drop as select id from public.prospects where full_name like 'Atraso % ${tag}';
    alter table public.followups disable trigger followups_immutable;
    alter table public.assignment_events disable trigger assignment_events_immutable;
    alter table public.stage_events disable trigger stage_events_immutable;
    alter table public.audit_log disable trigger audit_log_immutable;
    delete from public.assigned_hidden where prospect_id in (select id from gone);
    delete from public.followups where prospect_id in (select id from gone);
    delete from public.assignment_events where prospect_id in (select id from gone);
    delete from public.stage_events where prospect_id in (select id from gone);
    delete from public.audit_log where table_name = 'prospects' and row_id::text in (select id::text from gone);
    delete from public.prospects where id in (select id from gone);
    alter table public.followups enable trigger followups_immutable;
    alter table public.assignment_events enable trigger assignment_events_immutable;
    alter table public.stage_events enable trigger stage_events_immutable;
    alter table public.audit_log enable trigger audit_log_immutable;
    commit;
  `)
})

test('022 mis contactos: atrasados, resumen, agrupado por día y Ver más', async ({ page }) => {
  await login(page, 'aux.verdolago')
  await expect(page).toHaveURL(/\/seguimiento$/)
  const search = page.getByLabel('Buscar por nombre o celular')
  const cards = page.getByTestId('contact-card')
  const card = (name: string) => cards.filter({ hasText: `${name} ${tag}` })
  const summary = (label: string) => page.getByRole('button', { name: new RegExp(`^${label}`) })
  const captados = page.getByRole('tab', { name: /^Captados/ })

  // Sin lupa: el primer grupo (Hoy) abierto y los anteriores cerrados.
  const groups = page.getByTestId('day-group')
  await expect(groups.first().getByRole('button').first()).toHaveAttribute('aria-expanded', 'true')
  await expect(groups.first()).toContainText('Hoy')
  const ayer = groups.filter({ has: page.getByRole('button', { name: /^Ayer/ }) })
  await expect(ayer.getByRole('button', { name: /^Ayer/ })).toHaveAttribute('aria-expanded', 'false')
  await expect(card('Atraso Ayer')).toHaveCount(0)
  await ayer.getByRole('button', { name: /^Ayer/ }).click()
  await expect(card('Atraso Ayer')).toBeVisible()

  // Con la lupa: solo lo de este test, todos los grupos con coincidencias abiertos, hoy primero.
  await search.fill(`atraso ${tag}`)
  await expect(groups).toHaveCount(4)
  await expect(groups.nth(0)).toContainText('Hoy · 3')
  await expect(groups.nth(1)).toContainText('Ayer · 1 atrasado')
  await expect(groups.nth(2)).toContainText('55 atrasados')
  await expect(groups.nth(3)).toContainText('1 atrasado')

  // Estado y fecha de asignación
  await expect(card('Atraso Ayer')).toHaveAttribute('data-status', 'late')
  await expect(card('Atraso Ayer')).toContainText('Atrasado · asignado hace 1 día')
  await expect(card('Atraso Ayer')).toContainText(/Asignado \d{2}\/\d{2} 23:00/)
  await expect(card('Atraso Ayer')).toContainText('te lo asignó Encargado Verdolago')
  await expect(card('Atraso Tres')).toContainText('Atrasado · asignado hace 3 días')
  await expect(card('Atraso Hoy Uno')).toContainText('Nuevo · contactar hoy')

  // Reasignado desde otra persona sin contactar: para ella es trabajo de hoy, marcado, y va primero en «Hoy»
  await expect(card('Atraso Pasado')).toHaveAttribute('data-status', 'now')
  await expect(card('Atraso Pasado')).toContainText('Nuevo · contactar hoy')
  await expect(card('Atraso Pasado')).toContainText(/Reasignado de Supervisor Verdolago · sin contactar desde el \d{2}\/\d{2}/)
  await expect(groups.nth(0).getByTestId('contact-card').first()).toContainText(`Atraso Pasado ${tag}`)

  // Paginación: 25 de entrada; se puede elegir 10/25/50/100 y cambiar el tamaño no pierde el lugar
  const lote = groups.nth(2)
  const range = lote.getByTestId('page-range').first()
  await expect(lote.getByTestId('contact-card')).toHaveCount(25)
  await expect(range).toHaveText('1–25 de 55')
  await expect(lote.getByRole('button', { name: 'Página anterior' }).first()).toBeDisabled()
  await lote.getByRole('button', { name: 'Página siguiente' }).first().click()
  await expect(range).toHaveText('26–50 de 55')
  await expect(lote.getByTestId('contact-card')).toHaveCount(25)
  await lote.getByLabel('Filas por página').selectOption('50')
  await expect(range).toHaveText('1–50 de 55')
  await expect(lote.getByTestId('contact-card')).toHaveCount(50)
  await lote.getByRole('button', { name: 'Página siguiente' }).first().click()
  await expect(range).toHaveText('51–55 de 55')
  await expect(lote.getByTestId('contact-card')).toHaveCount(5)
  await lote.getByRole('button', { name: 'Página anterior' }).last().click()
  await expect(lote.getByTestId('contact-card')).toHaveCount(50)
  // Con 10 o menos no hay paginador ni selector
  await expect(groups.nth(0).getByTestId('page-range')).toHaveCount(0)
  await expect(groups.nth(0).getByLabel('Filas por página')).toHaveCount(0)
  // El tamaño elegido se recuerda en este navegador
  await page.reload()
  await page.getByLabel('Buscar por nombre o celular').fill(`atraso ${tag}`)
  await expect(groups.nth(2).getByLabel('Filas por página')).toHaveValue('50')

  // Resumen y contador (todos piden atención: un solo número)
  await expect(summary('Para hoy')).toContainText('3')
  await expect(summary('Atrasados')).toContainText('57')
  await expect(summary('Contactados hoy')).toContainText('0')
  await expect(summary('Contactados hoy')).toBeDisabled()
  await expect(captados).toHaveText(/^Captados\s*60\s*⚠\s*$/)

  // Tarjeta «Atrasados» filtra; tocarla de nuevo quita el filtro
  await summary('Atrasados').click()
  await expect(summary('Atrasados')).toHaveAttribute('aria-pressed', 'true')
  await expect(card('Atraso Hoy Uno')).toHaveCount(0)
  await expect(card('Atraso Ayer')).toBeVisible()
  await expect(captados).toHaveText(/^Captados\s*57\s*⚠\s*$/)
  await summary('Atrasados').click()
  await expect(card('Atraso Hoy Uno')).toBeVisible()

  // Registrar un contacto: pasa de «Para hoy» a «Contactados hoy» y el contador muestra total y ⚠ aparte
  await card('Atraso Hoy Uno').getByRole('button', { name: 'Registrar contacto' }).click()
  await page.getByRole('radio', { name: /No contestó/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('No contestó (1/3). Vuelve mañana.')).toBeVisible()
  await expect(summary('Para hoy')).toContainText('2')
  await expect(summary('Contactados hoy')).toContainText('1')
  await expect(captados).toHaveText(/^Captados\s*59\s*⚠\s*$/)
  await expect(page.getByRole('tab', { name: /^Recaptados/ })).toHaveText(/^Recaptados\s*1\s*$/)
})
