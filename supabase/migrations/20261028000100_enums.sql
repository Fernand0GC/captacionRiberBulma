-- Enums del dominio (data-model.md §Enums)
create type public.app_role as enum (
  'field_volunteer', 'field_assistant', 'field_supervisor', 'branch_manager', 'general_manager', 'admin'
);
create type public.contract_type as enum ('temporary', 'permanent');
create type public.shift as enum ('morning', 'afternoon');
create type public.interest_level as enum ('high', 'medium', 'low');
create type public.product_line as enum ('phones', 'appliances');            -- CELULARES / ELECTROS (metas)
create type public.product_group as enum ('phones', 'major_appliances', 'small_appliances'); -- Celulares / Electro mayor / Electro menor
create type public.prospect_stage as enum ('capture', 'recapture', 'followup', 'interested', 'sale', 'lost'); -- 1..6 del negocio
create type public.prospect_status as enum ('active', 'voided', 'duplicate_rejected');
create type public.contact_result as enum (
  'no_answer', 'looking_product', 'visit_store', 'call_later', 'very_interested', 'sold', 'not_interested', 'wrong_number'
);
create type public.contact_method as enum ('call', 'message', 'store'); -- llamada, mensaje, atención en tienda
create type public.activity_status as enum ('pending', 'in_progress', 'done', 'blocked', 'cancelled');
