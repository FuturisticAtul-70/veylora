-- Apply this migration to projects that already have profiles and addresses.
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

notify pgrst, 'reload schema';

-- Confirm the table and the authenticated API permissions exist.
select
  to_regclass('public.orders') as orders_table,
  has_schema_privilege('authenticated', 'public', 'USAGE') as authenticated_schema_access,
  has_table_privilege('authenticated', 'public.orders', 'SELECT') as authenticated_can_read_orders,
  has_table_privilege('authenticated', 'public.orders', 'INSERT') as authenticated_can_create_orders;
