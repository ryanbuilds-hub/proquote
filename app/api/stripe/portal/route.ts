import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (businessError) {
    console.error("Could not load business for billing portal", businessError);
    return NextResponse.json({ error: "Could not load your business account." }, { status: 500 });
  }
  if (!business) {
    return NextResponse.json({ error: "Business account not found." }, { status: 404 });
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("business_id", business.id)
    .maybeSingle();
  if (subscriptionError) {
    console.error("Could not load customer for billing portal", subscriptionError);
    return NextResponse.json({ error: "Could not load your billing account." }, { status: 500 });
  }
  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer is linked to this account yet." }, { status: 404 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!stripeKey || !appUrl) {
    return NextResponse.json({ error: "Stripe billing is not fully configured." }, { status: 503 });
  }

  try {
    const stripe = new Stripe(stripeKey);
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl.replace(/\/$/, "")}/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe billing portal session creation failed", error);
    return NextResponse.json({ error: "Could not open subscription management." }, { status: 502 });
  }
}
