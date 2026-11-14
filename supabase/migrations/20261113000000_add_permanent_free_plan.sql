drop policy if exists "Owners can read their active-subscription clients" on public.clients;
drop policy if exists "Owners can create their active-subscription clients" on public.clients;
drop policy if exists "Owners can update their active-subscription clients" on public.clients;
drop policy if exists "Owners can delete their active-subscription clients" on public.clients;
drop policy if exists "Owners can read their active-subscription quotes" on public.quotes;
drop policy if exists "Owners can create their active-subscription quotes" on public.quotes;
drop policy if exists "Owners can update their active-subscription quotes" on public.quotes;
drop policy if exists "Owners can delete their active-subscription quotes" on public.quotes;

create policy "Business owners can read their clients"
on public.clients for select to authenticated
using (
  business_id = (select public.current_business_id())
  and not exists (
    select 1 from public.businesses b
    where b.id = clients.business_id and b.is_suspended
  )
);

create policy "Business owners can create their clients"
on public.clients for insert to authenticated
with check (
  business_id = (select public.current_business_id())
  and not exists (
    select 1 from public.businesses b
    where b.id = clients.business_id and b.is_suspended
  )
);

create policy "Business owners can update their clients"
on public.clients for update to authenticated
using (
  business_id = (select public.current_business_id())
  and not exists (
    select 1 from public.businesses b
    where b.id = clients.business_id and b.is_suspended
  )
)
with check (
  business_id = (select public.current_business_id())
  and not exists (
    select 1 from public.businesses b
    where b.id = clients.business_id and b.is_suspended
  )
);

create policy "Business owners can delete their clients"
on public.clients for delete to authenticated
using (
  business_id = (select public.current_business_id())
  and not exists (
    select 1 from public.businesses b
    where b.id = clients.business_id and b.is_suspended
  )
);

create policy "Business owners can read their quotes"
on public.quotes for select to authenticated
using (
  business_id = (select public.current_business_id())
  and not exists (
    select 1 from public.businesses b
    where b.id = quotes.business_id and b.is_suspended
  )
);

create policy "Business owners can create their quotes"
on public.quotes for insert to authenticated
with check (
  business_id = (select public.current_business_id())
  and not exists (
    select 1 from public.businesses b
    where b.id = quotes.business_id and b.is_suspended
  )
);

create policy "Business owners can update their quotes"
on public.quotes for update to authenticated
using (
  business_id = (select public.current_business_id())
  and not exists (
    select 1 from public.businesses b
    where b.id = quotes.business_id and b.is_suspended
  )
)
with check (
  business_id = (select public.current_business_id())
  and not exists (
    select 1 from public.businesses b
    where b.id = quotes.business_id and b.is_suspended
  )
);

create policy "Business owners can delete their quotes"
on public.quotes for delete to authenticated
using (
  business_id = (select public.current_business_id())
  and not exists (
    select 1 from public.businesses b
    where b.id = quotes.business_id and b.is_suspended
  )
);

create or replace function public.enforce_free_plan_client_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid_workspace boolean;
  active_client_count bigint;
begin
  if auth.uid() is not null
     and new.business_id is distinct from public.current_business_id() then
    return new;
  end if;

  if new.archived_at is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('free_plan:' || new.business_id::text, 0)
  );

  select
    not b.is_suspended and coalesce(s.status in ('active', 'trialing'), false)
  into paid_workspace
  from public.businesses b
  left join public.subscriptions s on s.business_id = b.id
  where b.id = new.business_id;

  if coalesce(paid_workspace, false) then
    return new;
  end if;

  select count(*)
  into active_client_count
  from public.clients c
  where c.business_id = new.business_id
    and c.archived_at is null;

  if active_client_count >= 3 then
    raise exception using
      message = 'free_plan_client_limit_reached',
      errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_free_plan_quote_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid_workspace boolean;
  saved_quote_count bigint;
begin
  if auth.uid() is not null
     and new.business_id is distinct from public.current_business_id() then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('free_plan:' || new.business_id::text, 0)
  );

  select
    not b.is_suspended and coalesce(s.status in ('active', 'trialing'), false)
  into paid_workspace
  from public.businesses b
  left join public.subscriptions s on s.business_id = b.id
  where b.id = new.business_id;

  if coalesce(paid_workspace, false) then
    return new;
  end if;

  select count(*)
  into saved_quote_count
  from public.quotes q
  where q.business_id = new.business_id;

  if saved_quote_count >= 5 then
    raise exception using
      message = 'free_plan_quote_limit_reached',
      errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger clients_enforce_free_plan_limit
before insert on public.clients
for each row execute function public.enforce_free_plan_client_limit();

create trigger quotes_enforce_free_plan_limit
before insert on public.quotes
for each row execute function public.enforce_free_plan_quote_limit();

revoke all on function public.enforce_free_plan_client_limit() from public, anon, authenticated;
revoke all on function public.enforce_free_plan_quote_limit() from public, anon, authenticated;

comment on function public.enforce_free_plan_client_limit() is
  'Atomically enforces the permanent free plan limit of three active clients.';
comment on function public.enforce_free_plan_quote_limit() is
  'Atomically enforces the permanent free plan limit of five saved quotes.';

comment on function public.has_active_subscription() is
  'Returns true only for non-suspended businesses with a Stripe-synchronized active or trialing subscription.';
