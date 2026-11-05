begin;
select plan(5);

select tests.login_as('00000000-0000-4000-8000-000000000004');
select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000501","full_name":"Mio Auxiliar","phone":"73300001"}');
select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000502","full_name":"Repetido Auxiliar","phone":"73300001"}');
select tests.login_as('00000000-0000-4000-8000-000000000005');
select public.submit_capture('{"id":"01900000-0000-7000-8000-000000000503","full_name":"Del Supervisor","phone":"73300003"}');

select tests.login_as('00000000-0000-4000-8000-000000000004');
create temp table r as select public.my_captures((now() at time zone 'America/La_Paz')::date, (now() at time zone 'America/La_Paz')::date) as j;
select ok((select bool_or(x ->> 'full_name' = 'Mio Auxiliar') from r, jsonb_array_elements(r.j) x), 've lo que registró');
select ok((select bool_or(x ->> 'full_name' = 'Repetido Auxiliar' and x ->> 'status' = 'duplicate_rejected') from r, jsonb_array_elements(r.j) x),
  've también los repetidos, marcados');
select ok((select not bool_or(x ->> 'full_name' = 'Del Supervisor') from r, jsonb_array_elements(r.j) x), 'no ve lo de otra persona');
select throws_ok($$ select public.my_captures(current_date, current_date - 1) $$, 'P0001', 'invalid_input', 'rango al revés');
select tests.logout();
select throws_ok($$ select public.my_captures(current_date, current_date) $$, 'P0001', 'forbidden', 'sin sesión no');

select * from finish();
rollback;
