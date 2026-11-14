import Link from "next/link";
import { FREE_PLAN_LIMITS } from "@/lib/plan-limits";
import { requireWorkspace } from "@/lib/workspace";

export default async function DashboardPage() {
  const { supabase, business, subscription, isPaid } = await requireWorkspace();
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
  const clientCount = clients.count ?? 0;
  const quoteCount = quotes.count ?? 0;
  const profileComplete =
    business.name !== "My Trade Business" && Boolean(business.email);
  const steps = [
    {
      number: "01",
      label: "Set up your business",
      detail: "Add the details that appear on every quote.",
      href: "/settings",
      action: profileComplete ? "Review profile" : "Add details",
      complete: profileComplete,
    },
    {
      number: "02",
      label: "Save your first client",
      detail: "Keep customer contacts together in one private directory.",
      href: "/clients",
      action: clientCount ? "Open clients" : "Add a client",
      complete: clientCount > 0,
    },
    {
      number: "03",
      label: "Create your first quote",
      detail: "Price labour, materials and VAT, then share the estimate.",
      href: "/quotes/new",
      action: quoteCount ? "New quote" : "Build a quote",
      complete: quoteCount > 0,
    },
  ];

  return (
    <div className="page-content">
      <header className="dashboard-hero">
        <div>
          <p className="hero-kicker"><span className="hero-spark">✦</span> YOUR PROQUOTE WORKSPACE</p>
          <h1>Good work starts<br />with a clear quote.</h1>
          <p>Welcome back, {business.name}. Your clients, job details and quotes are all in one place.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/quotes/new">
              Create a quote <span aria-hidden="true">→</span>
            </Link>
            <Link className="hero-text-link" href="/clients">
              Browse clients <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="quote-preview">
            <div className="preview-top"><span className="preview-logo">P</span><span className="preview-lines"><i /><i /></span><span className="preview-dot" /></div>
            <span className="preview-label">JOB ESTIMATE</span>
            <strong>Kitchen tap<br />replacement</strong>
            <div className="preview-rule" />
            <div className="preview-row"><span>Labour &amp; materials</span><b>€343.50</b></div>
            <div className="preview-total"><span>TOTAL</span><strong>€389.87</strong></div>
            <span className="preview-chip"><span /> Ready to share</span>
          </div>
          <span className="hero-floating floating-one">✓ Client saved</span>
          <span className="hero-floating floating-two">€ Quote ready</span>
        </div>
      </header>

      {business.is_suspended ? (
        <section className="notice notice-error">
          <div>
            <h2>This workspace is suspended</h2>
            <p>Contact the ProQuote team to restore access to your clients and quotes.</p>
          </div>
        </section>
      ) : !isPaid ? (
        <section className="notice notice-warm">
          <div>
            <h2>You’re on the free plan</h2>
            <p>
              Try ProQuote with up to {FREE_PLAN_LIMITS.clients} active clients and{" "}
              {FREE_PLAN_LIMITS.quotes} saved quotes. Your records stay accessible if you
              reach a limit; upgrade any time for unlimited clients and quotes.
            </p>
            <p className="muted">
              {subscription?.status && subscription.status !== "inactive" && (
                <>Previous subscription status: <strong>{subscription.status}</strong></>
              )}
            </p>
          </div>
          <Link className="button button-primary" href="/billing">Explore unlimited plan</Link>
        </section>
      ) : null}

      <section className="stat-grid">
        <article className="stat-card">
          <span className="stat-icon client-icon" aria-hidden="true">C</span>
          <span className="muted">Active clients</span>
          <strong>{isPaid ? clientCount : `${clientCount}/${FREE_PLAN_LIMITS.clients}`}</strong>
          <Link href="/clients">Open client directory</Link>
        </article>
        <article className="stat-card">
          <span className="stat-icon quote-icon" aria-hidden="true">Q</span>
          <span className="muted">Saved quotes</span>
          <strong>{isPaid ? quoteCount : `${quoteCount}/${FREE_PLAN_LIMITS.quotes}`}</strong>
          <Link href="/quotes">View quote history</Link>
        </article>
        <article className="stat-card">
          <span className="stat-icon billing-icon" aria-hidden="true">£</span>
          <span className="muted">Subscription</span>
          <strong className="stat-status">{subscription?.status ?? "Not active"}</strong>
          <Link href="/billing">Manage subscription</Link>
        </article>
      </section>

      <section className="getting-started">
        <div className="getting-started-heading">
          <div>
            <p className="eyebrow">A quick tour</p>
            <h2>Your next steps</h2>
            <p className="muted">Three simple steps to get your workspace ready.</p>
          </div>
          <span className="progress-label">
            {steps.filter((step) => step.complete).length} of 3 complete
          </span>
        </div>
        <div className="step-grid">
          {steps.map((step) => (
            <article className={`step-card${step.complete ? " step-complete" : ""}`} key={step.number}>
              <span className="step-number">{step.complete ? "✓" : step.number}</span>
              <div className="step-copy">
                <h3>{step.label}</h3>
                <p>{step.detail}</p>
                <Link href={step.href}>
                  {step.action} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
