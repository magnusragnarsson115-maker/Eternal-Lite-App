"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { getOrgPlan } from "@/lib/quota";

function fail(message: string): never {
  redirect(`/app/ustawienia?error=${encodeURIComponent(message)}`);
}

export async function addLocationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) fail("Sesja wygasła — zaloguj się ponownie.");
  if (user.role !== "OWNER") fail("Tylko właściciel może dodawać lokalizacje.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail("Podaj nazwę lokalizacji.");

  const plan = await getOrgPlan(user.organizationId);
  const count = await prisma.location.count({
    where: { organizationId: user.organizationId },
  });
  if (count >= plan.maxLocations) {
    fail(
      `Plan ${plan.name} pozwala na maks. ${plan.maxLocations} lokalizacji. Przejdź na wyższy plan.`
    );
  }

  await prisma.location.create({
    data: { organizationId: user.organizationId, name },
  });
  redirect("/app/ustawienia?success=Dodano+lokalizację");
}

export async function addUserAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) fail("Sesja wygasła — zaloguj się ponownie.");
  if (user.role !== "OWNER") fail("Tylko właściciel może dodawać pracowników.");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const locationId = String(formData.get("locationId") ?? "");

  if (!name || !email || password.length < 8) {
    fail("Uzupełnij imię, e-mail i hasło (min. 8 znaków).");
  }

  const plan = await getOrgPlan(user.organizationId);
  const count = await prisma.user.count({
    where: { organizationId: user.organizationId },
  });
  if (count >= plan.maxUsers) {
    fail(
      `Plan ${plan.name} pozwala na maks. ${plan.maxUsers} kont. Przejdź na wyższy plan.`
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) fail("Konto z tym adresem e-mail już istnieje.");

  const location = locationId
    ? await prisma.location.findFirst({
        where: { id: locationId, organizationId: user.organizationId },
      })
    : null;

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      organizationId: user.organizationId,
      locationId: location?.id ?? null,
      email,
      passwordHash,
      name,
      role: "STAFF",
    },
  });

  redirect("/app/ustawienia?success=Dodano+pracownika");
}
