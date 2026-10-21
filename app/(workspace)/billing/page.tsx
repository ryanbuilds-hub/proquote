import { BillingPanel } from "@/components/billing-panel";
import { requireWorkspace } from "@/lib/workspace";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string; checkout?: string }>;
}) {
  const { business, subscription, isPaid } = await requireWorkspace();
  const { required, checkout } = await searchParams;
  const stripeConfigured = Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_MONTHLY_PRICE_ID &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_APP_URL,
  );

  return (
    <div className="page-content narrow-content">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Monthly access</h1>
          <p className="muted">Subscription status for {business.name}.</p>
        </div>
      </header>
      <BillingPanel
        configured={stripeConfigured}
        isPaid={isPaid}
        subscription={subscription}
        required={required === "1"}
        checkoutState={checkout === "success" || checkout === "cancelled" ? checkout : undefined}
      />
    </div>
  );
}
