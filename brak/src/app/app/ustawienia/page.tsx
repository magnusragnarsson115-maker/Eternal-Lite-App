import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgPlan, reportsThisMonth } from "@/lib/quota";
import { PLANS, type PlanId } from "@/lib/plans";
import { PlanPicker } from "./plan-picker";
import { ManageSubscriptionButton } from "./manage-subscription-button";
import { addLocationAction, addUserAction } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/zaloguj");

  const { error, success } = await searchParams;

  const [subscription, locations, users, plan, used] = await Promise.all([
    prisma.subscription.findUnique({
      where: { organizationId: user.organizationId },
    }),
    prisma.location.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "asc" },
      include: { location: true },
    }),
    getOrgPlan(user.organizationId),
    reportsThisMonth(user.organizationId),
  ]);

  const isOwner = user.role === "OWNER";
  const currentPlanId = (subscription?.plan ?? "FREE") as PlanId;

  return (
    <div className="flex flex-col gap-10">
      {(error || success) && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {error || success}
        </div>
      )}

      <section>
        <h1 className="text-xl font-semibold text-neutral-900">Ustawienia</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {user.organizationName}
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-900">Plan</h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4">
          <div>
            <div className="text-lg font-semibold text-neutral-900">
              {PLANS[currentPlanId].name} · {subscription?.status ?? "ACTIVE"}
            </div>
            {plan.maxReportsPerMonth !== null && (
              <div className="text-xs text-neutral-500">
                {used} / {plan.maxReportsPerMonth} zgłoszeń w tym miesiącu
              </div>
            )}
            <div className="text-xs text-neutral-500">
              {locations.length} / {plan.maxLocations} lokalizacji ·{" "}
              {users.length} / {plan.maxUsers} kont
            </div>
          </div>
          {subscription?.stripeCustomerId && <ManageSubscriptionButton />}
        </div>

        {isOwner && (
          <div className="mt-4">
            <PlanPicker currentPlan={currentPlanId} />
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-900">Lokalizacje</h2>
        <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <ul className="divide-y divide-neutral-100">
            {locations.map((loc) => (
              <li
                key={loc.id}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="text-neutral-900">{loc.name}</span>
                {loc.address && (
                  <span className="text-neutral-400">{loc.address}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        {isOwner && locations.length < plan.maxLocations && (
          <form
            action={addLocationAction}
            className="mt-3 flex flex-wrap items-end gap-2"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-700">
                Nowa lokalizacja
              </span>
              <input
                name="name"
                required
                placeholder="np. Magazyn Poznań"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Dodaj
            </button>
          </form>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-900">Pracownicy</h2>
        <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <ul className="divide-y divide-neutral-100">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="text-neutral-900">
                  {u.name} <span className="text-neutral-400">· {u.email}</span>
                </span>
                <span className="text-neutral-400">
                  {u.role === "OWNER" ? "właściciel" : "pracownik"}
                  {u.location ? ` · ${u.location.name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {isOwner && users.length < plan.maxUsers && (
          <form
            action={addUserAction}
            className="mt-3 grid gap-2 sm:grid-cols-2"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-700">Imię i nazwisko</span>
              <input
                name="name"
                required
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-700">E-mail</span>
              <input
                name="email"
                type="email"
                required
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-700">
                Hasło początkowe
              </span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-700">Lokalizacja</span>
              <select
                name="locationId"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="sm:col-span-2 mt-1 w-fit rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Dodaj pracownika
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
