import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const expectedPriceId = process.env.STRIPE_MONTHLY_PRICE_ID;
  const signature = request.headers.get("stripe-signature");
  if (!stripeKey || !webhookSecret || !serviceRoleKey || !expectedPriceId) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const stripe = new Stripe(stripeKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (
    event.type !== "customer.subscription.created" &&
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted"
  ) {
    return NextResponse.json({ received: true });
  }

  const eventSubscription = event.data.object as Stripe.Subscription;
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
  } catch (error) {
    console.error("Could not retrieve current Stripe subscription state", {
      eventId: event.id,
      error,
    });
    return NextResponse.json({ error: "Could not retrieve current subscription status." }, { status: 502 });
  }
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const expectedPriceActive = subscription.items.data.some(
    (item) => item.price.id === expectedPriceId,
  );

  try {
    const admin = createAdminClient();
    let businessId = subscription.metadata.business_id;

    if (!businessId) {
      const { data: linkedSubscription, error: lookupError } = await admin
        .from("subscriptions")
        .select("business_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      if (lookupError) throw new Error(`Could not link Stripe customer: ${lookupError.message}`);
      businessId = linkedSubscription?.business_id ?? "";
    }

    if (!businessId) {
      console.error("Stripe subscription has no matching ProQuote business", {
        eventId: event.id,
        subscriptionId: subscription.id,
      });
      return NextResponse.json({ error: "Subscription is not linked to a business." }, { status: 400 });
    }

    const { data: business, error: businessError } = await admin
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .maybeSingle();
    if (businessError) throw new Error(`Could not verify business: ${businessError.message}`);
    if (!business) {
      console.error("Stripe subscription references an unknown ProQuote business", {
        eventId: event.id,
        businessId,
      });
      return NextResponse.json({ error: "Business account was not found." }, { status: 400 });
    }

    const { error: saveError } = await admin.from("subscriptions").upsert(
      {
        business_id: businessId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: subscription.items.data[0]?.price.id ?? null,
        status: expectedPriceActive ? subscription.status : "incomplete",
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      { onConflict: "business_id" },
    );
    if (saveError) throw new Error(`Could not save subscription update: ${saveError.message}`);
  } catch (error) {
    console.error("Stripe subscription sync failed", { eventId: event.id, error });
    return NextResponse.json({ error: "Could not sync subscription status." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
