# ProQuote

ProQuote is a subscription-ready MVP for tradespeople. Each authenticated account owns a private business workspace with a guided dashboard, a client directory, business details, and saved quotes. Quote pricing preserves the supplied calculator's labour, call-out, materials markup, Irish VAT choices, euro formatting, copy, and WhatsApp sharing behavior.

The app uses Next.js, Supabase Auth/Postgres with row-level security (RLS), and Stripe Checkout/Customer Portal. Billing is **not live until you configure your own Supabase and Stripe projects**. This repository does not deploy the app or create those external accounts.

## Local setup

Requirements: Node.js 20+ and npm.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key.
3. Apply `supabase/migrations/20261019000000_initial_schema.sql` to your Supabase project. You can use the Supabase SQL Editor or initialize/link the Supabase CLI (`supabase init`, `supabase link`, then `supabase db push`).
4. In Supabase Auth, configure the site URL and redirect URL to include `http://localhost:3000/auth/callback`. Choose whether to require email confirmation.
5. Run `npm run dev`, create a test account, and confirm that a business account is created automatically.

The migration creates the business, client, quote, and Stripe subscription tables; signup trigger; RLS policies; paid-access helper; and platform-owner controls.

## Stripe setup

1. In Stripe, create a recurring monthly Price and put its `price_...` identifier in `STRIPE_MONTHLY_PRICE_ID`. The price amount and currency are controlled by Stripe, not hardcoded in the app.
2. Add `STRIPE_SECRET_KEY` from the Stripe test-mode dashboard and set `NEXT_PUBLIC_APP_URL` to `http://localhost:3000` locally.
3. Register a webhook endpoint at `/api/stripe/webhook` for `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Set `SUPABASE_SERVICE_ROLE_KEY` for the server-side webhook handler only. Never expose it in a `NEXT_PUBLIC_` variable or browser code.
5. Enable Stripe's Customer Portal so customers can manage or cancel their plan. For local webhook testing, forward Stripe CLI events to `http://localhost:3000/api/stripe/webhook`.

Checkout uses Stripe-hosted payment collection. Only webhook-signature-verified subscription records in `active` or `trialing` status unlock clients and quotes. `past_due`, canceled, incomplete, and other statuses remain gated. Webhook state is stored by server-side code; normal user sessions cannot insert, update, or delete subscription rows. Configure and test the webhook before accepting payments.

## Account isolation and platform owner

- Each Supabase Auth user has one business account in this MVP. A signup trigger creates that account from the business name entered at registration.
- The authenticated user's business ID is derived server-side. RLS policies independently restrict business data by owner and active subscription; client-supplied IDs do not grant access to another account.
- Clients and quotes are inaccessible through RLS until subscription status is active or trialing. Canceling or losing a subscription blocks access without deleting records.
- Owner access is granted to one specific Supabase Auth user ID in the private `platform_owner` table. After creating your own account, run the following once in the Supabase SQL Editor, replacing the example with your account email:

  ```sql
  insert into public.platform_owner (singleton, user_id)
  select true, id from auth.users
  where lower(email) = lower('you@example.com')
  on conflict (singleton) do update set user_id = excluded.user_id
  returning user_id;
  ```

  Confirm one row is returned. The single-row table is inaccessible to normal app users; RLS checks the signed-in user against this allowlist for both the owner page and owner-only account controls. The owner dashboard can view business account details and Stripe status, and suspend/restore workspace access. Its policies and UI do not grant access to client or quote records. Running the SQL again for a different email transfers owner access to that one account.
- The app's in-product owner controls do not change Stripe subscription status. The verified Stripe webhook is the source of truth for billing.

## Environment variables

See `.env.example` for names and harmless placeholders:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/server | Supabase public anon key; RLS remains mandatory |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Stripe webhook writes; bypasses RLS |
| `STRIPE_SECRET_KEY` | Server only | Checkout and billing portal |
| `STRIPE_WEBHOOK_SECRET` | Server only | Verifies Stripe event signatures |
| `STRIPE_MONTHLY_PRICE_ID` | Server only | Recurring monthly Stripe Price |
| `NEXT_PUBLIC_APP_URL` | Server/config | Stripe redirect origin |

Use test-mode Stripe keys until you've verified checkout, webhook delivery, subscription cancellation, and access gating end to end. Provide production environment values through your hosting provider's secret manager, not source control.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Create a private deployment and external Supabase/Stripe accounts separately when you are ready; no deployment is configured by this repository.
