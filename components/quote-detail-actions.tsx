"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateQuoteStatus } from "@/app/actions";
import type { ActionResult } from "@/app/actions";

type QuoteStatus = "draft" | "sent" | "accepted" | "declined";

const statusLabels: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
};

export function QuoteDetailActions({
  quoteId,
  currentStatus,
  quoteText,
}: {
  quoteId: string;
  currentStatus: QuoteStatus;
  quoteText: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<QuoteStatus>(currentStatus);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function saveStatus() {
    setResult(null);
    startTransition(async () => {
      const response = await updateQuoteStatus(quoteId, status);
      setResult(response);
      if (response.ok) router.refresh();
    });
  }

  async function copyQuote() {
    try {
      await navigator.clipboard.writeText(quoteText);
      setCopied(true);
    } catch {
      setResult({ ok: false, error: "Could not copy the quote. Try WhatsApp sharing instead." });
    }
  }

  return (
    <div className="quote-detail-actions">
      <div className="detail-status-control">
        <label htmlFor="quote-status">Quote status</label>
        <div className="status-control-row">
          <select
            id="quote-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as QuoteStatus)}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button className="button button-secondary" type="button" onClick={saveStatus} disabled={pending || status === currentStatus}>
            {pending ? "Saving…" : "Update status"}
          </button>
        </div>
      </div>

      <div className="detail-share-actions">
        <button className="button button-secondary" type="button" onClick={copyQuote}>Copy quote</button>
        <a
          className="button button-primary"
          href={`https://wa.me/?text=${encodeURIComponent(quoteText)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Share on WhatsApp <span aria-hidden="true">↗</span>
        </a>
      </div>

      {copied && <p className="form-message success-text" role="status">Quote copied. Paste it into a text or email.</p>}
      {result?.ok === false && <p className="form-message error-text" role="alert">{result.error}</p>}
      {result?.ok === true && <p className="form-message success-text" role="status">{result.message}</p>}
    </div>
  );
}
