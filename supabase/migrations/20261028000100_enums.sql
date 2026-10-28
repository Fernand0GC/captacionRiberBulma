-- Enums del dominio (data-model.md §Enums)
create type public.app_role as enum (
  'field_volunteer', 'field_assistant', 'field_supervisor', 'branch_manager', 'general_manager', 'admin'
);
create type public.contract_type as enum ('temporary', 'permanent');
create type public.shift as enum ('morning', 'afternoon');
create type public.interest_level as enum ('high', 'medium', 'low');
create type public.product_line as enum ('phones', 'appliances');            -- CELULARES / ELECTROS (metas)
create type public.product_group as enum ('phones', 'major_appliances', 'small_appliances'); -- Celulares / Electro mayor / Electro menor
create type public.prospect_stage as enum ('capture', 'followup', 'interested', 'sale', 'lost');
create type public.prospect_status as enum ('active', 'voided', 'duplicate_rejected');
create type public.contact_result as enum (
  'interested', 'not_interested', 'no_answer', 'wrong_number', 'visit_confirmed', 'negotiating',
  'pending_reply', 'replied', 'waiting_client', 'referred', 'no_result'
);
create type public.activity_status as enum ('pending', 'in_progress', 'done', 'blocked', 'cancelled');
