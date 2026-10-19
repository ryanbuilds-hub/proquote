import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";

export default async function DashboardPage() {
  const { supabase, business, subscription, isPaid } = await requireWorkspace();
  let clientCount = 0;
  let quoteCount = 0;

  if (isPaid) {
    const [clients, quotes] = await Promise.all([
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .is("archived_at", null),
      supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id),
    ]);
    if (clients.error) throw new Error(`Could not load client count: ${clients.error.message}`);
    if (quotes.error) throw new Error(`Could not load quote count: ${quotes.error.message}`);
    clientCount = clients.count ?? 0;
    quoteCount = quotes.count ?? 0;
  }

  return (
    <div className="page-content">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1>Good to see you, {business.name}</h1>
          <p className="muted">Keep your clients and job quotes in one place.</p>
        </div>
        <Link className="button button-primary" href={isPaid ? "/quotes/new" : "/billing"}>
          Create a quote
        </Link>
      </header>

      {!isPaid && (
        <section className="notice notice-warm">
          <div>
            <h2>Activate your ProQuote workspace</h2>
            <p>
              Your client list and saved quotes unlock when Stripe confirms an active
              subscription. Your business profile is ready to finish in the meantime.
            </p>
            <p className="muted">
              Subscription status: <strong>{subscription?.status ?? "not subscribed"}</strong>
            </p>
          </div>
          <Link className="button button-primary" href="/billing">Choose monthly plan</Link>
        </section>
      )}

      <section className="stat-grid">
        <article className="stat-card">
          <span className="muted">Active clients</span>
          <strong>{isPaid ? clientCount : "—"}</strong>
          <Link href={isPaid ? "/clients" : "/billing"}>Open client directory</Link>
        </article>
        <article className="stat-card">
          <span className="muted">Saved quotes</span>
          <strong>{isPaid ? quoteCount : "—"}</strong>
          <Link href={isPaid ? "/quotes" : "/billing"}>View quote history</Link>
        </article>
        <article className="stat-card">
          <span className="muted">Subscription</span>
          <strong className="stat-status">{subscription?.status ?? "Not active"}</strong>
          <Link href="/billing">Manage subscription</Link>
        </article>
      </section>

      <section className="panel welcome-panel">
        <div>
          <p className="eyebrow">A simpler way to quote</p>
          <h2>Build a clear quote, then keep the details on hand.</h2>
          <p className="muted">
            Save client details once, price labour and materials, then copy or share your
            quote by WhatsApp.
          </p>
        </div>
        <Link className="button button-secondary" href="/settings">Set up business details</Link>
      </section>
    </div>
  );
}
