-- Adds a non-mutating terminal lookup step for collection QR credentials.
-- Collection still happens through validate_collection_qr(), preserving the
-- existing trusted, atomic QR collection workflow.

create or replace function public.lookup_collection_qr(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_hash text := public.hash_collection_token(trim(p_token));
  v_code public.collection_codes%rowtype;
  v_order public.orders%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if trim(coalesce(p_token, '')) = '' then
    return jsonb_build_object('found', false, 'message', 'Collection token is required');
  end if;

  select * into v_code
  from public.collection_codes
  where token_hash = v_hash;

  if not found then
    return jsonb_build_object('found', false, 'message', 'Invalid collection code');
  end if;

  if v_code.used_at is not null then
    raise exception 'Collection code already used';
  end if;

  if v_code.expires_at is not null and v_code.expires_at <= now() then
    raise exception 'Collection code expired';
  end if;

  select * into v_order
  from public.orders
  where id = v_code.order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  if not public.is_active_shop_staff(v_user_id, v_order.shop_id) then
    raise exception 'Not authorized for this shop';
  end if;

  if v_order.status = 'COLLECTED' then
    raise exception 'Order is already collected';
  end if;

  if v_order.status <> 'READY' then
    raise exception 'Order is not ready for collection';
  end if;

  return jsonb_build_object(
    'found', true,
    'message', 'Ready for collection',
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'order_code', v_order.order_code,
    'status', v_order.status,
    'total_amount', v_order.total_amount,
    'payment_method', v_order.payment_method
  );
end;
$$;

revoke all on function public.lookup_collection_qr(text) from public, anon, authenticated;
grant execute on function public.lookup_collection_qr(text) to authenticated;
