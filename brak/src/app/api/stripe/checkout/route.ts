import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, priceIdForPlan, appUrl } from "@/lib/stripe";
import { PLANS, type PlanId } from "@/lib/plans";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Wymagane logowanie" }, { status: 401 });
  }
  if (user.role !== "OWNER") {
    return NextResponse.json(
      { error: "Tylko właściciel konta może zmieniać plan" },
      { status: 403 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Płatności nie są jeszcze skonfigurowane (brak STRIPE_SECRET_KEY)" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const planId = body?.plan as PlanId | undefined;
  if (!planId || !PLANS[planId] || planId === "FREE") {
    return NextResponse.json({ error: "Nieprawidłowy plan" }, { status: 400 });
  }

  const priceId = priceIdForPlan(planId);
  if (!priceId) {
    return NextResponse.json(
      { error: `Brak skonfigurowanej ceny Stripe dla planu ${planId}` },
      { status: 400 }
    );
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: user.organizationId },
  });

  let stripeCustomerId = subscription?.stripeCustomerId ?? null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.organizationName,
      metadata: { organizationId: user.organizationId },
    });
    stripeCustomerId = customer.id;
    await prisma.subscription.update({
      where: { organizationId: user.organizationId },
      data: { stripeCustomerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.organizationId,
    subscription_data: { metadata: { organizationId: user.organizationId } },
    success_url: `${appUrl()}/app/ustawienia?checkout=success`,
    cancel_url: `${appUrl()}/app/ustawienia?checkout=cancel`,
  });

  return NextResponse.json({ url: session.url });
}
