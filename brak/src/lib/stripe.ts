import Stripe from "stripe";
import { PLANS, type PlanId } from "@/lib/plans";

let client: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  client = key ? new Stripe(key) : null;
  return client;
}

export function priceIdForPlan(planId: PlanId): string | null {
  const plan = PLANS[planId];
  if (!plan.stripeEnvVar) return null;
  return process.env[plan.stripeEnvVar] || null;
}

export function planForPriceId(priceId: string): PlanId | null {
  const entries = Object.values(PLANS).filter((p) => p.stripeEnvVar);
  for (const plan of entries) {
    const envValue = plan.stripeEnvVar ? process.env[plan.stripeEnvVar] : null;
    if (envValue && envValue === priceId) return plan.id;
  }
  return null;
}

export function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}
