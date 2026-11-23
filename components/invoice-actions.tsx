"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markInvoiceAsSent, recordInvoicePayment } from "@/app/actions";
import type { ActionResult } from "@/app/actions";
import { getInvoiceBalance, getInvoiceDisplayStatus } from "@/lib/invoices";
import { formatEuro } from "@/lib/quotes";

const paymentMethodLabels = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  card: "Card",
  other: "Other",
} as const;

const invoiceStatusLabels = {
  draft: "Draft",
  sent: "Awaiting payment",
  deposit_due: "Deposit due",
  partially_paid: "Part-paid",
  overdue: "Overdue",
  paid: "Paid",
} as const;

export function InvoiceActions({
  invoiceId,
  invoiceNumber,
  status,
  dueDate,
  total,
  depositRequired,
  amountPaid,
}: {
  invoiceId: string;
  invoiceNumber: string;
  status: "draft" | "sent";
  dueDate: string;
  total: number;
  depositRequired: number;
  amountPaid: number;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const displayStatus = getInvoiceDisplayStatus({
    status,
    total,
    amountPaid,
    depositRequired,
    dueDate,
    today,
  });
  const balance = getInvoiceBalance(total, amountPaid);

  function markSent() {
    setResult(null);
    startTransition(async () => {
      const response = await markInvoiceAsSent(invoiceId);
      setResult(response);
      if (response.ok) router.refresh();
    });
  }

  function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    const form = event.currentTarget;
    startTransition(async () => {
      const response = await recordInvoicePayment(invoiceId, new FormData(form));
      setResult(response);
      if (response.ok) {
        form.reset();
        router.refresh();
      }
    });
  }

  function printInvoice() {
    const previousTitle = document.title;
    document.title = invoiceNumber;
    window.addEventListener("afterprint", () => { document.title = previousTitle; }, { once: true });
    window.print();
  }

  return (
    <section className="panel invoice-actions-panel">
      <p className="eyebrow">Payment tracking</p>
      <h2>{invoiceStatusLabels[displayStatus]}</h2>
      <p className="invoice-balance">
        <span>Remaining balance</span>
        <strong>{formatEuro(balance)}</strong>
      </p>
      {depositRequired > amountPaid && status === "sent" && (
        <p className="muted">
          Deposit still due: {formatEuro(depositRequired - amountPaid)}
        </p>
      )}
      <div className="invoice-action-buttons">
        <button className="button button-secondary button-full" type="button" onClick={printInvoice}>
          Print / save invoice PDF
        </button>
        {status === "draft" && (
          <button className="button button-primary button-full" type="button" onClick={markSent} disabled={pending}>
            {pending ? "Updating…" : "Mark invoice as sent"}
          </button>
        )}
      </div>
      {status === "sent" && balance > 0 && (
        <form className="form-stack invoice-payment-form" onSubmit={recordPayment}>
          <h3>Record a customer payment</h3>
          <p className="muted">Record a deposit or another payment received outside ProQuote.</p>
          <label>
            Amount received (€)
            <input name="amount" type="number" min="0.01" max={balance.toFixed(2)} step="0.01" required />
          </label>
          <div className="form-row">
            <label>
              Date received
              <input name="paid_on" type="date" defaultValue={today} max={today} required />
            </label>
            <label>
              Payment method
              <select name="method" defaultValue="bank_transfer">
                {Object.entries(paymentMethodLabels).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Note (optional)
            <input name="note" maxLength={500} placeholder="e.g. 50% deposit" />
          </label>
          <button className="button button-primary button-full" type="submit" disabled={pending}>
            {pending ? "Recording…" : "Record payment"}
          </button>
        </form>
      )}
      {result?.ok === false && <p className="form-message error-text" role="alert">{result.error}</p>}
      {result?.ok === true && <p className="form-message success-text" role="status">{result.message}</p>}
    </section>
  );
}

export { paymentMethodLabels, invoiceStatusLabels };
