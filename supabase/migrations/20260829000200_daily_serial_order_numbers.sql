-- Migration: Daily Serial Order Numbers + Terminal Order Lookup Fix
-- 1. Add order_daily_serials counter table
-- 2. Add order_date + daily_serial columns to orders
-- 3. assign_daily_serial() — internal atomic counter
-- 4. Redefine create_cash_order to assign order_date and daily_serial
-- 5. Redefine finalize_successful_online_payment to assign order_date and daily_serial
-- 6. lookup_order_by_daily_serial() — terminal-facing RPC (shop-scoped)
-- 7. collect_order_by_serial() — terminal-facing RPC (Option A: immediate collect)
--
-- NOTE: We cannot use (created_at::date) in an index expression because
-- timestamptz→date is STABLE (timezone-dependent), not IMMUTABLE.
-- Instead we store an explicit order_date date column set at insert time.

begin;

-- ==================================================
-- 1. DAILY SERIAL COUNTER TABLE
-- ==================================================

create table if not exists public.order_daily_serials (
  shop_id   uuid    not null references public.shops(id) on delete cascade,
  order_date date   not null,
  next_serial smallint not null default 1,
  constraint order_daily_serials_pk primary key (shop_id, order_date),
  constraint order_daily_serials_range check (next_serial between 1 and 2001)
);

-- No RLS needed — this table is only touched by security-definer functions.
-- Direct client access is impossible.

-- ==================================================
-- 2. ORDER_DATE + DAILY_SERIAL COLUMNS ON ORDERS
-- ==================================================

-- order_date is set explicitly at insert time (UTC date), so it is a plain
-- date column — fully IMMUTABLE for index expressions.
alter table public.orders
  add column if not exists order_date date;

alter table public.orders
  add column if not exists daily_serial smallint;

-- Partial unique index on the plain date column — no expression cast needed.
create unique index if not exists orders_shop_date_serial_uniq
  on public.orders (shop_id, order_date, daily_serial)
  where daily_serial is not null;

create index if not exists orders_shop_order_date_idx
  on public.orders (shop_id, order_date);

-- ==================================================
-- 3. ASSIGN_DAILY_SERIAL — INTERNAL ATOMIC FUNCTION
-- ==================================================
-- Uses INSERT … ON CONFLICT DO UPDATE in a single atomic statement.
-- Increments next_serial and returns the PREVIOUS value (the one just claimed).
-- Raises an exception if the counter would exceed 2000.

create or replace function public.assign_daily_serial(p_shop_id uuid, p_order_date date)
returns smallint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_serial smallint;
begin
  insert into public.order_daily_serials (shop_id, order_date, next_serial)
  values (p_shop_id, p_order_date, 2) -- first serial is 1, next becomes 2
  on conflict (shop_id, order_date) do update
    set next_serial = order_daily_serials.next_serial + 1
  returning next_serial - 1 into v_serial;

  if v_serial > 2000 then
    raise exception 'Daily order serial limit (2000) reached for this shop today';
  end if;

  return v_serial;
end;
$$;

-- This is internal only — no public/authenticated grant.
revoke all on function public.assign_daily_serial(uuid, date) from public, anon, authenticated;

-- ==================================================
-- 4. REDEFINE create_cash_order WITH SERIAL ASSIGNMENT
-- ==================================================

create or replace function public.create_cash_order(p_shop_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid := extensions.gen_random_uuid();
  v_order_number text := public.make_order_number();
  v_order_date date := current_date;
  v_total numeric(12,2) := 0;
  v_item record;
  v_menu public.menu_items%rowtype;
  v_qty integer;
  v_uni uuid;
  v_cafe uuid;
  v_token text;
  v_serial smallint;
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

  -- Assign daily serial before inserting so we can include both in one statement
  v_serial := public.assign_daily_serial(p_shop_id, v_order_date);

  insert into public.orders(id, order_number, customer_id, university_id, cafeteria_id, shop_id, status, payment_method, total_amount, order_date, daily_serial)
  values (v_order_id, v_order_number, v_user_id, v_uni, v_cafe, p_shop_id, 'PLACED', 'CASH', 0, v_order_date, v_serial);

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
  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'daily_serial', v_serial,
    'collection_token', v_token
  );
end;
$$;

-- ==================================================
-- 5. REDEFINE finalize_successful_online_payment WITH SERIAL ASSIGNMENT
-- ==================================================

