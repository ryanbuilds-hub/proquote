create unique index if not exists quotes_business_id_id_key
  on public.quotes (business_id, id);

create table public.invoice_sequences (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  last_number bigint not null default 0 check (last_number >= 0)
);

alter table public.invoice_sequences enable row level security;
revoke all on public.invoice_sequences from public, anon, authenticated;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  quote_id uuid not null,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  issued_on date not null default current_date,
  due_date date not null,
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  vat_amount numeric(14, 2) not null check (vat_amount >= 0),
  total numeric(14, 2) not null check (total >= 0),
  deposit_required numeric(14, 2) not null default 0
    check (deposit_required >= 0 and deposit_required <= total),
  business_snapshot jsonb not null check (jsonb_typeof(business_snapshot) = 'object'),
  client_snapshot jsonb check (client_snapshot is null or jsonb_typeof(client_snapshot) = 'object'),
  quote_snapshot jsonb not null check (jsonb_typeof(quote_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, invoice_number),
  unique (business_id, quote_id),
  foreign key (business_id, quote_id)
    references public.quotes (business_id, id)
    on delete restrict
);

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  invoice_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  method text not null check (method in ('cash', 'bank_transfer', 'card', 'other')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  foreign key (business_id, invoice_id)
    references public.invoices (business_id, id)
    on delete restrict
);

create index invoices_business_created_idx
  on public.invoices (business_id, created_at desc);
create index invoice_payments_business_invoice_idx
  on public.invoice_payments (business_id, invoice_id, paid_on desc);

create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create or replace function public.protect_invoiced_quote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.invoices i
    where i.business_id = old.business_id and i.quote_id = old.id
  ) then
    raise exception using message = 'invoice_quote_locked', errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger quotes_protect_invoiced_quote
before update on public.quotes
for each row execute function public.protect_invoiced_quote();

alter table public.invoices enable row level security;
alter table public.invoice_payments enable row level security;

create policy "Owners can read their invoices"
on public.invoices for select to authenticated
using (
  business_id = (select public.current_business_id())
  and (select public.has_active_subscription())
);

create policy "Owners can read their invoice payments"
on public.invoice_payments for select to authenticated
using (
  business_id = (select public.current_business_id())
  and (select public.has_active_subscription())
);

create policy "Owners can record their invoice payments"
on public.invoice_payments for insert to authenticated
with check (
  business_id = (select public.current_business_id())
  and (select public.has_active_subscription())
);

revoke all on public.invoices from public, anon, authenticated;
revoke all on public.invoice_payments from public, anon, authenticated;
grant select on public.invoices, public.invoice_payments to authenticated;
grant insert on public.invoice_payments to authenticated;

create or replace function public.create_invoice_from_accepted_quote(
  p_quote_id uuid,
  p_due_date date,
  p_deposit_required numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_id uuid;
  source_quote public.quotes%rowtype;
  business_row public.businesses%rowtype;
  client_row public.clients%rowtype;
  new_invoice_id uuid;
  new_invoice_number text;
  new_invoice_sequence bigint;
  business_data jsonb;
  client_data jsonb;
  quote_data jsonb;
begin
  if auth.uid() is null then
    raise exception using message = 'authentication_required', errcode = 'P0001';
  end if;

  workspace_id := public.current_business_id();
  if workspace_id is null or not public.has_active_subscription() then
    raise exception using message = 'active_subscription_required', errcode = 'P0001';
  end if;
  if p_due_date is null or p_due_date < current_date then
    raise exception using message = 'invoice_due_date_invalid', errcode = 'P0001';
  end if;
  if p_deposit_required is null or p_deposit_required < 0 then
    raise exception using message = 'invoice_deposit_invalid', errcode = 'P0001';
  end if;

  select q.*
  into source_quote
  from public.quotes q
  where q.id = p_quote_id and q.business_id = workspace_id
  for update;

  if not found then
    raise exception using message = 'quote_not_found', errcode = 'P0001';
  end if;
  if source_quote.status <> 'accepted' then
    raise exception using message = 'quote_not_accepted', errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.invoices i
    where i.business_id = workspace_id and i.quote_id = source_quote.id
  ) then
    raise exception using message = 'invoice_already_exists', errcode = 'P0001';
  end if;
  if p_deposit_required > source_quote.total then
    raise exception using message = 'invoice_deposit_exceeds_total', errcode = 'P0001';
  end if;

  select b.*
  into business_row
  from public.businesses b
  where b.id = workspace_id;

  business_data := jsonb_build_object(
    'name', business_row.name,
    'email', business_row.email,
    'phone', business_row.phone,
    'address', business_row.address,
    'vatNumber', business_row.vat_number
  );

  client_data := null;
  if source_quote.client_id is not null then
    select c.*
    into client_row
    from public.clients c
    where c.business_id = workspace_id and c.id = source_quote.client_id;

    client_data := jsonb_build_object(
      'name', client_row.name,
      'email', client_row.email,
      'phone', client_row.phone,
      'address', client_row.address
    );
  end if;

  quote_data := jsonb_build_object(
    'quoteNumber', source_quote.quote_number,
    'description', source_quote.description,
    'hours', source_quote.hours,
    'hourlyRate', source_quote.hourly_rate,
    'callOutFee', source_quote.call_out_fee,
    'vatRate', source_quote.vat_rate,
    'materials', source_quote.materials,
    'materialsMarkup', source_quote.materials_markup,
    'subtotal', source_quote.subtotal,
    'vatAmount', source_quote.vat_amount,
    'total', source_quote.total
  );

  insert into public.invoice_sequences as seq (business_id, last_number)
  values (workspace_id, 1)
  on conflict (business_id) do update
  set last_number = seq.last_number + 1
  returning last_number into new_invoice_sequence;

  new_invoice_number :=
    'INV-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(new_invoice_sequence::text, 6, '0');

  insert into public.invoices (
    business_id,
    quote_id,
    invoice_number,
    due_date,
    deposit_required,
    subtotal,
    vat_amount,
    total,
    business_snapshot,
    client_snapshot,
    quote_snapshot
  )
  values (
    workspace_id,
    source_quote.id,
    new_invoice_number,
    p_due_date,
    p_deposit_required,
    source_quote.subtotal,
    source_quote.vat_amount,
    source_quote.total,
    business_data,
    client_data,
    quote_data
  )
  returning id into new_invoice_id;

  return new_invoice_id;
