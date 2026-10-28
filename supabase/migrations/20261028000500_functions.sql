-- Teléfono (research R10) y turno (R12).
create function public.normalize_phone(p text) returns text
language sql immutable set search_path = '' as $$
  select case
    when d ~ '^591[0-9]{7,8}$' then substr(d, 4)
    else d
  end
  from (select ltrim(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), '0') as d) x
$$;

create function public.is_valid_phone(p text) returns boolean
language sql immutable set search_path = '' as $$
  select public.normalize_phone(p) ~ '^([67][0-9]{7}|[234][0-9]{6,7})$'
$$;

create function public.shift_for(ts timestamptz) returns public.shift
language sql stable set search_path = '' as $$
  select case
    when (ts at time zone 'America/La_Paz')::time
         < coalesce((select (s.value #>> '{}')::time from public.settings s where s.key = 'shift_cutoff'), '13:00'::time)
    then 'morning'::public.shift
    else 'afternoon'::public.shift
  end
$$;
