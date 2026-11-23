# ProQuote

ProQuote is a subscription-ready MVP for tradespeople. Each authenticated account owns a private business workspace with a guided dashboard, a client directory, business details, and saved quotes. Quote pricing preserves the supplied calculator's labour, call-out, materials markup, Irish VAT choices, euro formatting, copy, and WhatsApp sharing behavior.

The app uses Next.js, Supabase Auth/Postgres with row-level security (RLS), and Stripe Checkout/Customer Portal. Billing is **not live until you configure your own Supabase and Stripe projects**. This repository does not deploy the app or create those external accounts.

Saved quotes can be printed or saved as PDF from the quote details page; the printable layout includes the business, client, and itemized quote details.

For sent quotes, set an optional follow-up date from the quote details page. Due and overdue reminders appear on the workspace dashboard; no email or SMS is sent.

Accepted quotes can be converted once into invoice drafts. Conversion snapshots the accepted quote and business/client details, lets the business set a due date and required deposit, and supports marking the invoice as sent and recording manual partial/deposit payments. Invoice balances and overdue status are derived from the payment history. ProQuote does not collect customer invoice payments online in this version.

## Local setup

Requirements: Node.js 20+ and npm.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key.
3. Apply the SQL files in `supabase/migrations/` to your Supabase project in filename order. This includes the initial schema and later updates such as the Completed quote status, business quote logos, quote follow-up reminders, and quote-to-invoice workflow. You can use the Supabase SQL Editor or initialize/link the Supabase CLI (`supabase init`, `supabase link`, then `supabase db push`).
4. In Supabase Auth, configure the site URL and redirect URL to include `http://localhost:3000/auth/callback`. Choose whether to require email confirmation.
5. Run `npm run dev`, create a test account, and confirm that a business account is created automatically.

The migrations create the business, client, quote, and Stripe subscription tables; signup trigger; RLS policies; paid-access helper; platform-owner controls; and the public business-logo bucket. Business logos are limited to PNG, JPG, or WebP files up to 2 MB, and only the owning business can upload or remove its files. The logo is included in printable quote PDFs.

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

## Publish and add to a phone

The app can be installed from its public HTTPS address after deployment. For a Vercel deployment:

1. Import the `ryanbuilds-hub/proquote` repository into your Vercel account and deploy the branch containing the app changes.
2. Add the environment variables from `.env.example` in Vercel's project settings. Use your production Supabase values and a newly issued Stripe key; never reuse a revoked key. Keep service-role, Stripe secret, and webhook values server-only.
3. Set `NEXT_PUBLIC_APP_URL` to the Vercel HTTPS domain. In Supabase Auth, set the Site URL to that domain and add `https://<your-domain>/auth/callback` to the redirect URLs.
4. In Stripe, register `https://<your-domain>/api/stripe/webhook` for the subscription events listed above and save its signing secret in Vercel. Redeploy after changing production environment variables.

The app does not have a public URL until you complete the hosting setup. Keep Stripe in test mode until checkout, webhook delivery, and subscription access have been verified on the deployed URL.

Once deployed, sign in from your phone's browser and add it to the home screen:

- **iPhone/iPad:** open the app in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** open the app in Chrome, tap the menu, then **Install app** or **Add to Home screen**.

The web app manifest and phone icons are included. Signing in still uses your normal ProQuote account; installing the icon does not make app data public.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
```
