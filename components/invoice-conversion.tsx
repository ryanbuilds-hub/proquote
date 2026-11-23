"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvoiceFromAcceptedQuote } from "@/app/actions";
import type { CreateInvoiceResult } from "@/app/actions";
import { formatEuro } from "@/lib/quotes";

export function InvoiceConversion({
  quoteId,
  quoteTotal,
  dueDateDefault,
  quoteAccepted,
  existingInvoice,
}: {
  quoteId: string;
  quoteTotal: number;
  dueDateDefault: string;
  quoteAccepted: boolean;
  existingInvoice: { id: string; invoice_number: string } | null;
}) {
  const router = useRouter();
  const [dueDate, setDueDate] = useState(dueDateDefault);
  const [deposit, setDeposit] = useState("0");
  const [result, setResult] = useState<CreateInvoiceResult | null>(null);
  const [pending, startTransition] = useTransition();

  function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      const response = await createInvoiceFromAcceptedQuote(quoteId, dueDate, deposit);
      setResult(response);
      if (response.ok) {
        router.push(`/invoices/${response.invoiceId}`);
        router.refresh();
      }
    });
  }

  if (existingInvoice) {
    return (
      <section className="invoice-conversion-card">
        <p className="eyebrow">Invoice created</p>
        <Link className="button button-secondary button-full" href={`/invoices/${existingInvoice.id}`}>
          View {existingInvoice.invoice_number}
        </Link>
      </section>
    );
  }

  if (!quoteAccepted) {
    return (
      <section className="invoice-conversion-card">
        <p className="eyebrow">Next step</p>
        <h3>Invoice after acceptance</h3>
        <p className="muted">Mark this quote as Accepted to create an invoice and track a deposit.</p>
      </section>
    );
  }

  return (
    <section className="invoice-conversion-card">
      <p className="eyebrow">Turn accepted work into an invoice</p>
      <h3>Create an invoice</h3>
      <p className="muted">
        The invoice keeps a snapshot of the accepted quote. Record the deposit later when the customer pays.
      </p>
      <form className="form-stack" onSubmit={createInvoice}>
        <label>
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            required
          />
        </label>
        <label>
          Deposit required (€)
          <input
            type="number"
            min="0"
            max={quoteTotal.toFixed(2)}
            step="0.01"
            inputMode="decimal"
            value={deposit}
            onChange={(event) => setDeposit(event.target.value)}
            required
          />
        </label>
        <p className="note">
          Quote total: {formatEuro(quoteTotal)}. A zero deposit means the full amount is due by the due date.
        </p>
        {result?.ok === false && <p className="form-message error-text" role="alert">{result.error}</p>}
        <button className="button button-primary button-full" type="submit" disabled={pending}>
          {pending ? "Creating invoice…" : "Create invoice"}
        </button>
      </form>
    </section>
  );
}
