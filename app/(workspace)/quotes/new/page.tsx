import Link from "next/link";
import { QuoteCalculator } from "@/components/quote-calculator";
import { FREE_PLAN_LIMITS } from "@/lib/plan-limits";
import { requireWorkspaceDataAccess } from "@/lib/workspace";

export default async function NewQuotePage() {
  const { supabase, business, isPaid } = await requireWorkspaceDataAccess();
  const [clients, quoteCount] = await Promise.all([
    supabase
      .from("clients")
      .select("id,name")
      .eq("business_id", business.id)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id),
  ]);
  if (clients.error) throw new Error(`Could not load clients: ${clients.error.message}`);
  if (quoteCount.error) throw new Error(`Could not load quote count: ${quoteCount.error.message}`);

  return (
    <div className="page-content">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Quote builder</p>
          <h1>Price the job</h1>
          <p className="muted">
            Calculate labour, call-out, materials, markup and VAT.
            {!isPaid && ` Free plan: ${quoteCount.count ?? 0}/${FREE_PLAN_LIMITS.quotes} saved quotes.`}
          </p>
        </div>
        <Link className="button button-secondary" href="/quotes">Quote history</Link>
      </header>
      <QuoteCalculator
        business={business}
        clients={clients.data ?? []}
        isPaid={isPaid}
        quoteCount={quoteCount.count ?? 0}
      />
    </div>
  );
}
