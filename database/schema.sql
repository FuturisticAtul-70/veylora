-- Supabase Auth manages credentials in auth.users. This table stores customer
-- profile data separately and is populated by the trigger below.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 100),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

drop policy if exists "Customers can view their own profile" on public.profiles;
create policy "Customers can view their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Customers can update their own profile" on public.profiles;
create policy "Customers can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.create_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do update
    set full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_customer_profile();

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 100),
  mobile_number text not null check (mobile_number ~ '^[6-9][0-9]{9}$'),
  address_line text not null check (char_length(btrim(address_line)) between 6 and 300),
  city text not null check (char_length(btrim(city)) between 2 and 100),
  state text not null check (char_length(btrim(state)) between 2 and 100),
  pincode text not null check (pincode ~ '^[0-9]{6}$'),
  landmark text check (landmark is null or char_length(landmark) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists addresses_user_created_idx
  on public.addresses (user_id, created_at desc);

alter table public.addresses enable row level security;

grant select, insert, update, delete on public.addresses to authenticated;

drop policy if exists "Customers can view their own addresses" on public.addresses;
create policy "Customers can view their own addresses"
  on public.addresses
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Customers can create their own addresses" on public.addresses;
create policy "Customers can create their own addresses"
  on public.addresses
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers can update their own addresses" on public.addresses;
create policy "Customers can update their own addresses"
  on public.addresses
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers can delete their own addresses" on public.addresses;
create policy "Customers can delete their own addresses"
  on public.addresses
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_address_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_addresses_updated_at on public.addresses;
create trigger set_addresses_updated_at
  before update on public.addresses
  for each row execute procedure public.set_address_updated_at();

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  address_id uuid references public.addresses (id) on delete set null,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  total_price numeric(12, 2) not null check (total_price > 0),
  payment_method text not null check (payment_method in ('COD', 'UPI')),
  payment_status text not null check (payment_status in ('Awaiting verification', 'Pay on delivery', 'Paid')),
  utr text,
  status text not null default 'Placed' check (
    status in ('Placed', 'Confirmed', 'Packed', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_utr_check check (
    (payment_method = 'UPI' and utr is not null and utr ~ '^[0-9]{12}$')
    or (payment_method = 'COD' and utr is null)
  )
);

create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;

grant usage on schema public to authenticated;
grant select, insert on public.orders to authenticated;

drop policy if exists "Customers can view their own orders" on public.orders;
create policy "Customers can view their own orders"
  on public.orders
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Customers can create their own orders" on public.orders;
create policy "Customers can create their own orders"
  on public.orders
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.set_order_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
  before update on public.orders
  for each row execute procedure public.set_order_updated_at();
