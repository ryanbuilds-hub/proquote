import { ClientManager } from "@/components/client-manager";
import { FREE_PLAN_LIMITS } from "@/lib/plan-limits";
import { requireWorkspaceDataAccess } from "@/lib/workspace";

export default async function ClientsPage() {
  const { supabase, business, isPaid } = await requireWorkspaceDataAccess();

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
          <p className="muted">
            {isPaid
              ? "Keep your customer details ready for the next job."
              : `Free plan: up to ${FREE_PLAN_LIMITS.clients} active clients. Upgrade for unlimited clients.`}
          </p>
        </div>
      </header>
      <ClientManager
        clients={clients ?? []}
        isPaid={isPaid}
        clientLimit={FREE_PLAN_LIMITS.clients}
      />
    </div>
  );
}
