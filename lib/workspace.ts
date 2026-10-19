import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireWorkspace() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Could not load business profile: ${error.message}`);
  if (!business) redirect("/login?error=account");

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("business_id", business.id)
    .maybeSingle();

  if (subscriptionError) {
    throw new Error(`Could not load subscription status: ${subscriptionError.message}`);
  }

  return {
    supabase,
    user,
    business,
    subscription,
    isPaid:
      !business.is_suspended &&
      (subscription?.status === "active" || subscription?.status === "trialing"),
    isPlatformAdmin: user.app_metadata.platform_admin === true,
  };
}
