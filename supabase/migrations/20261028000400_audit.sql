-- Auditoría de ediciones (FR-021): solo inserción, guarda solo los campos que cambiaron.
create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id uuid not null,
  actor_id uuid,
  at timestamptz not null default now(),
  old jsonb,
  new jsonb
);
create index audit_log_row_idx on public.audit_log (table_name, row_id, at desc);
alter table public.audit_log enable row level security;
revoke insert, update, delete on public.audit_log from authenticated, anon;

create function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  k text;
  old_diff jsonb := '{}';
  new_diff jsonb := '{}';
begin
  for k in select jsonb_object_keys(n) loop
    if k in ('updated_at', 'updated_by') then continue; end if;
    if (o -> k) is distinct from (n -> k) then
      old_diff := old_diff || jsonb_build_object(k, o -> k);
      new_diff := new_diff || jsonb_build_object(k, n -> k);
    end if;
  end loop;
  if new_diff <> '{}' then
    insert into public.audit_log (table_name, row_id, actor_id, old, new)
    values (tg_table_name, (n ->> 'id')::uuid, auth.uid(), old_diff, new_diff);
  end if;
  return new;
end;
$$;

-- Bloquea UPDATE/DELETE en tablas de eventos (constitución III).
create function public.reject_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'immutable table %', tg_table_name using errcode = '42501';
end;
$$;

create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function public.reject_mutation();
