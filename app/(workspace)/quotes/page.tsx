import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { formatEuro } from "@/lib/quotes";

export default async function QuotesPage() {
  const { supabase, business, isPaid } = await requireWorkspace();

  if (!isPaid) {
    return (
      <div className="page-content">
        <header className="page-heading">
          <div><p className="eyebrow">Quote history</p><h1>Your quotes</h1></div>
        </header>
        <section className="panel empty-state">
          <h2>Saved quotes are part of your paid workspace</h2>
          <p className="muted">Activate a subscription to create and keep quote records.</p>
          <Link className="button button-primary" href="/billing">Activate monthly access</Link>
        </section>
      </div>
    );
  }

  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id,client_id,quote_number,description,total,status,created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load quotes: ${error.message}`);

  const clientIds = [
    ...new Set(
      (quotes ?? [])
        .map((quote) => quote.client_id)
        .filter((clientId): clientId is string => clientId !== null),
    ),
  ];
  const clientNames = new Map<string, string>();
  if (clientIds.length) {
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id,name")
      .eq("business_id", business.id)
      .in("id", clientIds);
    if (clientsError) throw new Error(`Could not load quote client names: ${clientsError.message}`);
    clients?.forEach((client) => clientNames.set(client.id, client.name));
  }

  return (
    <div className="page-content">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Quote history</p>
          <h1>Your quotes</h1>
          <p className="muted">Your latest saved estimates for work and materials.</p>
        </div>
        <Link className="button button-primary" href="/quotes/new">New quote</Link>
      </header>
      {(quotes ?? []).length === 0 ? (
        <section className="panel empty-state">
          <h2>No quotes saved yet</h2>
          <p className="muted">Create your first quote and keep it with your account.</p>
          <Link className="button button-primary" href="/quotes/new">Create a quote</Link>
        </section>
      ) : (
        <div className="panel table-panel">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Quote</th><th>Client</th><th>Date</th><th>Status</th><th className="align-right">Total</th></tr></thead>
              <tbody>
                {quotes?.map((quote) => (
                  <tr key={quote.id}>
                    <td>
                      <Link className="quote-table-link" href={`/quotes/${quote.id}`}>
                        <strong>{quote.quote_number}</strong>
                        <span className="table-secondary">{quote.description}</span>
                        <span className="table-open-hint">Open quote →</span>
                      </Link>
                    </td>
                    <td>{quote.client_id ? clientNames.get(quote.client_id) ?? "Archived client" : "—"}</td>
                    <td>{new Date(quote.created_at).toLocaleDateString("en-IE")}</td>
                    <td><span className={`badge quote-status-${quote.status}`}>{quote.status}</span></td>
                    <td className="align-right"><strong>{formatEuro(Number(quote.total))}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
