"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/database.types";

type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"] | null;

export function BillingPanel({
  configured,
  isPaid,
  isSuspended,
  subscription,
  required,
  checkoutState,
}: {
  configured: boolean;
  isPaid: boolean;
  isSuspended: boolean;
  subscription: Subscription;
  required: boolean;
  checkoutState?: "success" | "cancelled";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startBilling(path: "/api/stripe/checkout" | "/api/stripe/portal") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(path, { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error ?? "Could not start billing. Please try again.");
        setBusy(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Could not connect to billing. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <section className="panel billing-panel">
      {checkoutState === "success" && (
        <div className="notice notice-warm">
          <span>
            Checkout completed. ProQuote will unlock your workspace after the verified Stripe
            subscription webhook arrives.
          </span>
          {!isPaid && (
            <button className="button button-secondary" type="button" onClick={() => router.refresh()}>
              Refresh status
            </button>
          )}
        </div>
      )}
      {checkoutState === "cancelled" && (
        <div className="notice notice-warm">Checkout was cancelled; no subscription was started.</div>
      )}
      {required && (
        <div className="notice notice-warm">
          {isSuspended
            ? "This workspace is suspended. Contact the ProQuote team to restore access."
            : "Your free plan includes up to 3 active clients and 5 saved quotes. Upgrade for unlimited use; your existing records remain accessible."}
        </div>
      )}
      <div className="billing-status">
        <span className="status-dot" data-active={isPaid} />
        <div>
          <span className="muted">Current status</span>
          <strong>{isSuspended ? "Suspended" : isPaid ? subscription?.status : "Free plan"}</strong>
        </div>
      </div>
      {subscription?.current_period_end && (
        <p className="muted">
          Current period ends {new Date(subscription.current_period_end).toLocaleDateString("en-IE")}
          {subscription.cancel_at_period_end ? " · cancellation scheduled" : ""}
        </p>
      )}
      <h2>{isPaid ? "Your unlimited workspace is active" : "Upgrade to unlimited"}</h2>
      <p className="muted">
        The free plan includes the quote calculator, up to 3 active clients and 5 saved quotes.
        Upgrade for unlimited clients and quotes. Your plan price is set in Stripe, which securely
        handles payment details and subscription management.
      </p>

      {!configured && (
        <div className="notice notice-error">
          Billing is not live yet. Configure your Stripe secret key, monthly price ID and
          app URL, then add the webhook signing secret before taking payments.
        </div>
      )}
      {error && <p className="form-message error-text" role="alert">{error}</p>}
      {configured && (
        <div className="button-row">
          {isPaid ? (
            <button className="button button-primary" disabled={busy} onClick={() => startBilling("/api/stripe/portal")}>
              {busy ? "Opening Stripe…" : "Manage subscription"}
            </button>
          ) : (
            <button className="button button-primary" disabled={busy} onClick={() => startBilling("/api/stripe/checkout")}>
              {busy ? "Opening Stripe…" : "Continue to secure checkout"}
            </button>
          )}
        </div>
      )}
      <p className="note">
        Your client and quote data stays in your account. Only verified Stripe subscription
        updates unlock the unlimited plan.
      </p>
    </section>
  );
}
