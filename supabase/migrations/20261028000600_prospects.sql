-- Prospectos (captaciones) y eventos de etapa (data-model.md). El campo NO tiene SELECT:
-- inserta solo con la RPC submit_capture. Las políticas de lectura de gestión van en US2/US3.
create table public.prospects (
  id uuid primary key,                                   -- UUID v7 generado en el cliente (idempotencia)
  full_name text not null check (length(trim(full_name)) between 3 and 120),
  phone_raw text not null,
  phone_norm text not null check (public.is_valid_phone(phone_norm)),
  product_id integer references public.products (id),     -- opcional al captar; obligatorio en venta
  channel_id smallint references public.channels (id),    -- canal de la jornada (FR-011b)
  interest public.interest_level,
  occupation text check (occupation is null or length(occupation) <= 120),
  address text check (address is null or length(address) <= 250),
  branch_id smallint not null references public.branches (id),
  created_by uuid not null references public.profiles (id),
  client_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  shift public.shift not null,
  stage public.prospect_stage not null default 'capture',
  stage_changed_at timestamptz not null default now(),
  sold_at timestamptz,
  lost_reason_id smallint references public.lost_reasons (id),
  assigned_to uuid references public.profiles (id),
  next_contact_at timestamptz,
  status public.prospect_status not null default 'active',
  duplicate_of uuid references public.prospects (id),
  late_after_deactivation boolean not null default false,
  void_reason text,
  voided_by uuid references public.profiles (id),
  voided_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  constraint prospects_lost_reason check (stage <> 'lost' or lost_reason_id is not null),
  constraint prospects_sold_at check (stage <> 'sale' or sold_at is not null),
  constraint prospects_sale_product check (stage <> 'sale' or product_id is not null),
  constraint prospects_void check (
    status <> 'voided' or (void_reason is not null and voided_by is not null and voided_at is not null)
  ),
  constraint prospects_duplicate check (status <> 'duplicate_rejected' or duplicate_of is not null)
);

-- Teléfono único global entre prospectos vigentes (FR-016).
create unique index prospects_phone_active_uidx on public.prospects (phone_norm) where status = 'active';
create index prospects_branch_created_idx on public.prospects (branch_id, client_created_at desc);
create index prospects_author_created_idx on public.prospects (created_by, client_created_at);
create index prospects_followup_idx on public.prospects (assigned_to, next_contact_at)
  where status = 'active' and stage in ('capture', 'followup', 'interested');

alter table public.prospects enable row level security;
revoke insert, update, delete on public.prospects from authenticated, anon;

-- Eventos de etapa: solo inserción (constitución III).
create table public.stage_events (
  id bigint generated always as identity primary key,
  prospect_id uuid not null references public.prospects (id),
  from_stage public.prospect_stage,
  to_stage public.prospect_stage not null,
  lost_reason_id smallint references public.lost_reasons (id),
  note text,
  actor_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index stage_events_prospect_idx on public.stage_events (prospect_id, created_at);
create index stage_events_sale_idx on public.stage_events (created_at) where to_stage = 'sale';

alter table public.stage_events enable row level security;
revoke insert, update, delete on public.stage_events from authenticated, anon;

create trigger stage_events_immutable before update or delete on public.stage_events
  for each row execute function public.reject_mutation();
