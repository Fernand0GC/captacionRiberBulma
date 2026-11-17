begin;
select plan(6);

select has_column('public', 'profiles', 'ci', 'profiles tiene ci');
select col_is_null('public', 'profiles', 'ci', 'ci es opcional');

update public.profiles set ci = '1234567-1Z' where id = '00000000-0000-4000-8000-000000000005';
select is((select ci from public.profiles where id = '00000000-0000-4000-8000-000000000005'), '1234567-1Z', 'acepta número con complemento');

select throws_ok(
  $$update public.profiles set ci = '1234567-1z' where id = '00000000-0000-4000-8000-000000000006'$$,
  '23514', null, 'rechaza minúsculas (se guarda normalizado)');
select throws_ok(
  $$update public.profiles set ci = '12' where id = '00000000-0000-4000-8000-000000000006'$$,
  '23514', null, 'rechaza CI corto');
select throws_ok(
  $$update public.profiles set ci = '1234567-1Z' where id = '00000000-0000-4000-8000-000000000006'$$,
  '23505', null, 'el CI es único');

select * from finish();
rollback;
