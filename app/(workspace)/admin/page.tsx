import { redirect } from "next/navigation";
import { OwnerAdmin } from "@/components/owner-admin";
import { requireWorkspace } from "@/lib/workspace";

export default async function AdminPage() {
  const { supabase, isPlatformAdmin } = await requireWorkspace();
  if (!isPlatformAdmin) redirect("/dashboard");

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id,name,email,is_suspended,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load business accounts: ${error.message}`);

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("subscriptions")
    .select("business_id,status,current_period_end,cancel_at_period_end")
    .in("business_id", (businesses ?? []).map((business) => business.id));
  if (subscriptionsError) {
    throw new Error(`Could not load subscription status: ${subscriptionsError.message}`);
  }

  return (
    <div className="page-content">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform owner</p>
          <h1>Business accounts</h1>
          <p className="muted">
            View account and Stripe status. This dashboard cannot access client or quote records.
          </p>
        </div>
      </header>
      <OwnerAdmin businesses={businesses ?? []} subscriptions={subscriptions ?? []} />
    </div>
  );
}
