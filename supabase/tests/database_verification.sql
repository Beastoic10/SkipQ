-- SkipQ database verification scenarios.
-- Run against a disposable Supabase/PostgreSQL database after applying migrations.
-- These checks are intentionally SQL-level and should be expanded into pgTAP or CI tests once a local Supabase test harness is added.

begin;

-- Static verification: required enums and tables exist.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then raise exception 'missing order_status enum'; end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'orders') then raise exception 'missing orders table'; end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'inventory_reservations') then raise exception 'missing inventory_reservations table'; end if;
  if not exists (select 1 from pg_proc where proname = 'create_cash_order') then raise exception 'missing create_cash_order function'; end if;
  if not exists (select 1 from pg_proc where proname = 'validate_collection_qr') then raise exception 'missing validate_collection_qr function'; end if;
end $$;

-- Static verification: RLS enabled for application tables.
do $$
declare
  missing_table text;
begin
  select c.relname into missing_table
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in ('profiles','roles','user_roles','universities','cafeterias','shops','shop_staff_memberships','menu_items','orders','order_items','order_status_events','payment_attempts','inventory_reservations','collection_codes')
    and not c.relrowsecurity
  limit 1;
  if missing_table is not null then raise exception 'RLS not enabled for %', missing_table; end if;
end $$;

-- Static verification: unique paid payment attempt constraint exists.
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'payment_attempts_one_paid_per_order') then
    raise exception 'missing one paid payment attempt partial unique index';
  end if;
end $$;

rollback;
