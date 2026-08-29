-- Migration: Replace daily_serial with 4-digit random order_code
--
-- Changes:
--   1. Drop the order_daily_serials counter table (no longer needed).
--   2. Rename the orders.daily_serial column to orders.order_code (char(4)).
--   3. Replace the sequential-counter approach with a DB-side retry-loop
--      that generates a random 4-digit code (0000-9999) and inserts it
--      directly into orders, relying on a UNIQUE constraint for safety.
--   4. Redefine create_cash_order and finalize_successful_online_payment.
--   5. New RPCs: lookup_order_by_code, collect_order_by_code.
--      collect_order_by_code also sets collected_by (fixes the
--      orders_collected_metadata check constraint violation).
--   6. Drop the old serial-based RPCs.
--
-- Security model preserved:
--   • All RPCs are SECURITY DEFINER; client roles never touch the table directly.
--   • RLS on order_daily_serials is now moot (table dropped).
--   • The new unique index gives DB-level duplicate prevention.
--   • Terminal RPCs verify is_active_shop_staff using auth.uid().

begin;

-- ==================================================
-- 1. DROP THE COUNTER TABLE (no longer needed)
-- ==================================================
-- The sequential counter in order_daily_serials is replaced by a
-- unique-constraint retry loop directly on the orders table.
drop table if exists public.order_daily_serials cascade;

-- ==================================================
-- 2. RENAME daily_serial → order_code (char(4))
--    Drop old indexes, add new ones.
-- ==================================================

-- Drop the old partial unique index on daily_serial
drop index if exists public.orders_shop_date_serial_uniq;

-- Rename the column and change its type
alter table public.orders
  rename column daily_serial to order_code;

alter table public.orders
  alter column order_code type char(4) using
    case
      when order_code is null then null
      else lpad(order_code::text, 4, '0')
    end;

-- New partial unique index: (shop_id, order_date, order_code)
-- order_date is already a plain date column — no expression cast.
create unique index if not exists orders_shop_date_code_uniq
  on public.orders (shop_id, order_date, order_code)
  where order_code is not null;

-- ==================================================
-- 3. ASSIGN_ORDER_CODE — INTERNAL ATOMIC FUNCTION
-- ==================================================
-- Generates a random 4-digit code for the given shop/date.
-- Uses a retry loop (up to 200 attempts) backed by the DB unique
-- constraint, so duplicates are impossible even under concurrency.
-- Returns the assigned code as char(4) (with leading zeros).

-- Drop the old function first
drop function if exists public.assign_daily_serial(uuid, date);

create or replace function public.assign_order_code(p_shop_id uuid, p_order_date date)
returns char(4)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code   char(4);
  v_digits integer;
  v_tries  integer := 0;
begin
  loop
    v_tries := v_tries + 1;
    if v_tries > 200 then
      raise exception 'Could not assign a unique order code after 200 attempts (shop % date %)',
        p_shop_id, p_order_date;
    end if;

    -- Random integer 0..9999, zero-padded to 4 digits
    v_digits := floor(random() * 10000)::integer;
    v_code   := lpad(v_digits::text, 4, '0');

    -- Try to claim this code via a direct insert into a temporary slot
    -- We use an advisory lock keyed on the code+shop+date to serialise
    -- concurrent attempts for the same candidate, then check existence.
    -- The UNIQUE constraint is the true guard; this is just an optimisation.
    begin
      -- Check whether this code is already taken today for this shop.
      -- We do NOT insert here; the caller inserts the full order row.
      -- We return the code and rely on the caller's INSERT to hit the
      -- unique constraint if there is a race. The caller must retry on
      -- unique_violation (23505).
      perform 1
      from public.orders
      where shop_id = p_shop_id
        and order_date = p_order_date
        and order_code = v_code;

      if not found then
        -- Code is available; return it.
        return v_code;
      end if;
      -- Code is taken — try another.
    end;
  end loop;
