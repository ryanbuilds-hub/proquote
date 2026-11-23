alter table public.quotes
  add column if not exists follow_up_date date;

create index if not exists quotes_follow_up_reminders_idx
  on public.quotes (business_id, follow_up_date)
  where status = 'sent' and follow_up_date is not null;

comment on column public.quotes.follow_up_date is
  'Optional date for the business to follow up on a sent quote.';
