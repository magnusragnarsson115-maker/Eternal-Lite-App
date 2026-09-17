import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgPlan } from "@/lib/quota";
import { monthRange, recentMonths, monthKey } from "@/lib/months";
import { DashboardFilters } from "./filters";
import { RankedBarChart } from "./ranked-bar-chart";

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

type SearchParams = { month?: string; location?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/zaloguj");

  const params = await searchParams;
  const months = recentMonths(6);
  const selectedMonth =
    params.month && months.some((m) => m.value === params.month)
      ? params.month
      : monthKey(new Date());
  const selectedLocation = params.location ?? "all";

  const [locations, plan] = await Promise.all([
    prisma.location.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    getOrgPlan(user.organizationId),
  ]);

  const { start, end } = monthRange(selectedMonth);

  const reports = await prisma.lostSaleReport.findMany({
    where: {
      organizationId: user.organizationId,
      createdAt: { gte: start, lt: end },
      ...(selectedLocation !== "all" ? { locationId: selectedLocation } : {}),
    },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  type Agg = { count: number; quantity: number; revenue: number; category: string | null };
  const byProduct = new Map<string, Agg>();
  const byCategory = new Map<string, number>();
  let estimatedRevenue = 0;
  let pricedCount = 0;

  for (const r of reports) {
    const key = r.productName;
    const existing = byProduct.get(key) ?? {
      count: 0,
      quantity: 0,
      revenue: 0,
      category: r.category?.name ?? null,
    };
    existing.count += 1;
    existing.quantity += r.quantity;
    if (r.acceptedPrice != null) {
      existing.revenue += r.acceptedPrice * r.quantity;
    }
    byProduct.set(key, existing);

    const catName = r.category?.name ?? "bez kategorii";
    byCategory.set(catName, (byCategory.get(catName) ?? 0) + 1);

    if (r.acceptedPrice != null) {
      estimatedRevenue += r.acceptedPrice * r.quantity;
      pricedCount += 1;
    }
  }

  const topProducts = [...byProduct.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  const topCategories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            Utracony popyt
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Czego pytali klienci, a czego nie mieliście na stanie.
          </p>
        </div>
        <DashboardFilters
          months={months}
          locations={locations}
          selectedMonth={selectedMonth}
          selectedLocation={selectedLocation}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Szacowana utracona sprzedaż"
          value={pln.format(estimatedRevenue)}
          hint={
            pricedCount < reports.length
              ? `oparte na ${pricedCount} z ${reports.length} zgłoszeń z podaną ceną`
              : "na podstawie ceny zaakceptowanej przez klienta"
          }
        />
        <StatTile label="Zgłoszenia w okresie" value={String(reports.length)} />
        <StatTile
          label="Unikalne produkty"
          value={String(byProduct.size)}
        />
      </div>

      {plan.reportsExport ? null : (
        <p className="mt-4 text-xs text-neutral-400">
          Eksport raportów do CSV dostępny w planie &bdquo;Kilka lokalizacji + raporty&rdquo;.
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-neutral-900">
            Najczęściej brakujące produkty
          </h2>
          <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-4">
            <RankedBarChart
              data={topProducts.map(([name, a]) => ({ name, value: a.count }))}
              valueLabel="zapytań"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-neutral-900">
            Najczęściej brakujące kategorie
          </h2>
          <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-4">
            <RankedBarChart
              data={topCategories.map(([name, value]) => ({ name, value }))}
              valueLabel="zapytań"
            />
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-900">
          Szczegóły — tabela
        </h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Produkt</th>
                <th className="px-4 py-2 font-medium">Kategoria</th>
                <th className="px-4 py-2 font-medium">Zapytania</th>
                <th className="px-4 py-2 font-medium">Sztuki</th>
                <th className="px-4 py-2 font-medium">Szac. wartość</th>
              </tr>
            </thead>
            <tbody>
              {[...byProduct.entries()]
                .sort((a, b) => b[1].count - a[1].count)
                .map(([name, a]) => (
                  <tr key={name} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2 text-neutral-900">{name}</td>
                    <td className="px-4 py-2 text-neutral-600">
                      {a.category ?? "—"}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-neutral-600">
                      {a.count}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-neutral-600">
                      {a.quantity}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-neutral-600">
                      {a.revenue > 0 ? pln.format(a.revenue) : "—"}
                    </td>
                  </tr>
                ))}
              {byProduct.size === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-neutral-400"
                  >
                    Brak zgłoszeń w wybranym okresie.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="text-xs font-medium text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-neutral-400">{hint}</div>}
    </div>
  );
}
