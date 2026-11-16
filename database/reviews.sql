-- Apply this migration to projects that already have profiles and orders.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id integer not null check (product_id > 0),
  user_id uuid not null references auth.users (id) on delete cascade,
  reviewer_name text not null check (char_length(btrim(reviewer_name)) between 2 and 100),
  rating smallint not null check (rating between 1 and 5),
  review_text text not null default '' check (char_length(review_text) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_product_user_unique unique (product_id, user_id)
);

create index if not exists reviews_product_created_idx
  on public.reviews (product_id, created_at desc);

alter table public.reviews enable row level security;

grant usage on schema public to anon, authenticated;
revoke all on public.reviews from anon, authenticated;
grant select (id, product_id, reviewer_name, rating, review_text, created_at)
  on public.reviews to anon;
grant select (id, product_id, user_id, reviewer_name, rating, review_text, created_at)
  on public.reviews to authenticated;
grant insert (product_id, user_id, reviewer_name, rating, review_text)
  on public.reviews to authenticated;
grant update (reviewer_name, rating, review_text)
  on public.reviews to authenticated;

drop policy if exists "Anyone can view product reviews" on public.reviews;
create policy "Anyone can view product reviews"
  on public.reviews
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Customers can create their own product reviews" on public.reviews;
create policy "Customers can create their own product reviews"
  on public.reviews
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers can update their own product reviews" on public.reviews;
create policy "Customers can update their own product reviews"
  on public.reviews
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.set_review_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at
  before update on public.reviews
  for each row execute procedure public.set_review_updated_at();

notify pgrst, 'reload schema';
