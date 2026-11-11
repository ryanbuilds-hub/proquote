# ProQuote project brief

This file is a quick handoff for Claude and other coding assistants working on ProQuote.

## Repository

- Public GitHub repository: https://github.com/ryanbuilds-hub/proquote
- Product: a mobile-friendly quoting and client-management SaaS for tradespeople.
- Stack: Next.js App Router, React, TypeScript, Supabase Auth/Postgres, Stripe.
- Read `README.md` for the full setup and configuration guide.

## Product and current features

- Email-based account authentication and a business workspace for each user.
- Client directory, business settings, quote calculator, and saved quote history.
- Saved quote details and sharing.
- Quote calculations preserve labour, call-out, materials markup, Irish VAT choices, euro formatting, and copy/WhatsApp sharing behavior from the original calculator.
- Stripe Checkout, Customer Portal, and subscription webhooks are implemented. They require valid project credentials and webhook configuration; do not assume production billing is active.
- A restricted platform-owner area supports account oversight without granting access to customer client or quote contents.

## Security and data boundaries

- Treat tenant isolation as a core product requirement: a business must never read or modify another business's clients or quotes.
- Derive the signed-in user's business identity on the server. Do not trust a business ID supplied by the browser.
- Supabase Row Level Security (RLS) is part of the authorization boundary. Keep it enabled and add or update policies when changing data access.
- Client and quote access is subscription-gated. Only verified subscription states `active` and `trialing` unlock that data.
- Stripe subscription state is written by the verified server-side webhook; it is not user-editable.
- Never commit `.env.local`, credentials, customer records, or production secrets. Use `.env.example` for safe variable names and placeholders.

## Important files

- `app/(workspace)/`: authenticated dashboard, clients, quotes, billing, settings, and owner pages.
- `app/actions.ts`: server actions for workspace and quote operations; preserve authentication and business scoping.
- `components/quote-calculator.tsx`: shared calculator and quote editor.
- `lib/quotes.ts`: quote validation, calculations, and saved-material parsing.
- `lib/workspace.ts`: authenticated workspace access helpers.
- `lib/supabase/`: browser, server, and privileged server-side Supabase clients.
- `app/api/stripe/`: checkout, customer portal, and webhook handlers.
- `supabase/migrations/20261019000000_initial_schema.sql`: database schema, RLS policies, and platform-owner controls.
- `README.md`: local setup, environment variables, Stripe, deployment, and phone installation notes.

## Local development and checks

Use Node.js 20+ and npm:

```sh
npm install
cp .env.example .env.local
# Fill local Supabase values in .env.local; do not paste secrets into chat.
npm run dev
```

Apply the SQL migration to the intended Supabase project before testing authenticated data flows. Stripe features need correctly configured server environment variables and a verified webhook.

Before handing off code changes, run the applicable checks:

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

This project uses Next.js 16. Before changing Next.js APIs or conventions, follow the version-specific guidance in `node_modules/next/dist/docs/` as directed by `AGENTS.md`.

## Deployment status

The source repository is public, but that does not make the running app public. Confirm the Vercel deployment and its HTTPS URL in the Vercel project before sharing a live-app link. Keep production credentials in Vercel's protected environment settings, not in this repository.