end;
$$;

create or replace function public.set_invoice_status(
  p_invoice_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_id uuid;
  invoice_row public.invoices%rowtype;
begin
  if auth.uid() is null then
    raise exception using message = 'authentication_required', errcode = 'P0001';
  end if;
  workspace_id := public.current_business_id();
  if workspace_id is null or not public.has_active_subscription() then
    raise exception using message = 'active_subscription_required', errcode = 'P0001';
  end if;
  if p_status is distinct from 'sent' then
    raise exception using message = 'invoice_status_invalid', errcode = 'P0001';
  end if;

  select i.*
  into invoice_row
  from public.invoices i
  where i.id = p_invoice_id and i.business_id = workspace_id
  for update;
  if not found then
    raise exception using message = 'invoice_not_found', errcode = 'P0001';
  end if;
  if invoice_row.status <> 'draft' then
    raise exception using message = 'invoice_status_transition_invalid', errcode = 'P0001';
  end if;

  update public.invoices
  set status = p_status
  where id = p_invoice_id and business_id = workspace_id;
end;
$$;

create or replace function public.validate_invoice_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_row public.invoices%rowtype;
  paid_total numeric(14, 2);
begin
  select i.*
  into invoice_row
  from public.invoices i
  where i.id = new.invoice_id and i.business_id = new.business_id
  for update;
  if not found then
    raise exception using message = 'invoice_not_found', errcode = 'P0001';
  end if;
  if invoice_row.status <> 'sent' then
    raise exception using message = 'invoice_must_be_sent_before_payment', errcode = 'P0001';
  end if;
  if new.paid_on > current_date then
    raise exception using message = 'invoice_payment_date_invalid', errcode = 'P0001';
  end if;

  select coalesce(sum(p.amount), 0)
  into paid_total
  from public.invoice_payments p
  where p.business_id = new.business_id and p.invoice_id = new.invoice_id;

  if paid_total + new.amount > invoice_row.total then
    raise exception using message = 'invoice_payment_exceeds_balance', errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger invoice_payments_validate
before insert on public.invoice_payments
for each row execute function public.validate_invoice_payment();

revoke all on function public.create_invoice_from_accepted_quote(uuid, date, numeric)
  from public, anon;
revoke all on function public.set_invoice_status(uuid, text)
  from public, anon;
revoke all on function public.validate_invoice_payment()
  from public, anon, authenticated;
revoke all on function public.protect_invoiced_quote()
  from public, anon, authenticated;
grant execute on function public.create_invoice_from_accepted_quote(uuid, date, numeric)
  to authenticated;
grant execute on function public.set_invoice_status(uuid, text)
  to authenticated;

comment on table public.invoices is
  'Immutable snapshots created from accepted quotes; payment status is derived from recorded invoice payments.';
comment on table public.invoice_payments is
  'Append-only manual invoice payment records; Stripe customer payments are not enabled.';
