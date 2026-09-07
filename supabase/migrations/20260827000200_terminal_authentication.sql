-- Migration: Implement terminal authentication data model
-- 1. Add 'terminal' role enum value
-- 2. Create terminal_accounts table
-- 3. Create helper functions get_terminal_shop_id and is_active_terminal
-- 4. Update is_active_shop_staff to authorize active terminal accounts

alter type public.role_name add value if not exists 'terminal';

create table if not exists public.terminal_accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references public.profiles(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terminal_accounts_display_name_not_blank check (btrim(display_name) <> '')
);

insert into public.roles(name, description) values
  ('terminal', 'Physical sales terminal account linked to a specific shop')
on conflict (name) do update set description = excluded.description;

create index if not exists terminal_accounts_auth_user_active_idx on public.terminal_accounts(auth_user_id, is_active);
create index if not exists terminal_accounts_shop_active_idx on public.terminal_accounts(shop_id, is_active);

drop trigger if exists terminal_accounts_set_updated_at on public.terminal_accounts;
create trigger terminal_accounts_set_updated_at
  before update on public.terminal_accounts
  for each row execute function public.set_updated_at();

create or replace function public.get_terminal_shop_id(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ta.shop_id
  from public.terminal_accounts ta
  join public.profiles p on p.id = ta.auth_user_id
  where ta.auth_user_id = p_user_id
    and ta.is_active
    and p.is_active
  limit 1;
$$;

create or replace function public.is_active_terminal(p_user_id uuid, p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.terminal_accounts ta
    join public.profiles p on p.id = ta.auth_user_id
    where ta.auth_user_id = p_user_id
      and ta.shop_id = p_shop_id
      and ta.is_active
      and p.is_active
  );
$$;

create or replace function public.is_active_shop_staff(p_user_id uuid, p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_terminal(p_user_id, p_shop_id) or (
    public.has_role(p_user_id, 'shop_staff') and exists (
      select 1
      from public.shop_staff_memberships ssm
      join public.profiles p on p.id = ssm.user_id
      where ssm.user_id = p_user_id
        and ssm.shop_id = p_shop_id
        and ssm.is_active
        and p.is_active
    )
  );
$$;

alter table public.terminal_accounts enable row level security;

drop policy if exists terminal_accounts_select_self_or_admin on public.terminal_accounts;
create policy terminal_accounts_select_self_or_admin on public.terminal_accounts
  for select to authenticated using (auth_user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists terminal_accounts_admin_all on public.terminal_accounts;
create policy terminal_accounts_admin_all on public.terminal_accounts
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

revoke all on function public.get_terminal_shop_id(uuid) from public, anon, authenticated;
revoke all on function public.is_active_terminal(uuid, uuid) from public, anon, authenticated;

grant execute on function public.get_terminal_shop_id(uuid) to authenticated;
grant execute on function public.is_active_terminal(uuid, uuid) to authenticated;
