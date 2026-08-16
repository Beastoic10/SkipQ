-- Corrective Migration: Harden SkipQ MVP
-- 1. Prevent duplicate menu items bypassing limits via JSON array aggregation
-- 2. Protect operational tables from admin bypass (SELECT only)
-- 3. Introduce trusted inventory adjustment operation

begin;

-- ==================================================
-- 1. PREVENT DUPLICATE MENU ITEMS IN ONE ORDER
-- ==================================================

create or replace function public.create_cash_order(p_shop_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  -- Qualified gen_random_uuid
  v_order_id uuid := extensions.gen_random_uuid();
  v_order_number text := public.make_order_number();
  v_total numeric(12,2) := 0;
  v_item record;
  v_menu public.menu_items%rowtype;
  v_qty integer;
  v_uni uuid;
  v_cafe uuid;
  v_token text;
begin
  if v_user_id is null or not public.has_role(v_user_id, 'customer') then
    raise exception 'Only authenticated customers can create orders';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  select c.university_id, s.cafeteria_id into v_uni, v_cafe
  from public.shops s
  join public.cafeterias c on c.id = s.cafeteria_id
  join public.universities u on u.id = c.university_id
  where s.id = p_shop_id and s.is_active and s.approval_status = 'APPROVED'
    and c.is_active and c.approval_status = 'APPROVED' and u.is_active;
  if v_uni is null then raise exception 'Shop is not orderable'; end if;

  insert into public.orders(id, order_number, customer_id, university_id, cafeteria_id, shop_id, status, payment_method, total_amount)
  values (v_order_id, v_order_number, v_user_id, v_uni, v_cafe, p_shop_id, 'PLACED', 'CASH', 0);

  -- Aggregate quantities by menu_item_id to prevent bypass
  for v_item in
    select (value->>'menu_item_id')::uuid as menu_item_id, sum((value->>'quantity')::integer) as quantity
    from jsonb_array_elements(p_items)
    group by 1
  loop
    v_qty := v_item.quantity;
    select * into v_menu from public.menu_items where id = v_item.menu_item_id and shop_id = p_shop_id for update;
    if not found or not v_menu.is_active or not v_menu.is_manually_available then raise exception 'Menu item is unavailable'; end if;
    if v_qty is null or v_qty <= 0 or v_qty > v_menu.max_quantity_per_order then raise exception 'Invalid item quantity'; end if;
    if v_menu.stock_quantity - public.active_reserved_quantity(v_menu.id) < v_qty then raise exception 'Insufficient stock'; end if;
    
    update public.menu_items set stock_quantity = stock_quantity - v_qty where id = v_menu.id;
    insert into public.order_items(order_id, menu_item_id, item_name_snapshot, quantity, unit_price_snapshot, line_total_snapshot)
    values (v_order_id, v_menu.id, v_menu.name, v_qty, v_menu.price, v_qty * v_menu.price);
    
    v_total := v_total + (v_qty * v_menu.price);
  end loop;

  update public.orders set total_amount = v_total where id = v_order_id;
  insert into public.payment_attempts(order_id, method, status, amount, transaction_ref, paid_at)
  values (v_order_id, 'CASH', 'PAID', v_total, 'CASH-' || v_order_number, now());
  insert into public.order_status_events(order_id, previous_status, new_status, actor_user_id)
  values (v_order_id, null, 'PLACED', v_user_id);
  v_token := public.create_collection_code(v_order_id);
  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'collection_token', v_token);
end;
$$;

create or replace function public.create_online_checkout(p_shop_id uuid, p_items jsonb, p_reservation_minutes integer default 15)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  -- Qualified gen_random_uuid
  v_order_id uuid := extensions.gen_random_uuid();
  v_payment_id uuid := extensions.gen_random_uuid();
  v_order_number text := public.make_order_number();
  v_total numeric(12,2) := 0;
  v_item record;
  v_menu public.menu_items%rowtype;
  v_qty integer;
  v_uni uuid;
  v_cafe uuid;
  -- Qualified gen_random_bytes
  v_transaction_ref text := 'SSL-' || upper(encode(extensions.gen_random_bytes(12), 'hex'));
  v_expires_at timestamptz := now() + make_interval(mins => greatest(p_reservation_minutes, 1));
