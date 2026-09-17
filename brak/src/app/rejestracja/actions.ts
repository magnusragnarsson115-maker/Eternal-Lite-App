"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSessionForUser } from "@/lib/auth";
import { slugify, randomSuffix } from "@/lib/slug";

const schema = z.object({
  organizationName: z.string().trim().min(2, "Podaj nazwę firmy").max(120),
  industry: z.string().trim().max(120).optional(),
  locationName: z.string().trim().min(1, "Podaj nazwę lokalizacji").max(120),
  ownerName: z.string().trim().min(2, "Podaj imię i nazwisko").max(120),
  email: z.string().trim().toLowerCase().email("Nieprawidłowy adres e-mail"),
  password: z.string().min(8, "Hasło musi mieć min. 8 znaków").max(200),
});

export type RegisterState = { error?: string };

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const parsed = schema.safeParse({
    organizationName: formData.get("organizationName"),
    industry: formData.get("industry") || undefined,
    locationName: formData.get("locationName"),
    ownerName: formData.get("ownerName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  const {
    organizationName,
    industry,
    locationName,
    ownerName,
    email,
    password,
  } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Konto z tym adresem e-mail już istnieje" };
  }

  const baseSlug = slugify(organizationName) || "firma";
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const taken = await prisma.organization.findUnique({ where: { slug } });
    if (!taken) break;
    slug = `${baseSlug}-${randomSuffix()}`;
  }

  const passwordHash = await hashPassword(password);

  const userId = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: organizationName, slug, industry: industry || null },
    });

    const location = await tx.location.create({
      data: { organizationId: org.id, name: locationName },
    });

    await tx.subscription.create({
      data: { organizationId: org.id, plan: "FREE", status: "ACTIVE" },
    });

    const user = await tx.user.create({
      data: {
        organizationId: org.id,
        locationId: location.id,
        email,
        passwordHash,
        name: ownerName,
        role: "OWNER",
      },
    });

    return user.id;
  });

  await createSessionForUser(userId);
  redirect("/app");
}
