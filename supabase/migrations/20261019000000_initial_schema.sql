create extension if not exists pgcrypto with schema extensions;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  vat_number text not null default '',
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  notes text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid,
  quote_number text not null,
  description text not null check (char_length(description) between 1 and 500),
  hours numeric(12, 2) not null check (hours >= 0),
  hourly_rate numeric(12, 2) not null check (hourly_rate >= 0),
  call_out_fee numeric(12, 2) not null default 0 check (call_out_fee >= 0),
  vat_rate numeric(5, 2) not null default 13.5 check (vat_rate between 0 and 100),
  materials jsonb not null default '[]'::jsonb check (jsonb_typeof(materials) = 'array'),
  materials_markup numeric(7, 2) not null default 15 check (materials_markup >= 0),
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  vat_amount numeric(14, 2) not null check (vat_amount >= 0),
  total numeric(14, 2) not null check (total >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, quote_number),
  foreign key (business_id, client_id)
    references public.clients(business_id, id)
    on delete set null (client_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'inactive'
    check (status in (
      'inactive', 'active', 'trialing', 'past_due', 'unpaid',
      'canceled', 'incomplete', 'incomplete_expired', 'paused'
    )),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_business_created_idx
  on public.clients (business_id, created_at desc)
  where archived_at is null;
create index quotes_business_created_idx
  on public.quotes (business_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();
create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();
create trigger quotes_set_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_name text;
begin
  business_name := nullif(
    left(trim(coalesce(new.raw_user_meta_data ->> 'business_name', '')), 120),
    ''
  );

  insert into public.businesses (owner_id, name, email)
  values (new.id, coalesce(business_name, 'My Trade Business'), coalesce(new.email, ''))
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'platform_admin') = 'true', false);
$$;

create or replace function public.protect_business_suspension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_suspended is distinct from old.is_suspended
     and not public.is_platform_admin() then
    raise exception 'Only a platform administrator can change account suspension.';
  end if;
  return new;
end;
$$;

create trigger businesses_protect_suspension
before update on public.businesses
for each row execute function public.protect_business_suspension();

create or replace function public.set_business_suspension(
  p_business_id uuid,
  p_suspended boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform owner access is required.';
  end if;
  update public.businesses
  set is_suspended = p_suspended
  where id = p_business_id;
  if not found then
    raise exception 'Business account was not found.';
  end if;
end;
$$;

create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
  from public.businesses b
  where b.owner_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.has_active_subscription()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    join public.subscriptions s on s.business_id = b.id
    where b.owner_id = (select auth.uid())
      and not b.is_suspended
      and s.status in ('active', 'trialing')
  );
$$;

alter table public.businesses enable row level security;
alter table public.clients enable row level security;
alter table public.quotes enable row level security;
alter table public.subscriptions enable row level security;

create policy "Owners and platform admins can read business accounts"
on public.businesses for select to authenticated
using (owner_id = (select auth.uid()) or (select public.is_platform_admin()));

create policy "Users can create their own business account"
on public.businesses for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "Owners can update their own business profile"
on public.businesses for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners can read their active-subscription clients"
on public.clients for select to authenticated
using (
  business_id = (select public.current_business_id())
  and (select public.has_active_subscription())
);

create policy "Owners can create their active-subscription clients"
on public.clients for insert to authenticated
with check (
  business_id = (select public.current_business_id())
  and (select public.has_active_subscription())
);

create policy "Owners can update their active-subscription clients"
on public.clients for update to authenticated
using (
  business_id = (select public.current_business_id())
  and (select public.has_active_subscription())
)
with check (
  business_id = (select public.current_business_id())
  and (select public.has_active_subscription())
);

create policy "Owners can delete their active-subscription clients"
on public.clients for delete to authenticated
using (
  business_id = (select public.current_business_id())
  and (select public.has_active_subscription())
);

create policy "Owners can read their active-subscription quotes"
on public.quotes for select to authenticated
using (
  business_id = (select public.current_business_id())
  and (select public.has_active_subscription())
);

create policy "Owners can create their active-subscription quotes"
on public.quotes for insert to authenticated
with check (
  business_id = (select public.current_business_id())
  and (select public.has_active_subscription())
);

create policy "Owners can update their active-subscription quotes"
on public.quotes for update to authenticated
using (
  business_id = (select public.current_business_id())
  and (select public.has_active_subscription())
)
with check (
  business_id = (select public.current_business_id())
  and (select public.has_active_subscription())
);

create policy "Owners can delete their active-subscription quotes"
on public.quotes for delete to authenticated
using (
  business_id = (select public.current_business_id())
  and (select public.has_active_subscription())
);

create policy "Owners and platform admins can read subscription status"
on public.subscriptions for select to authenticated
using (
  business_id = (select public.current_business_id())
  or (select public.is_platform_admin())
);

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
grant select, insert, update on public.businesses to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.quotes to authenticated;
revoke all on function public.set_business_suspension(uuid, boolean) from public, anon;
revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.current_business_id() from public, anon;
revoke all on function public.has_active_subscription() from public, anon;
grant execute on function public.set_business_suspension(uuid, boolean) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.current_business_id() to authenticated;
grant execute on function public.has_active_subscription() to authenticated;

comment on table public.subscriptions is
  'Stripe webhook-managed subscription state; never writable by client sessions.';
comment on function public.has_active_subscription() is
  'RLS gate for paid workspace data; only Stripe-synchronized active/trialing status grants access.';
