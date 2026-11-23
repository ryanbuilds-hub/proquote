import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { InvoiceActions, paymentMethodLabels } from "@/components/invoice-actions";
import { requireWorkspace } from "@/lib/workspace";
import { calculateQuote, formatEuro } from "@/lib/quotes";
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

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, business, isPaid } = await requireWorkspace();
  if (!isPaid) redirect("/billing?required=1");

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (error) throw new Error(`Could not load invoice: ${error.message}`);
  if (!invoice) notFound();

  const { data: payments, error: paymentError } = await supabase
    .from("invoice_payments")
    .select("id,amount,paid_on,method,note")
    .eq("business_id", business.id)
    .eq("invoice_id", invoice.id)
    .order("paid_on", { ascending: false });
  if (paymentError) throw new Error(`Could not load invoice payments: ${paymentError.message}`);

  const snapshot = parseInvoiceSnapshot({
    business: invoice.business_snapshot,
    client: invoice.client_snapshot,
    quote: invoice.quote_snapshot,
  });
  const input = {
    description: snapshot.quote.description,
    hours: snapshot.quote.hours,
    hourlyRate: snapshot.quote.hourlyRate,
    callOutFee: snapshot.quote.callOutFee,
    vatRate: snapshot.quote.vatRate,
    materialsMarkup: snapshot.quote.materialsMarkup,
    materials: snapshot.quote.materials,
  };
  const calculation = calculateQuote(input);
  const total = Number(invoice.total);
  const amountPaid = sumInvoicePayments((payments ?? []).map((payment) => Number(payment.amount)));
  const today = new Date().toISOString().slice(0, 10);
  const displayStatus = getInvoiceDisplayStatus({
    status: invoice.status,
    total,
    amountPaid,
    depositRequired: Number(invoice.deposit_required),
    dueDate: invoice.due_date,
    today,
  });
  const logoUrl = business.logo_path
    ? supabase.storage.from("business-logos").getPublicUrl(business.logo_path).data.publicUrl
    : null;

  return (
    <div className="page-content invoice-detail-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/invoices">Invoices</Link><span aria-hidden="true">/</span><span>{invoice.invoice_number}</span>
      </nav>

      <header className="quote-detail-heading">
        <div>
          <p className="eyebrow">Invoice</p>
          <h1>{invoice.invoice_number}</h1>
          <p className="muted">Issued {formatInvoiceDate(invoice.issued_on)} · Due {formatInvoiceDate(invoice.due_date)}</p>
        </div>
        <span className={`badge invoice-status-${displayStatus}`}>{statusLabels[displayStatus]}</span>
      </header>

      <div className="invoice-detail-layout">
        <main className="invoice-document">
          <section className="invoice-business panel">
            {logoUrl && <img className="quote-print-logo" src={logoUrl} alt={`${snapshot.business.name} logo`} />}
            <p className="eyebrow">From</p>
            <h2>{snapshot.business.name}</h2>
            <p>{[snapshot.business.email, snapshot.business.phone, snapshot.business.address].filter(Boolean).join(" · ")}</p>
            {snapshot.business.vatNumber && <p>VAT no: {snapshot.business.vatNumber}</p>}
          </section>

          <section className="invoice-client panel">
            <p className="eyebrow">Invoice to</p>
            {snapshot.client ? (
              <>
                <h2>{snapshot.client.name}</h2>
                <p>{[snapshot.client.email, snapshot.client.phone, snapshot.client.address].filter(Boolean).join(" · ")}</p>
              </>
            ) : (
              <p>Customer details were not included on the accepted quote.</p>
            )}
          </section>

          <section className="panel invoice-breakdown">
            <div className="section-heading">
              <div><p className="eyebrow">Based on accepted quote {snapshot.quote.quoteNumber}</p><h2>{snapshot.quote.description}</h2></div>
            </div>
            <div className="detail-line">
              <span>Labour · {input.hours} hours at {formatEuro(input.hourlyRate)}/hr</span>
              <strong>{formatEuro(calculation.labour)}</strong>
            </div>
            {input.callOutFee > 0 && (
              <div className="detail-line"><span>Call-out fee</span><strong>{formatEuro(input.callOutFee)}</strong></div>
            )}
            {calculation.materialsTotal > 0 && (
              <div className="detail-materials">
                <div className="detail-materials-heading">
                  <span>Materials · {input.materialsMarkup}% markup</span>
                  <strong>{formatEuro(calculation.materialsTotal)}</strong>
                </div>
                {input.materials.filter((material) => material.name || material.cost).map((material, index) => (
                  <div className="detail-material-line" key={`${material.name}-${index}`}>
                    <span>{material.name || "Material"}</span><span>{formatEuro(material.cost)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="detail-subtotal"><span>Subtotal</span><strong>{formatEuro(Number(invoice.subtotal))}</strong></div>
            {input.vatRate > 0 && (
              <div className="detail-line detail-vat"><span>VAT · {input.vatRate}%</span><strong>{formatEuro(Number(invoice.vat_amount))}</strong></div>
            )}
            <div className="detail-total"><span>Invoice total</span><strong>{formatEuro(total)}</strong></div>
            {Number(invoice.deposit_required) > 0 && (
              <div className="invoice-deposit-summary">
                <span>Deposit required</span><strong>{formatEuro(Number(invoice.deposit_required))}</strong>
              </div>
            )}
            <div className="invoice-deposit-summary">
              <span>Payments received</span><strong>{formatEuro(amountPaid)}</strong>
            </div>
            <div className="invoice-balance">
              <span>Balance due</span><strong>{formatEuro(getInvoiceBalance(total, amountPaid))}</strong>
            </div>
          </section>

          <section className="panel invoice-payment-history">
            <div className="section-heading"><div><p className="eyebrow">Manual payment records</p><h2>Payment history</h2></div></div>
            {!payments?.length ? (
              <p className="empty-inline">No payments recorded yet.</p>
            ) : (
              <div className="invoice-payment-list">
                {payments.map((payment) => (
                  <div className="invoice-payment-row" key={payment.id}>
                    <div>
                      <strong>{formatEuro(Number(payment.amount))}</strong>
                      <span>{formatInvoiceDate(payment.paid_on)} · {paymentMethodLabels[payment.method]}</span>
                    </div>
                    {payment.note && <p>{payment.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>

        <aside className="invoice-actions">
          <InvoiceActions
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoice_number}
            status={invoice.status}
            dueDate={invoice.due_date}
            total={total}
            depositRequired={Number(invoice.deposit_required)}
            amountPaid={amountPaid}
          />
          <Link className="button button-outline button-full" href={`/quotes/${invoice.quote_id}`}>View accepted quote</Link>
        </aside>
      </div>
    </div>
  );
}