create or replace function public.finalize_successful_online_payment(
  p_transaction_ref text,
  p_amount numeric,
  p_currency char(3),
  p_gateway_transaction_id text,
  p_gateway_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payment_attempts%rowtype;
  v_order public.orders%rowtype;
  v_res public.inventory_reservations%rowtype;
  v_token text;
  v_serial smallint;
begin
  select * into v_payment from public.payment_attempts where transaction_ref = p_transaction_ref for update;
  if not found then raise exception 'Payment attempt not found'; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if v_payment.status = 'PAID' then
    return jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'daily_serial', v_order.daily_serial,
      'already_finalized', true
    );
  end if;
  if v_payment.method <> 'ONLINE' or v_payment.provider <> 'SSLCOMMERZ' or v_payment.status <> 'PENDING' then
    raise exception 'Payment attempt is not finalizable';
  end if;
  if v_payment.amount <> p_amount or v_payment.currency <> p_currency then
    raise exception 'Payment amount or currency mismatch';
  end if;
  if v_order.status <> 'PAYMENT_PENDING' then raise exception 'Order is not payment pending'; end if;

  for v_res in select * from public.inventory_reservations where payment_attempt_id = v_payment.id and order_id = v_order.id for update loop
    if v_res.status <> 'ACTIVE' or v_res.expires_at <= now() then raise exception 'Reservation is not active'; end if;
    update public.menu_items set stock_quantity = stock_quantity - v_res.quantity where id = v_res.menu_item_id and stock_quantity >= v_res.quantity;
    if not found then raise exception 'Insufficient stock during finalization'; end if;
    update public.inventory_reservations set status = 'CONSUMED', consumed_at = now() where id = v_res.id;
  end loop;

  update public.payment_attempts
  set status = 'PAID', paid_at = now(), gateway_transaction_id = p_gateway_transaction_id, gateway_metadata = p_gateway_metadata
  where id = v_payment.id;

  -- Assign daily serial atomically before changing status.
  -- Use current_date (the payment finalization date) as the order date.
  v_serial := public.assign_daily_serial(v_order.shop_id, current_date);

  update public.orders set status = 'PLACED', order_date = current_date, daily_serial = v_serial where id = v_order.id;
  insert into public.order_status_events(order_id, previous_status, new_status, actor_user_id, metadata)
  values (v_order.id, 'PAYMENT_PENDING', 'PLACED', null, jsonb_build_object('payment_attempt_id', v_payment.id));
  v_token := public.create_collection_code(v_order.id);
  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'daily_serial', v_serial,
    'collection_token', v_token,
    'already_finalized', false
  );
end;
$$;

-- ==================================================
-- 6. LOOKUP_ORDER_BY_DAILY_SERIAL — TERMINAL RPC
-- ==================================================
-- Returns order metadata for a given serial scoped to the caller's shop.
-- Verifies the caller is active shop staff (terminal or human staff).

create or replace function public.lookup_order_by_daily_serial(
  p_serial integer,
  p_shop_id uuid,
  p_order_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_active_shop_staff(v_user_id, p_shop_id) then
    raise exception 'Not authorized for this shop';
  end if;
  if p_serial < 1 or p_serial > 2000 then
    raise exception 'Serial number must be between 1 and 2000';
  end if;

  select * into v_order
  from public.orders
  where shop_id = p_shop_id
    and daily_serial = p_serial
    and order_date = p_order_date;

  if not found then
    return jsonb_build_object('found', false, 'message', 'No order found with that number today');
  end if;

  return jsonb_build_object(
    'found', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'daily_serial', v_order.daily_serial,
    'status', v_order.status,
    'total_amount', v_order.total_amount,
    'payment_method', v_order.payment_method
  );
end;
$$;

revoke all on function public.lookup_order_by_daily_serial(integer, uuid, date) from public, anon, authenticated;
grant execute on function public.lookup_order_by_daily_serial(integer, uuid, date) to authenticated;

-- ==================================================
-- 7. COLLECT_ORDER_BY_SERIAL — TERMINAL RPC (Option A)
-- ==================================================
-- Immediately marks a READY order as COLLECTED when the operator looks it up by
-- daily serial. No QR token required for this path.

create or replace function public.collect_order_by_serial(
  p_serial integer,
  p_shop_id uuid,
  p_order_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_active_shop_staff(v_user_id, p_shop_id) then
    raise exception 'Not authorized for this shop';
  end if;
  if p_serial < 1 or p_serial > 2000 then
    raise exception 'Serial number must be between 1 and 2000';
  end if;

  -- Lock the order row for update
  select * into v_order
  from public.orders
  where shop_id = p_shop_id
    and daily_serial = p_serial
    and order_date = p_order_date
  for update;

  if not found then
    raise exception 'No order found with that number today';
  end if;

  if v_order.status = 'COLLECTED' then
    return jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'daily_serial', v_order.daily_serial,
      'message', 'Order was already collected',
      'already_collected', true
    );
  end if;

  if v_order.status <> 'READY' then
    raise exception 'Order is not ready for collection (current status: %)', v_order.status;
  end if;

  update public.orders
  set status = 'COLLECTED', collected_at = now()
  where id = v_order.id;

  insert into public.order_status_events(order_id, previous_status, new_status, actor_user_id)
  values (v_order.id, 'READY', 'COLLECTED', v_user_id);

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'daily_serial', v_order.daily_serial,
    'message', 'Order #' || v_order.daily_serial || ' marked as COLLECTED',
    'already_collected', false
  );
end;
$$;

revoke all on function public.collect_order_by_serial(integer, uuid, date) from public, anon, authenticated;
grant execute on function public.collect_order_by_serial(integer, uuid, date) to authenticated;

commit;
