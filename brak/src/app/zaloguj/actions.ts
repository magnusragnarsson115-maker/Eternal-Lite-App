"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionForUser } from "@/lib/auth";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Nieprawidłowy adres e-mail"),
  password: z.string().min(1, "Podaj hasło"),
});

export type LoginState = { error?: string };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (!user) return { error: "Nieprawidłowy e-mail lub hasło" };

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return { error: "Nieprawidłowy e-mail lub hasło" };

  await createSessionForUser(user.id);
  redirect("/app");
}
