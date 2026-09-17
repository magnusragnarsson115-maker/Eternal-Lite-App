import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, appUrl } from "@/lib/stripe";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Wymagane logowanie" }, { status: 401 });
  }
  if (user.role !== "OWNER") {
    return NextResponse.json(
      { error: "Tylko właściciel konta może zarządzać subskrypcją" },
      { status: 403 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Płatności nie są jeszcze skonfigurowane" },
      { status: 400 }
    );
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: user.organizationId },
  });
  if (!subscription?.stripeCustomerId) {
    return NextResponse.json(
      { error: "Brak aktywnej subskrypcji do zarządzania" },
      { status: 400 }
    );
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl()}/app/ustawienia`,
  });

  return NextResponse.json({ url: portalSession.url });
}
