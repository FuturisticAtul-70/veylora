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

alter table public.orders
  add column if not exists invoice_number text,
  add column if not exists invoice_issued_at timestamptz,
  add column if not exists billing_name text,
  add column if not exists billing_email text,
  add column if not exists billing_phone text,
  add column if not exists billing_address jsonb;

update public.orders o
set invoice_number = 'INV-' || o.order_number,
    invoice_issued_at = o.created_at,
    billing_name = coalesce(
      (select a.full_name from public.addresses a where a.id = o.address_id),
      (select p.full_name from public.profiles p where p.id = o.user_id),
      (select nullif(u.raw_user_meta_data ->> 'name', '') from auth.users u where u.id = o.user_id),
      (select split_part(u.email, '@', 1) from auth.users u where u.id = o.user_id),
      'Customer'
    ),
    billing_email = coalesce(
      (select u.email from auth.users u where u.id = o.user_id),
      ''
    ),
    billing_phone = (select a.mobile_number from public.addresses a where a.id = o.address_id),
    billing_address = (
      select jsonb_build_object(
        'line', a.address_line,
        'city', a.city,
        'state', a.state,
        'pincode', a.pincode,
        'landmark', a.landmark
      )
      from public.addresses a
      where a.id = o.address_id
    )
where o.invoice_number is null;

alter table public.orders
  alter column invoice_number set not null,
  alter column invoice_issued_at set not null,
  alter column billing_name set not null,
  alter column billing_email set not null;

create unique index if not exists orders_invoice_number_idx
  on public.orders (invoice_number);

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
