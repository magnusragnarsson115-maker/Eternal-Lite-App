import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";
import { prisma } from "@/lib/prisma";
import { planOf } from "@/lib/plans";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/zaloguj");

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: user.organizationId },
  });
  const plan = planOf(subscription?.plan ?? "FREE");

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/app" className="text-lg font-semibold text-neutral-900">
              BRAK
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/app" className="text-neutral-600 hover:text-neutral-900">
                Zgłoś
              </Link>
              <Link
                href="/app/dashboard"
                className="text-neutral-600 hover:text-neutral-900"
              >
                Dashboard
              </Link>
              <Link
                href="/app/ustawienia"
                className="text-neutral-600 hover:text-neutral-900"
              >
                Ustawienia
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <span>
              {user.organizationName} · <span className="font-medium">{plan.name}</span>
            </span>
            <span className="hidden sm:inline">{user.name}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-neutral-700 hover:bg-neutral-100"
              >
                Wyloguj
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
