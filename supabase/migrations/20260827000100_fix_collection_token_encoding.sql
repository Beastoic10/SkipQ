-- Fix base64url encoding issue in create_collection_code

create or replace function public.create_collection_code(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
begin
  -- Qualified gen_random_bytes
  -- Replaced 'base64url' with 'hex' because PostgreSQL encode() doesn't support base64url natively
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.collection_codes(order_id, token_hash)
  values (p_order_id, public.hash_collection_token(v_token));
  return v_token;
end;
$$;
