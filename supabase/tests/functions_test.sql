begin;
select plan(18);

select is(public.normalize_phone('+591 7123-4567'), '71234567', '+591 con espacios y guion');
select is(public.normalize_phone('591 71234567'), '71234567', 'prefijo 591 sin +');
select is(public.normalize_phone('071234567'), '71234567', 'cero inicial');
select is(public.normalize_phone('7 1 2 3 4 5 6 7'), '71234567', 'espacios');
select is(public.normalize_phone('3-462-1234'), '34621234', 'fijo con código de área');
select ok(public.is_valid_phone('71234567'), 'celular 7xxxxxxx válido');
select ok(public.is_valid_phone('+591 61234567'), 'celular 6xxxxxxx con prefijo válido');
select ok(public.is_valid_phone('4621234'), 'fijo de 7 dígitos válido');
select ok(public.is_valid_phone('51234567'), 'celular 5xxxxxxx válido');
select ok(not public.is_valid_phone('81234567'), 'empieza con 8: inválido');
select ok(not public.is_valid_phone('7123456'), 'celular de 7 dígitos: inválido');
select ok(not public.is_valid_phone(''), 'vacío: inválido');

select is(public.shift_for('2026-10-28 12:59:00-04'), 'morning'::public.shift, '12:59 La Paz = mañana');
select is(public.shift_for('2026-10-28 13:00:00-04'), 'afternoon'::public.shift, '13:00 La Paz = tarde');
select is(public.shift_for('2026-10-28 16:30:00+00'), 'morning'::public.shift, '16:30 UTC = 12:30 La Paz = mañana');

select is((select count(*) from public.products)::int, 57, 'catálogo: Celulares + 26 electro mayor + 30 electro menor');
select is((select line from public.products where name = 'Licuadora'), 'appliances'::public.product_line, 'electro menor cuenta como ELECTROS para metas');
select is((select line from public.products where name = 'Celulares'), 'phones'::public.product_line, 'Celulares cuenta como CELULARES');

select * from finish();
rollback;
