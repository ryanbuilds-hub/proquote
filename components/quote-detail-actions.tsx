"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateQuoteFollowUpDate, updateQuoteStatus } from "@/app/actions";
import type { ActionResult } from "@/app/actions";
import { quoteStatuses, type QuoteStatus } from "@/lib/quote-status";

const statusLabels: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
};

export function QuoteDetailActions({
  quoteId,
  quoteNumber,
  currentStatus,
  currentFollowUpDate,
  canChangeStatus,
  quoteText,
}: {
  quoteId: string;
  quoteNumber: string;
  currentStatus: QuoteStatus;
  currentFollowUpDate: string | null;
  canChangeStatus: boolean;
  quoteText: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<QuoteStatus>(currentStatus);
  const [followUpDate, setFollowUpDate] = useState(currentFollowUpDate ?? "");
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

  function saveFollowUpDate() {
    setResult(null);
    startTransition(async () => {
      const response = await updateQuoteFollowUpDate(quoteId, followUpDate);
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

  function downloadPdf() {
    const previousTitle = document.title;
    document.title = `ProQuote ${quoteNumber}`;
    window.addEventListener(
      "afterprint",
      () => {
        document.title = previousTitle;
      },
      { once: true },
    );
    window.print();
  }

  return (
    <div className="quote-detail-actions">
      {canChangeStatus && (
        <div className="detail-status-control">
          <label htmlFor="quote-status">Quote status</label>
          <div className="status-control-row">
            <select
              id="quote-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as QuoteStatus)}
            >
              {quoteStatuses.map((value) => (
                <option key={value} value={value}>{statusLabels[value]}</option>
              ))}
            </select>
            <button className="button button-secondary" type="button" onClick={saveStatus} disabled={pending || status === currentStatus}>
              {pending ? "Saving…" : "Update status"}
            </button>
          </div>
        </div>
      )}

      <div className="detail-reminder-control">
        <label htmlFor="quote-follow-up-date">Follow-up reminder</label>
        <p className="muted">
          Set a date. It appears on your dashboard when this quote is marked Sent and is due within seven days.
        </p>
        <input
          id="quote-follow-up-date"
          type="date"
          value={followUpDate}
          onChange={(event) => setFollowUpDate(event.target.value)}
        />
        <button
          className="button button-secondary"
          type="button"
          onClick={saveFollowUpDate}
          disabled={pending || followUpDate === (currentFollowUpDate ?? "")}
        >
          {pending ? "Saving…" : followUpDate ? "Save reminder" : "Clear reminder"}
        </button>
      </div>

      <div className="detail-share-actions">
        <button className="button button-secondary" type="button" onClick={downloadPdf}>
          Download / print PDF
        </button>
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
