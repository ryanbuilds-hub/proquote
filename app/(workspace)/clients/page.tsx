import { ClientManager } from "@/components/client-manager";
import { requireWorkspace } from "@/lib/workspace";
import Link from "next/link";

export default async function ClientsPage() {
  const { supabase, business, isPaid } = await requireWorkspace();

  if (!isPaid) {
    return (
      <div className="page-content">
        <header className="page-heading">
          <div><p className="eyebrow">Directory</p><h1>Your clients</h1></div>
        </header>
        <section className="panel empty-state">
          <h2>Client directory is part of your paid workspace</h2>
          <p className="muted">Your client information stays private to your business.</p>
          <Link className="button button-primary" href="/billing">Activate monthly access</Link>
        </section>
      </div>
    );
  }

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id,name,email,phone,address,notes,created_at")
    .eq("business_id", business.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load clients: ${error.message}`);

  return (
    <div className="page-content">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Directory</p>
          <h1>Your clients</h1>
          <p className="muted">Keep your customer details ready for the next job.</p>
        </div>
      </header>
      <ClientManager clients={clients ?? []} />
    </div>
  );
}
