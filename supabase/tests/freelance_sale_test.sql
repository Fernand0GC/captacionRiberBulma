begin;
select plan(13);

-- Spec 033: registro con canal Freelance entra directo como venta, a cargo de quien registra.
-- Usuarios del seed: 4 aux.verdolago (sucursal 5), 6 vol.verdolago (5).
create temp table k as
select (select id from public.products where active order by id limit 1) as product,
       (select id from public.channels where name = 'Freelance') as channel,
       '7' || lpad((floor(random() * 1e7))::int::text, 7, '0') as phone1,
       '6' || lpad((floor(random() * 1e7))::int::text, 7, '0') as phone2,
       '7' || lpad((floor(random() * 1e7))::int::text, 7, '0') as phone3;
grant select on k to authenticated;

create function pg_temp.cap(p_phone text, extra jsonb) returns jsonb
language sql as $$
  select jsonb_build_object('id', gen_random_uuid(), 'full_name', 'Cliente Freelance Prueba', 'phone', p_phone,
    'channel_id', (select channel from k), 'client_created_at', now()) || extra
$$;
grant execute on function pg_temp.cap(text, jsonb) to authenticated;

create function pg_temp.try(p jsonb) returns text
language plpgsql as $$
declare v_detail text;
begin
  perform public.submit_capture(p);
  return 'ok';
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return sqlerrm || ':' || coalesce(v_detail, '');
end $$;
grant execute on function pg_temp.try(jsonb) to authenticated;

-- Lee el cliente por teléfono (prospects solo por RPC con sesión).
create function pg_temp.pr(p_phone text) returns public.prospects
language sql security definer as $$
  select * from public.prospects where phone_norm = public.normalize_phone(p_phone) and status = 'active'
$$;
grant execute on function pg_temp.pr(text) to authenticated;

-- Criterio 5: validaciones -------------------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000004');
select is(pg_temp.try(pg_temp.cap((select phone1 from k), jsonb_build_object('sold', true,
  'referrer_new', jsonb_build_object('name', 'Freelancer Prueba Uno', 'kind', 'freelance')))),
  'invalid_input:product_id', '5. venta sin producto se rechaza');
select is(pg_temp.try(pg_temp.cap((select phone1 from k), jsonb_build_object('sold', true,
  'product_id', (select product from k)))),
  'invalid_input:referrer', '5. venta sin freelancer se rechaza');

-- Criterio 5: venta directa con freelancer nuevo -----------------------------------------------------------------
select is(pg_temp.try(pg_temp.cap((select phone1 from k), jsonb_build_object('sold', true,
  'product_id', (select product from k),
  'referrer_new', jsonb_build_object('name', 'Freelancer Prueba Uno', 'kind', 'freelance')))),
  'ok', '5. venta con producto y freelancer se guarda');
select tests.logout();
select is((pg_temp.pr((select phone1 from k))).stage::text, 'sale', '5. entra en etapa venta');
select ok((pg_temp.pr((select phone1 from k))).sold_at is not null, '5. con fecha de venta');
select is((pg_temp.pr((select phone1 from k))).assigned_to, '00000000-0000-4000-8000-000000000004'::uuid,
  '5. a cargo de quien registra');
select is((select r.kind from public.referrers r where r.id = (pg_temp.pr((select phone1 from k))).referrer_id),
  'freelance', '5. el freelancer nuevo queda con tipo freelance');
select is((select count(*)::int from public.stage_events e
  where e.prospect_id = (pg_temp.pr((select phone1 from k))).id and e.from_stage = 'capture' and e.to_stage = 'sale'
    and e.note = 'Venta directa (freelancer)'), 1, '5. historial capture → sale con su nota');
select is((select count(*)::int from public.assignment_events e
  where e.prospect_id = (pg_temp.pr((select phone1 from k))).id
    and e.to_user = '00000000-0000-4000-8000-000000000004'), 1, '5. historial de asignación a quien registra');

-- La volantera también: queda a su cargo -------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000006');
select is(pg_temp.try(pg_temp.cap((select phone2 from k), jsonb_build_object('sold', true,
  'product_id', (select product from k),
  'referrer_id', (select r.id from public.referrers r where r.branch_id = 5 and r.name = 'Freelancer Prueba Uno')))),
  'ok', '5. la volantera registra una venta con un freelancer de la lista');
select tests.logout();
select is((pg_temp.pr((select phone2 from k))).assigned_to, '00000000-0000-4000-8000-000000000006'::uuid,
  '5. la venta de la volantera queda a su cargo');

-- Criterio 6: sin sold, igual que antes --------------------------------------------------------------------------
select tests.login_as('00000000-0000-4000-8000-000000000004');
select is(pg_temp.try(pg_temp.cap((select phone3 from k), '{}'::jsonb)), 'ok', '6. captación normal se guarda');
select tests.logout();
select is((pg_temp.pr((select phone3 from k))).stage::text, 'capture', '6. sin sold queda en captación');

select * from finish();
rollback;
