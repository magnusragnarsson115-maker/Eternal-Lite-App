"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseLostSaleText } from "@/lib/ai";
import { getOrgPlan, reportsThisMonth } from "@/lib/quota";
import { REASONS } from "@/lib/reasons";

const reasonValues = REASONS.map((r) => r.value) as [string, ...string[]];

const schema = z.object({
  rawText: z.string().trim().min(2, "Opisz, o co pytał klient").max(300),
  locationId: z.string().min(1, "Wybierz lokalizację"),
  quantity: z.string().optional(),
  acceptedPrice: z.string().optional(),
  reason: z.enum(reasonValues).optional().or(z.literal("")),
  customerContact: z.string().trim().max(200).optional(),
});

export type SubmitReportState = {
  error?: string;
  success?: {
    productName: string;
    category: string | null;
    quantity: number;
  };
};

export async function submitReportAction(
  _prevState: SubmitReportState,
  formData: FormData
): Promise<SubmitReportState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesja wygasła — zaloguj się ponownie." };

  const parsed = schema.safeParse({
    rawText: formData.get("rawText"),
    locationId: formData.get("locationId"),
    quantity: formData.get("quantity") || undefined,
    acceptedPrice: formData.get("acceptedPrice") || undefined,
    reason: formData.get("reason") || undefined,
    customerContact: formData.get("customerContact") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  const location = await prisma.location.findFirst({
    where: { id: parsed.data.locationId, organizationId: user.organizationId },
  });
  if (!location) return { error: "Nieprawidłowa lokalizacja" };

  const plan = await getOrgPlan(user.organizationId);
  if (plan.maxReportsPerMonth !== null) {
    const used = await reportsThisMonth(user.organizationId);
    if (used >= plan.maxReportsPerMonth) {
      return {
        error: `Limit planu Free (${plan.maxReportsPerMonth} zgłoszeń / mies.) wyczerpany. Przejdź na plan płatny w Ustawieniach.`,
      };
    }
  }

  const ai = await parseLostSaleText(parsed.data.rawText);

  const manualQuantity = parsed.data.quantity
    ? Number.parseInt(parsed.data.quantity, 10)
    : null;
  const quantity =
    manualQuantity && Number.isFinite(manualQuantity) && manualQuantity > 0
      ? manualQuantity
      : ai.quantity;

  const manualPrice = parsed.data.acceptedPrice
    ? Number.parseFloat(parsed.data.acceptedPrice.replace(",", "."))
    : null;
  const acceptedPrice =
    manualPrice !== null && Number.isFinite(manualPrice) && manualPrice >= 0
      ? manualPrice
      : null;

  let categoryId: string | null = null;
  if (ai.category) {
    const category = await prisma.category.upsert({
      where: {
        organizationId_name: {
          organizationId: user.organizationId,
          name: ai.category,
        },
      },
      create: { organizationId: user.organizationId, name: ai.category },
      update: {},
    });
    categoryId = category.id;
  }

  await prisma.lostSaleReport.create({
    data: {
      organizationId: user.organizationId,
      locationId: location.id,
      reportedById: user.id,
      rawText: parsed.data.rawText,
      productName: ai.productName,
      categoryId,
      quantity,
      acceptedPrice,
      reason: parsed.data.reason || null,
      customerContact: parsed.data.customerContact || null,
    },
  });

  return {
    success: { productName: ai.productName, category: ai.category, quantity },
  };
}
