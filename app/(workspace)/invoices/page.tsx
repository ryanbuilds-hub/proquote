import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/workspace";
import { formatEuro } from "@/lib/quotes";
import {
  formatInvoiceDate,
  getInvoiceBalance,
  getInvoiceDisplayStatus,
  parseInvoiceSnapshot,
  sumInvoicePayments,
} from "@/lib/invoices";

const statusLabels = {
  draft: "Draft",
  sent: "Awaiting payment",
  deposit_due: "Deposit due",
  partially_paid: "Part-paid",
  overdue: "Overdue",
  paid: "Paid",
} as const;

export default async function InvoicesPage() {
  const { supabase, business, isPaid } = await requireWorkspace();
  if (!isPaid) redirect("/billing?required=1");

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,status,due_date,total,deposit_required,business_snapshot,client_snapshot,quote_snapshot,created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load invoices: ${error.message}`);

  const invoiceIds = (invoices ?? []).map((invoice) => invoice.id);
  const paidByInvoice = new Map<string, number>();
  if (invoiceIds.length) {
    const { data: payments, error: paymentError } = await supabase
      .from("invoice_payments")
      .select("invoice_id,amount")
      .eq("business_id", business.id)
      .in("invoice_id", invoiceIds);
    if (paymentError) throw new Error(`Could not load invoice payments: ${paymentError.message}`);
    for (const payment of payments ?? []) {
      paidByInvoice.set(payment.invoice_id, sumInvoicePayments([
        paidByInvoice.get(payment.invoice_id) ?? 0,
        Number(payment.amount),
      ]));
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="page-content">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Payments and balances</p>
          <h1>Invoices</h1>
          <p className="muted">Invoices are created from accepted quotes. Record deposits and payments as they arrive.</p>
        </div>
        <Link className="button button-secondary" href="/quotes">View quotes</Link>
      </header>

      {!invoices?.length ? (
        <section className="panel empty-state">
          <h2>No invoices yet</h2>
          <p className="muted">When a customer accepts a quote, convert it to an invoice and track the deposit and balance here.</p>
          <Link className="button button-primary" href="/quotes">Open accepted quotes</Link>
        </section>
      ) : (
        <section className="panel table-panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Invoice</th><th>Client</th><th>Due</th><th>Status</th><th className="align-right">Balance</th></tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const snapshot = parseInvoiceSnapshot({
                    business: invoice.business_snapshot,
                    client: invoice.client_snapshot,
                    quote: invoice.quote_snapshot,
                  });
                  const total = Number(invoice.total);
                  const amountPaid = paidByInvoice.get(invoice.id) ?? 0;
                  const status = getInvoiceDisplayStatus({
                    status: invoice.status,
                    total,
                    amountPaid,
                    depositRequired: Number(invoice.deposit_required),
                    dueDate: invoice.due_date,
                    today,
                  });
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <Link className="quote-table-link" href={`/invoices/${invoice.id}`}>
                          <strong>{invoice.invoice_number}</strong>
                          <span className="table-secondary">{snapshot.quote.description}</span>
                          <span className="table-open-hint">Open invoice →</span>
                        </Link>
                      </td>
                      <td>{snapshot.client?.name ?? "No client"}</td>
                      <td>{formatInvoiceDate(invoice.due_date)}</td>
                      <td><span className={`badge invoice-status-${status}`}>{statusLabels[status]}</span></td>
                      <td className="align-right"><strong>{formatEuro(getInvoiceBalance(total, amountPaid))}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
