"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/database.types";

type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"] | null;

export function BillingPanel({
  configured,
  isPaid,
  subscription,
  required,
  checkoutState,
}: {
  configured: boolean;
  isPaid: boolean;
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
          An active Stripe subscription is required before you can use clients and saved quotes.
        </div>
      )}
      <div className="billing-status">
        <span className="status-dot" data-active={isPaid} />
        <div>
          <span className="muted">Current status</span>
          <strong>{subscription?.status ?? "No subscription"}</strong>
        </div>
      </div>
      {subscription?.current_period_end && (
        <p className="muted">
          Current period ends {new Date(subscription.current_period_end).toLocaleDateString("en-IE")}
          {subscription.cancel_at_period_end ? " · cancellation scheduled" : ""}
        </p>
      )}
      <h2>{isPaid ? "Your workspace is active" : "Monthly plan"}</h2>
      <p className="muted">
        Your plan price is set in your Stripe account. Stripe securely handles payment
        details and subscription management.
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
        Client and quote data stays in your account. Access is enabled only after a verified
        Stripe subscription update.
      </p>
    </section>
  );
}
