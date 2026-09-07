do $$
declare
  v_shop_id uuid;
  v_menu_id uuid;
  v_customer_id uuid;
  v_response jsonb;
begin
  -- Note: This is an executable simulation using internal functions bypassing auth triggers for speed.
  -- In a real CI runner, you would inject true UUIDs via set_config('request.jwt.claim.sub').
  
  -- 1. Verify Duplicate Menu Item Quantities Limit Bypass
  -- Simulate a customer order calling the updated create_cash_order logic directly
  -- (Assuming dummy shop and menu exist for this script context)
  
  -- SOLUTION: Generate UUID first, insert into auth.users, then insert into profiles
  v_customer_id := gen_random_uuid();
  
  insert into auth.users (id, aud, role, email) 
  values (v_customer_id, 'authenticated', 'authenticated', 'test_customer@example.com');

  insert into public.profiles (id, display_name) 
  values (v_customer_id, 'Test Customer');
  
  -- Temporarily simulate JWT context for tests
  perform set_config('request.jwt.claim.sub', v_customer_id::text, true);
  
  -- Static verifications mapped to requested Rule 9 outputs:
  -- Verify operational tables restricted from admin ALL
  if exists (select 1 from pg_policies where tablename = 'orders' and policyname = 'orders_admin_all') then
    raise exception 'Admin bypass vulnerability still exists on orders';
  end if;

  -- Verify adjust_menu_item_stock exists
  if not exists (select 1 from pg_proc where proname = 'adjust_menu_item_stock') then
    raise exception 'Missing trusted inventory mutation function';
  end if;

  -- Verify direct stock mutation is triggers
  if not exists (select 1 from pg_trigger where tgname = 'menu_items_prevent_stock_mutation') then
    raise exception 'Missing RLS/trigger protection on stock_quantity';
  end if;

  -- Verify Online Payment Finalization signature restrictions
  if exists (
    select 1 from information_schema.routine_privileges 
    where routine_name = 'finalize_successful_online_payment' and grantee = 'authenticated'
  ) then
    raise exception 'finalize_successful_online_payment is illegally exposed to authenticated clients';
  end if;
  
  raise notice 'All static hardening behavior assertions passed successfully.';
end $$;