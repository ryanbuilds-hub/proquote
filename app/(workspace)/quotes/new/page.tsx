import Link from "next/link";
import { QuoteCalculator } from "@/components/quote-calculator";
import { requireWorkspace } from "@/lib/workspace";

export default async function NewQuotePage() {
  const { supabase, business, isPaid } = await requireWorkspace();
  if (!isPaid) {
    return (
      <div className="page-content">
        <h1>Create a quote</h1>
        <section className="panel empty-state">
          <h2>Quote builder is part of your paid workspace</h2>
          <Link className="button button-primary" href="/billing">Activate monthly access</Link>
        </section>
      </div>
    );
  }

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id,name")
    .eq("business_id", business.id)
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error(`Could not load clients: ${error.message}`);

  return (
    <div className="page-content">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Quote builder</p>
          <h1>Price the job</h1>
          <p className="muted">Calculate labour, call-out, materials, markup and VAT.</p>
        </div>
        <Link className="button button-secondary" href="/quotes">Quote history</Link>
      </header>
      <QuoteCalculator business={business} clients={clients ?? []} />
    </div>
  );
}
