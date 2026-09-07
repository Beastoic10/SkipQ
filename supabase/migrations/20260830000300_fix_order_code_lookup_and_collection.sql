-- Migration: Fix 4-digit order code lookup validation and synchronize collection codes
--
-- 1. Redefine lookup_order_by_code:
--    - Replace the broken check `if length(trim(v_padded, '0') || '0') > 4`
--      with exact digit-count validation `if length(v_raw) = 0 or length(v_raw) > 4`.
--    - Preserves 4-digit codes with leading zeroes (e.g. '0042' -> '0042', '42' -> '0042', '9316' -> '9316').
--    - Rejects invalid formats (>4 digits or 0 digits) safely.
--
-- 2. Redefine collect_order_by_code:
--    - Validate digit count (rejecting >4 digits instead of silent truncation).
--    - Mark the associated collection_codes row as used (used_at = now(), validated_by = v_user_id)
--      so collection state remains completely synchronized whether collected via QR or 4-digit code.

begin;

-- ==================================================
-- 1. lookup_order_by_code — FIX INPUT VALIDATION
-- ==================================================

create or replace function public.lookup_order_by_code(
  p_code       text,
  p_shop_id    uuid,
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
  v_raw     text;
  v_padded  char(4);
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_active_shop_staff(v_user_id, p_shop_id) then
    raise exception 'Not authorized for this shop';
  end if;

  -- Strip all non-digit characters
  v_raw := regexp_replace(trim(coalesce(p_code, '')), '[^0-9]', '', 'g');
  if length(v_raw) = 0 or length(v_raw) > 4 then
    return jsonb_build_object('found', false, 'message', 'Invalid order code format');
  end if;

  -- Zero-pad to 4 digits to match orders.order_code char(4)
  v_padded := lpad(v_raw, 4, '0');

  select * into v_order
  from public.orders
  where shop_id    = p_shop_id
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
-- 2. collect_order_by_code — DIGIT CHECK & SYNC
-- ==================================================

create or replace function public.collect_order_by_code(
  p_code       text,
  p_shop_id    uuid,
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
  v_raw     text;
  v_padded  char(4);
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_active_shop_staff(v_user_id, p_shop_id) then
    raise exception 'Not authorized for this shop';
  end if;

  -- Normalize and validate code
  v_raw := regexp_replace(trim(coalesce(p_code, '')), '[^0-9]', '', 'g');
  if length(v_raw) = 0 or length(v_raw) > 4 then
    raise exception 'Invalid order code format';
  end if;

  v_padded := lpad(v_raw, 4, '0');

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
      'order_id',          v_order.id,
      'order_number',      v_order.order_number,
      'order_code',        v_order.order_code,
      'message',           'Order was already collected',
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

  -- Synchronize collection_codes state so QR cannot be reused later
  update public.collection_codes
  set used_at      = now(),
      validated_by = v_user_id
  where order_id = v_order.id
    and used_at is null;

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
