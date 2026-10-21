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
    .select("id,name,email")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (businessError) {
    console.error("Could not load business for checkout", businessError);
    return NextResponse.json({ error: "Could not load your business account." }, { status: 500 });
  }
  if (!business) return NextResponse.json({ error: "Business account not found." }, { status: 404 });

  const { data: currentSubscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("business_id", business.id)
    .maybeSingle();
  if (subscriptionError) {
    console.error("Could not check subscription before checkout", subscriptionError);
    return NextResponse.json({ error: "Could not check your subscription status." }, { status: 500 });
  }
  if (currentSubscription?.status === "active" || currentSubscription?.status === "trialing") {
    return NextResponse.json({ error: "Your subscription is already active." }, { status: 409 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const priceId = process.env.STRIPE_MONTHLY_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!stripeKey || !webhookSecret || !serviceRoleKey || !priceId || !appUrl) {
    return NextResponse.json({ error: "Stripe billing is not fully configured." }, { status: 503 });
  }

  try {
    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: business.email || user.email,
      client_reference_id: business.id,
      metadata: { business_id: business.id },
      subscription_data: { metadata: { business_id: business.id } },
      success_url: `${appUrl.replace(/\/$/, "")}/billing?checkout=success`,
      cancel_url: `${appUrl.replace(/\/$/, "")}/billing?checkout=cancelled`,
    });
    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout session creation failed", error);
    return NextResponse.json({ error: "Could not start secure checkout." }, { status: 502 });
  }
}
