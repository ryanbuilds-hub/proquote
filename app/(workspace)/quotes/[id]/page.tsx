import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { QuoteDetailActions } from "@/components/quote-detail-actions";
import { buildQuoteText, calculateQuote, formatEuro, type Material } from "@/lib/quotes";
import type { Json } from "@/lib/database.types";
import { requireWorkspace } from "@/lib/workspace";

function parseMaterials(value: Json): Material[] {
  if (!Array.isArray(value)) throw new Error("Saved quote contains invalid material details.");
  return value.map((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item) ||
      typeof item.name !== "string" ||
      typeof item.cost !== "number"
    ) {
      throw new Error("Saved quote contains invalid material details.");
    }
    return { name: item.name, cost: item.cost };
  });
}

export default async function QuoteDetailPage({
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

  const clientResult = quote.client_id
    ? await supabase
        .from("clients")
        .select("id,name,email,phone,address")
        .eq("id", quote.client_id)
        .eq("business_id", business.id)
        .maybeSingle()
    : { data: null, error: null };
  if (clientResult.error) {
    throw new Error(`Could not load quote client: ${clientResult.error.message}`);
  }

  const materials = parseMaterials(quote.materials);
  const input = {
    description: quote.description,
    hours: Number(quote.hours),
    hourlyRate: Number(quote.hourly_rate),
    callOutFee: Number(quote.call_out_fee),
    vatRate: Number(quote.vat_rate),
    materialsMarkup: Number(quote.materials_markup),
    materials,
  };
  const calculation = calculateQuote(input);
  const quoteText = buildQuoteText(
    {
      name: business.name,
      phone: business.phone,
      email: business.email,
      address: business.address,
      vat_number: business.vat_number,
    },
    input,
    calculation,
    clientResult.data?.name,
  );
  const visibleMaterials = materials.filter((material) => material.name || material.cost);
  const statusClass = `quote-status-${quote.status}`;

  return (
    <div className="page-content quote-detail-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/quotes">Quotes</Link><span aria-hidden="true">/</span><span>{quote.quote_number}</span>
      </nav>

      <header className="quote-detail-heading">
        <div>
          <p className="eyebrow">Saved quote</p>
          <h1>{quote.description}</h1>
          <p className="muted">
            {quote.quote_number} · Created {new Date(quote.created_at).toLocaleDateString("en-IE")}
          </p>
        </div>
        <span className={`badge ${statusClass}`}>{quote.status}</span>
      </header>

      <div className="quote-detail-layout">
        <div className="quote-detail-main">
          {clientResult.data ? (
            <section className="panel detail-client-card">
              <div className="detail-section-heading">
                <span className="detail-icon" aria-hidden="true">C</span>
                <div><p className="eyebrow">Prepared for</p><h2>{clientResult.data.name}</h2></div>
              </div>
              <div className="client-contact-grid">
                {clientResult.data.email && <p><span>Email</span><strong>{clientResult.data.email}</strong></p>}
                {clientResult.data.phone && <p><span>Phone</span><strong>{clientResult.data.phone}</strong></p>}
                {clientResult.data.address && <p className="contact-address"><span>Address</span><strong>{clientResult.data.address}</strong></p>}
              </div>
            </section>
          ) : (
            <section className="panel detail-client-card unassigned-client">
              <div className="detail-section-heading">
                <span className="detail-icon" aria-hidden="true">↗</span>
                <div><p className="eyebrow">Job</p><h2>No client linked</h2></div>
              </div>
              <p className="muted">This saved quote was created without selecting a client.</p>
            </section>
          )}

          <section className="panel detail-breakdown">
            <div className="section-heading">
              <div><p className="eyebrow">Price breakdown</p><h2>What’s included</h2></div>
            </div>
            <div className="detail-line"><span>Labour · {input.hours} hours at {formatEuro(input.hourlyRate)}/hr</span><strong>{formatEuro(calculation.labour)}</strong></div>
            {input.callOutFee > 0 && (
              <div className="detail-line"><span>Call-out fee</span><strong>{formatEuro(input.callOutFee)}</strong></div>
            )}
            {visibleMaterials.length > 0 && (
              <div className="detail-materials">
                <div className="detail-materials-heading"><span>Materials · {input.materialsMarkup}% markup</span><strong>{formatEuro(calculation.materialsTotal)}</strong></div>
                {visibleMaterials.map((material, index) => (
                  <div className="detail-material-line" key={`${material.name}-${index}`}>
                    <span>{material.name || "Material"}</span><span>{formatEuro(material.cost)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="detail-subtotal"><span>Subtotal</span><strong>{formatEuro(calculation.subtotal)}</strong></div>
            {input.vatRate > 0 && (
              <div className="detail-line detail-vat"><span>VAT · {input.vatRate}%</span><strong>{formatEuro(calculation.vatAmount)}</strong></div>
            )}
            <div className="detail-total"><span>Total quote</span><strong>{formatEuro(Number(quote.total))}</strong></div>
            <p className="note">Check the VAT rate that applies to your work with Revenue.</p>
          </section>
        </div>

        <aside className="quote-detail-side">
          <section className="panel">
            <p className="eyebrow">Quote actions</p>
            <h2>Keep things moving</h2>
            <p className="muted">Update where this quote is at, or send the breakdown to your customer.</p>
            <QuoteDetailActions
              quoteId={quote.id}
              currentStatus={quote.status}
              quoteText={quoteText}
            />
          </section>
          <Link className="button button-outline button-full detail-back-button" href="/quotes">
            ← Back to all quotes
          </Link>
        </aside>
      </div>
    </div>
  );
}
