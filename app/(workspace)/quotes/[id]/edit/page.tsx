import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { QuoteCalculator } from "@/components/quote-calculator";
import { parseMaterials } from "@/lib/quotes";
import { requireWorkspace } from "@/lib/workspace";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, business, isPaid } = await requireWorkspace();
  if (!isPaid) redirect("/billing?required=1");

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (error) throw new Error(`Could not load quote: ${error.message}`);
  if (!quote) notFound();

  const { data: existingInvoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id")
    .eq("business_id", business.id)
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (invoiceError) throw new Error(`Could not check for an existing invoice: ${invoiceError.message}`);
  if (existingInvoice) redirect(`/invoices/${existingInvoice.id}`);

  const { data: activeClients, error: clientsError } = await supabase
    .from("clients")
    .select("id,name")
    .eq("business_id", business.id)
    .is("archived_at", null)
    .order("name");
  if (clientsError) throw new Error(`Could not load clients: ${clientsError.message}`);

  const clients = activeClients ?? [];
  if (quote.client_id && !clients.some((client) => client.id === quote.client_id)) {
    const { data: linkedClient, error: linkedClientError } = await supabase
      .from("clients")
      .select("id,name")
      .eq("id", quote.client_id)
      .eq("business_id", business.id)
      .maybeSingle();
    if (linkedClientError) {
      throw new Error(`Could not load quote client: ${linkedClientError.message}`);
    }
    if (linkedClient) clients.push(linkedClient);
  }

  const materials = parseMaterials(quote.materials);

  return (
    <div className="page-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/quotes">Quotes</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/quotes/${quote.id}`}>{quote.quote_number}</Link>
        <span aria-hidden="true">/</span>
        <span>Edit</span>
      </nav>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Edit saved quote</p>
          <h1>Update the job estimate</h1>
          <p className="muted">
            Saving changes recalculates the total and moves the quote back to Draft for review.
          </p>
        </div>
        <Link className="button button-secondary" href={`/quotes/${quote.id}`}>
          Cancel
        </Link>
      </header>
      <QuoteCalculator
        business={business}
        clients={clients}
        quoteId={quote.id}
        initialQuote={{
          description: quote.description,
          clientId: quote.client_id ?? "",
          hours: Number(quote.hours),
          hourlyRate: Number(quote.hourly_rate),
          callOutFee: Number(quote.call_out_fee),
          vatRate: Number(quote.vat_rate),
          materialsMarkup: Number(quote.materials_markup),
          materials,
        }}
      />
    </div>
  );
}
