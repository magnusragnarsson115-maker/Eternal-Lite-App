"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function DashboardFilters({
  months,
  locations,
  selectedMonth,
  selectedLocation,
}: {
  months: { value: string; label: string }[];
  locations: { id: string; name: string }[];
  selectedMonth: string;
  selectedLocation: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={selectedMonth}
        onChange={(e) => update("month", e.target.value)}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
      >
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      {locations.length > 1 && (
        <select
          value={selectedLocation}
          onChange={(e) => update("location", e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
        >
          <option value="all">Wszystkie lokalizacje</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