begin
  if v_user_id is null or not public.has_role(v_user_id, 'customer') then raise exception 'Only authenticated customers can create checkouts'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Checkout must contain at least one item'; end if;

  select c.university_id, s.cafeteria_id into v_uni, v_cafe
  from public.shops s join public.cafeterias c on c.id = s.cafeteria_id join public.universities u on u.id = c.university_id
  where s.id = p_shop_id and s.is_active and s.approval_status = 'APPROVED' and c.is_active and c.approval_status = 'APPROVED' and u.is_active;
  if v_uni is null then raise exception 'Shop is not orderable'; end if;

  insert into public.orders(id, order_number, customer_id, university_id, cafeteria_id, shop_id, status, payment_method, total_amount)
  values (v_order_id, v_order_number, v_user_id, v_uni, v_cafe, p_shop_id, 'PAYMENT_PENDING', 'ONLINE', 0);

  -- Aggregate quantities by menu_item_id to prevent bypass
  for v_item in
    select (value->>'menu_item_id')::uuid as menu_item_id, sum((value->>'quantity')::integer) as quantity
    from jsonb_array_elements(p_items)
    group by 1
  loop
    v_qty := v_item.quantity;
    select * into v_menu from public.menu_items where id = v_item.menu_item_id and shop_id = p_shop_id for update;
    if not found or not v_menu.is_active or not v_menu.is_manually_available then raise exception 'Menu item is unavailable'; end if;
    if v_qty is null or v_qty <= 0 or v_qty > v_menu.max_quantity_per_order then raise exception 'Invalid item quantity'; end if;
    if v_menu.stock_quantity - public.active_reserved_quantity(v_menu.id) < v_qty then raise exception 'Insufficient stock'; end if;
    
    insert into public.order_items(order_id, menu_item_id, item_name_snapshot, quantity, unit_price_snapshot, line_total_snapshot)
    values (v_order_id, v_menu.id, v_menu.name, v_qty, v_menu.price, v_qty * v_menu.price);
    insert into public.inventory_reservations(menu_item_id, order_id, payment_attempt_id, quantity, status, expires_at)
    values (v_menu.id, v_order_id, v_payment_id, v_qty, 'ACTIVE', v_expires_at);
    v_total := v_total + (v_qty * v_menu.price);
  end loop;

  update public.orders set total_amount = v_total where id = v_order_id;
  insert into public.payment_attempts(id, order_id, method, provider, status, amount, transaction_ref)
  values (v_payment_id, v_order_id, 'ONLINE', 'SSLCOMMERZ', 'PENDING', v_total, v_transaction_ref);
  insert into public.order_status_events(order_id, previous_status, new_status, actor_user_id)
  values (v_order_id, null, 'PAYMENT_PENDING', v_user_id);
  
  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'payment_attempt_id', v_payment_id, 'transaction_ref', v_transaction_ref, 'amount', v_total, 'expires_at', v_expires_at);
end;
$$;

-- ==================================================
-- 2. PROTECT OPERATIONAL TABLES FROM ADMIN BYPASS
-- ==================================================

drop policy if exists orders_admin_all on public.orders;
create policy orders_admin_select on public.orders for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists order_items_admin_all on public.order_items;
create policy order_items_admin_select on public.order_items for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists order_status_events_admin_insert on public.order_status_events;
create policy order_status_events_admin_select on public.order_status_events for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists payment_attempts_admin_all on public.payment_attempts;
create policy payment_attempts_admin_select on public.payment_attempts for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists inventory_reservations_admin_all on public.inventory_reservations;
create policy inventory_reservations_admin_select on public.inventory_reservations for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists collection_codes_admin_all on public.collection_codes;
create policy collection_codes_admin_select on public.collection_codes for select to authenticated using (public.is_admin(auth.uid()));

-- ==================================================
-- 3. INVENTORY STOCK MUTATION
-- ==================================================

create or replace function public.adjust_menu_item_stock(p_menu_item_id uuid, p_quantity_change integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_menu public.menu_items%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_menu from public.menu_items where id = p_menu_item_id for update;
  if not found then raise exception 'Menu item not found'; end if;
  if not (public.is_admin(v_user_id) or public.is_active_shop_staff(v_user_id, v_menu.shop_id)) then
    raise exception 'Not authorized for this shop';
  end if;
  if v_menu.stock_quantity + p_quantity_change < 0 then raise exception 'Stock cannot become negative'; end if;
  
  update public.menu_items 
  set stock_quantity = stock_quantity + p_quantity_change 
  where id = p_menu_item_id 
  returning stock_quantity into v_menu.stock_quantity;
  
  return v_menu.stock_quantity;
end;
$$;
revoke all on function public.adjust_menu_item_stock(uuid, integer) from public, anon, authenticated;
grant execute on function public.adjust_menu_item_stock(uuid, integer) to authenticated;

create or replace function public.prevent_direct_stock_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Prevent manual updates via REST API; require 'adjust_menu_item_stock' function 
  -- Trust server operations running as db owner (postgres/supabase_admin)
  if current_user not in ('postgres', 'supabase_admin') and new.stock_quantity is distinct from old.stock_quantity then
    raise exception 'Direct stock mutation not allowed. Use adjust_menu_item_stock function.';
  end if;
  return new;
end;
$$;
drop trigger if exists menu_items_prevent_stock_mutation on public.menu_items;
create trigger menu_items_prevent_stock_mutation 
before update on public.menu_items 
for each row execute function public.prevent_direct_stock_update();

commit;