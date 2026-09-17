export type PlanId = "FREE" | "SOLO" | "TEAM" | "MULTI";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceMonthlyPln: number;
  maxLocations: number;
  maxUsers: number;
  maxReportsPerMonth: number | null; // null = bez limitu
  reportsExport: boolean;
  stripeEnvVar: "STRIPE_PRICE_SOLO" | "STRIPE_PRICE_TEAM" | "STRIPE_PRICE_MULTI" | null;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Free",
    priceMonthlyPln: 0,
    maxLocations: 1,
    maxUsers: 1,
    maxReportsPerMonth: 50,
    reportsExport: false,
    stripeEnvVar: null,
  },
  SOLO: {
    id: "SOLO",
    name: "1 punkt",
    priceMonthlyPln: 29,
    maxLocations: 1,
    maxUsers: 3,
    maxReportsPerMonth: null,
    reportsExport: false,
    stripeEnvVar: "STRIPE_PRICE_SOLO",
  },
  TEAM: {
    id: "TEAM",
    name: "Kilka stanowisk",
    priceMonthlyPln: 69,
    maxLocations: 1,
    maxUsers: 10,
    maxReportsPerMonth: null,
    reportsExport: false,
    stripeEnvVar: "STRIPE_PRICE_TEAM",
  },
  MULTI: {
    id: "MULTI",
    name: "Kilka lokalizacji + raporty",
    priceMonthlyPln: 149,
    maxLocations: 10,
    maxUsers: 50,
    maxReportsPerMonth: null,
    reportsExport: true,
    stripeEnvVar: "STRIPE_PRICE_MULTI",
  },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "SOLO", "TEAM", "MULTI"];

export function planOf(id: string): PlanDefinition {
  return PLANS[id as PlanId] ?? PLANS.FREE;
}