end;
$$;

revoke all on function public.assign_order_code(uuid, date) from public, anon, authenticated;

-- ==================================================
-- 4. REDEFINE create_cash_order
-- ==================================================
-- Uses a retry loop so that if two concurrent orders pick the same
-- candidate code, the unique constraint on the orders table causes
-- one to retry and get a different code.

create or replace function public.create_cash_order(p_shop_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id    uuid := auth.uid();
  v_order_id   uuid;
  v_order_number text;
  v_order_date date := current_date;
  v_total      numeric(12,2) := 0;
  v_item       record;
  v_menu       public.menu_items%rowtype;
  v_qty        integer;
  v_uni        uuid;
  v_cafe       uuid;
  v_token      text;
  v_code       char(4);
  v_tries      integer := 0;
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

  -- Retry loop to handle the rare case of a concurrent duplicate code
  loop
    v_tries := v_tries + 1;
    if v_tries > 200 then
      raise exception 'Could not assign a unique order code after 200 attempts';
    end if;

    v_order_id     := extensions.gen_random_uuid();
    v_order_number := public.make_order_number();
    v_code         := public.assign_order_code(p_shop_id, v_order_date);

    begin
      insert into public.orders(
        id, order_number, customer_id, university_id, cafeteria_id, shop_id,
        status, payment_method, total_amount, order_date, order_code
      )
      values (
        v_order_id, v_order_number, v_user_id, v_uni, v_cafe, p_shop_id,
        'PLACED', 'CASH', 0, v_order_date, v_code
      );
      -- INSERT succeeded — code is unique
      exit;
    exception
      when unique_violation then
        -- Another concurrent order claimed this code; retry
        continue;
    end;
  end loop;

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
    'order_id',          v_order_id,
    'order_number',      v_order_number,
    'order_code',        v_code,
    'collection_token',  v_token
  );
end;
$$;

-- ==================================================
-- 5. REDEFINE finalize_successful_online_payment
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
  v_order   public.orders%rowtype;
  v_res     public.inventory_reservations%rowtype;
  v_token   text;
  v_code    char(4);
  v_tries   integer := 0;
