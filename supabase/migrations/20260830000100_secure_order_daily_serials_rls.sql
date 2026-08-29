-- Corrective migration: Lock down public.order_daily_serials
--
-- Problem: The table was created without RLS enabled, meaning PostgREST
-- exposes it to any authenticated (or anon) client with SELECT/INSERT/UPDATE.
--
-- Solution:
--   1. Enable RLS — default-deny all direct client access.
--   2. Revoke any implicit grants from the public/anon/authenticated roles.
--   3. Add NO permissive policies — the table is only ever touched by
--      SECURITY DEFINER functions (assign_daily_serial), which run as the
--      function owner (postgres) and are exempt from RLS by design.
--
-- Result:
--   • No client (customer, terminal, anon) can SELECT/INSERT/UPDATE/DELETE.
--   • create_cash_order() and finalize_successful_online_payment() continue
--     to work unchanged because assign_daily_serial() is SECURITY DEFINER.

begin;

-- 1. Enable Row-Level Security (default-deny for all roles).
alter table public.order_daily_serials enable row level security;

-- 2. Force RLS even for the table owner when accessed directly.
--    (Prevents accidental owner-bypass via PostgREST service-role key.)
alter table public.order_daily_serials force row level security;

-- 3. Revoke all direct table privileges from client-facing roles.
revoke all privileges on table public.order_daily_serials from anon, authenticated, public;

-- No SELECT/INSERT/UPDATE/DELETE policies are created.
-- The table is intentionally opaque to all PostgREST clients.
-- Only SECURITY DEFINER functions (assign_daily_serial) may access it.

commit;
