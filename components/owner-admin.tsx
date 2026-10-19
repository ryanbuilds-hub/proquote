"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBusinessSuspension } from "@/app/actions";

type Business = {
  id: string;
  name: string;
  email: string;
  is_suspended: boolean;
  created_at: string;
};
type Subscription = {
  business_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export function OwnerAdmin({
  businesses,
  subscriptions,
}: {
  businesses: Business[];
  subscriptions: Subscription[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const statusByBusiness = new Map(subscriptions.map((subscription) => [subscription.business_id, subscription]));

  function toggle(business: Business) {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await setBusinessSuspension(business.id, !business.is_suspended);
      if (!result.ok) setError(result.error);
      else {
        setMessage(result.message ?? "Account updated.");
        router.refresh();
      }
    });
  }

  return (
    <section className="panel table-panel">
      {error && <p className="form-message error-text" role="alert">{error}</p>}
      {message && <p className="form-message success-text" role="status">{message}</p>}
      {businesses.length === 0 ? (
        <p className="empty-inline">No business accounts yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Business</th><th>Account</th><th>Subscription</th><th>Period end</th><th>Access</th></tr></thead>
            <tbody>
              {businesses.map((business) => {
                const subscription = statusByBusiness.get(business.id);
                return (
                  <tr key={business.id}>
                    <td><strong>{business.name}</strong><span className="table-secondary">{business.email}</span></td>
                    <td>{new Date(business.created_at).toLocaleDateString("en-IE")}</td>
                    <td><span className="badge">{subscription?.status ?? "not subscribed"}</span></td>
                    <td>{subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString("en-IE") : "—"}</td>
                    <td>
                      <button
                        className={`text-button${business.is_suspended ? "" : " danger-button"}`}
                        disabled={pending}
                        onClick={() => toggle(business)}
                      >
                        {business.is_suspended ? "Restore" : "Suspend"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">This owner view shows business and subscription status only. It cannot read clients or quotes.</p>
    </section>
  );
}