begin
  select * into v_payment from public.payment_attempts where transaction_ref = p_transaction_ref for update;
  if not found then raise exception 'Payment attempt not found'; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if v_payment.status = 'PAID' then
    return jsonb_build_object(
      'order_id',         v_order.id,
      'order_number',     v_order.order_number,
      'order_code',       v_order.order_code,
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

  -- Assign order code with retry loop
  loop
    v_tries := v_tries + 1;
    if v_tries > 200 then
      raise exception 'Could not assign a unique order code after 200 attempts';
    end if;

    v_code := public.assign_order_code(v_order.shop_id, current_date);

    begin
      update public.orders
      set status = 'PLACED', order_date = current_date, order_code = v_code
      where id = v_order.id;
      exit; -- success
    exception
      when unique_violation then
        continue;
    end;
  end loop;

  insert into public.order_status_events(order_id, previous_status, new_status, actor_user_id, metadata)
  values (v_order.id, 'PAYMENT_PENDING', 'PLACED', null, jsonb_build_object('payment_attempt_id', v_payment.id));
  v_token := public.create_collection_code(v_order.id);
  return jsonb_build_object(
    'order_id',          v_order.id,
    'order_number',      v_order.order_number,
    'order_code',        v_code,
    'collection_token',  v_token,
    'already_finalized', false
  );
end;
$$;

-- ==================================================
-- 6. DROP OLD SERIAL-BASED RPCs
-- ==================================================
drop function if exists public.lookup_order_by_daily_serial(integer, uuid, date);
drop function if exists public.collect_order_by_serial(integer, uuid, date);

-- ==================================================
-- 7. lookup_order_by_code — TERMINAL RPC
-- ==================================================
-- Resolves a 4-digit order code (with or without leading zeros)
-- to order metadata. Scoped strictly to the authenticated user's shop.

create or replace function public.lookup_order_by_code(
  p_code    text,
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
  v_order   public.orders%rowtype;
  v_digits  text;
  v_padded  char(4);
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_active_shop_staff(v_user_id, p_shop_id) then
    raise exception 'Not authorized for this shop';
  end if;

  -- Normalize #9316-style input to the canonical 4-digit representation.
  -- Valid order codes are exactly 0000 through 9999, including leading zeros.
  v_digits := regexp_replace(trim(coalesce(p_code, '')), '[^0-9]', '', 'g');
  if v_digits !~ '^[0-9]{4}$' then
    return jsonb_build_object('found', false, 'message', 'Invalid order code format');
  end if;
  v_padded := v_digits::char(4);

  select * into v_order
  from public.orders
  where shop_id   = p_shop_id
    and order_date = p_order_date
    and order_code = v_padded;

  if not found then
    return jsonb_build_object('found', false, 'message', 'No order found with that code today');
  end if;

  return jsonb_build_object(
    'found',          true,
    'order_id',       v_order.id,
    'order_number',   v_order.order_number,
    'order_code',     v_order.order_code,
    'status',         v_order.status,
    'total_amount',   v_order.total_amount,
    'payment_method', v_order.payment_method
  );
end;
$$;

revoke all on function public.lookup_order_by_code(text, uuid, date) from public, anon, authenticated;
grant execute on function public.lookup_order_by_code(text, uuid, date) to authenticated;

-- ==================================================
-- 8. collect_order_by_code — TERMINAL RPC (Option A)
-- ==================================================
-- Immediately marks a READY order COLLECTED.
-- Sets collected_by to satisfy the orders_collected_metadata check
-- constraint (which requires collected_by is not null when COLLECTED).

create or replace function public.collect_order_by_code(
  p_code    text,
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
  v_order   public.orders%rowtype;
  v_digits  text;
  v_padded  char(4);
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_active_shop_staff(v_user_id, p_shop_id) then
    raise exception 'Not authorized for this shop';
  end if;

  -- Normalize #9316-style input to the canonical 4-digit representation.
  -- Valid order codes are exactly 0000 through 9999, including leading zeros.
  v_digits := regexp_replace(trim(coalesce(p_code, '')), '[^0-9]', '', 'g');
  if v_digits !~ '^[0-9]{4}$' then
    raise exception 'Invalid order code format';
  end if;
  v_padded := v_digits::char(4);

  -- Lock the order row
  select * into v_order
  from public.orders
  where shop_id    = p_shop_id
    and order_date = p_order_date
    and order_code = v_padded
  for update;

  if not found then
    raise exception 'No order found with that code today';
  end if;

  if v_order.status = 'COLLECTED' then
    return jsonb_build_object(
      'order_id',         v_order.id,
      'order_number',     v_order.order_number,
      'order_code',       v_order.order_code,
      'message',          'Order was already collected',
      'already_collected', true
    );
  end if;

  if v_order.status <> 'READY' then
    raise exception 'Order is not ready for collection (current status: %)', v_order.status;
  end if;

  update public.orders
  set status       = 'COLLECTED',
      collected_at = now(),
      collected_by = v_user_id     -- satisfies orders_collected_metadata constraint
  where id = v_order.id;

  insert into public.order_status_events(order_id, previous_status, new_status, actor_user_id)
  values (v_order.id, 'READY', 'COLLECTED', v_user_id);

  return jsonb_build_object(
    'order_id',          v_order.id,
    'order_number',      v_order.order_number,
    'order_code',        v_order.order_code,
    'message',           'Order #' || v_order.order_code || ' marked as COLLECTED',
    'already_collected', false
  );
end;
$$;

revoke all on function public.collect_order_by_code(text, uuid, date) from public, anon, authenticated;
grant execute on function public.collect_order_by_code(text, uuid, date) to authenticated;

commit;
