import { prisma } from "@/lib/prisma";
import { planOf, type PlanDefinition } from "@/lib/plans";

export function monthStart(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export async function reportsThisMonth(organizationId: string): Promise<number> {
  return prisma.lostSaleReport.count({
    where: { organizationId, createdAt: { gte: monthStart() } },
  });
}

export async function getOrgPlan(organizationId: string): Promise<PlanDefinition> {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
  });
  return planOf(sub?.plan ?? "FREE");
}
