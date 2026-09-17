import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgPlan, reportsThisMonth } from "@/lib/quota";
import { ReportForm } from "./report-form";

export default async function ReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/zaloguj");

  const [locations, plan, used] = await Promise.all([
    prisma.location.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    getOrgPlan(user.organizationId),
    reportsThisMonth(user.organizationId),
  ]);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold text-neutral-900">
        Zgłoś zapytanie klienta
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Klient pytał o coś, czego nie mieliście na stanie? Zapisz to w kilka
        sekund.
      </p>

      {plan.maxReportsPerMonth !== null && (
        <p className="mt-2 text-xs text-neutral-400">
          Wykorzystano {used} / {plan.maxReportsPerMonth} zgłoszeń w tym
          miesiącu (plan {plan.name}).
        </p>
      )}

      <div className="mt-6">
        {locations.length === 0 ? (
          <p className="text-sm text-red-600">
            Brak skonfigurowanej lokalizacji — dodaj ją w Ustawieniach.
          </p>
        ) : (
          <ReportForm locations={locations} />
        )}
      </div>
    </div>
  );
}
