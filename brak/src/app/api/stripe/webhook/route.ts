import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe, planForPriceId } from "@/lib/stripe";

function statusFromStripe(status: Stripe.Subscription.Status): string {
  if (status === "active" || status === "trialing") return "ACTIVE";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") {
    return "PAST_DUE";
  }
  return "CANCELED";
}

async function applySubscription(
  organizationId: string,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = priceId ? planForPriceId(priceId) : null;
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

  await prisma.subscription.update({
    where: { organizationId },
    data: {
      stripeCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      stripeSubscriptionId: subscription.id,
      plan: plan ?? undefined,
      status: statusFromStripe(subscription.status),
      currentPeriodEnd: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000)
        : null,
    },
  });
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe nie jest skonfigurowany" },
      { status: 400 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Brak nagłówka stripe-signature");
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nieznany błąd";
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.client_reference_id;
      const subscriptionId = session.subscription;
      if (organizationId && typeof subscriptionId === "string") {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await applySubscription(organizationId, subscription);
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = subscription.metadata?.organizationId;
      if (organizationId) {
        await applySubscription(organizationId, subscription);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = subscription.metadata?.organizationId;
      if (organizationId) {
        await prisma.subscription.update({
          where: { organizationId },
          data: { plan: "FREE", status: "ACTIVE", stripeSubscriptionId: null },
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
