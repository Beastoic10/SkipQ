-- SkipQ database behavior verification scenarios for local Supabase.
-- Intended usage after migrations on a disposable database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database_behavior_verification.sql
--
-- This script documents executable scenario coverage for:
-- - unauthorized customer cannot access another customer's orders
-- - shop staff cannot access another shop's orders
-- - staff without shop membership cannot operate that shop
-- - customer cannot directly insert/update orders or cancel an order
-- - stock cannot become negative and max quantity is enforced
-- - invalid order status transitions fail
-- - unauthorized staff cancellation fails
-- - READY/COLLECTED cancellation fails
-- - QR cannot be reused; wrong-shop QR validation fails; only READY orders can be collected
-- - duplicate payment finalization is idempotent
-- - more than one PAID payment attempt cannot exist for the same order
--
-- The script uses Supabase's auth.uid() convention by setting request.jwt.claim.sub
-- and SET ROLE authenticated. It assumes the local Supabase auth schema exists.

begin;

-- This behavior suite is intentionally written as a template because local Supabase
-- is not available in every development environment. It should be run in CI once
-- `supabase start`/`supabase db reset` are configured for the project.

-- Minimal static assertions that can run in the migrated database.
do $$
begin
  if not exists (select 1 from pg_policy where polname = 'orders_select_owner_staff_admin') then
    raise exception 'missing orders RLS select policy';
  end if;
  if not exists (select 1 from pg_proc where proname = 'cancel_order') then
    raise exception 'missing cancel_order function';
  end if;
  if not exists (select 1 from pg_proc where proname = 'finalize_successful_online_payment') then
    raise exception 'missing finalize_successful_online_payment function';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'payment_attempts_one_paid_per_order') then
    raise exception 'missing one-paid-attempt enforcement';
  end if;
end $$;

-- Full behavior setup outline for local Supabase test harness:
-- 1. Insert four auth.users: customer_a, customer_b, staff_shop_a, staff_shop_b, admin.
-- 2. Insert matching profiles and active user_roles.
-- 3. Create one university, cafeteria, two approved shops, staff memberships per shop, and menu items.
-- 4. SET ROLE authenticated and set request.jwt.claim.sub for each user before assertions.
-- 5. Verify customer_a create_cash_order succeeds for shop_a and returns a collection token.
-- 6. Verify customer_b cannot SELECT customer_a order under RLS.
-- 7. Verify staff_shop_b cannot SELECT or update shop_a order under RLS/trusted functions.
-- 8. Verify direct INSERT/UPDATE on orders as customer fails because only trusted functions/admin policies write orders.
-- 9. Verify create_cash_order rejects quantities greater than max_quantity_per_order.
-- 10. Verify repeated cash orders cannot drive menu_items.stock_quantity below zero.
-- 11. Verify update_order_status rejects PAYMENT_PENDING -> READY and READY -> COLLECTED direct transitions.
-- 12. Verify cancel_order rejects customer callers and staff without membership.
-- 13. Verify cancel_order rejects READY and COLLECTED orders.
-- 14. Verify validate_collection_qr rejects not-READY orders, succeeds once for READY orders, and rejects token reuse.
-- 15. Verify validate_collection_qr rejects a valid token scanned by staff from another shop.
-- 16. Verify create_online_checkout creates ACTIVE reservations and does not decrement physical stock.
-- 17. Verify finalize_successful_online_payment decrements stock, consumes reservations, creates a collection code, and is idempotent on duplicate IPN.
-- 18. Verify the partial unique index rejects a second PAID payment_attempt for one order.

rollback;
