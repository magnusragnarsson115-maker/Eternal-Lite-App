"use client";

import { useState } from "react";
import { PLANS, type PlanId } from "@/lib/plans";

const UPGRADE_PLANS: PlanId[] = ["SOLO", "TEAM", "MULTI"];

export function PlanPicker({ currentPlan }: { currentPlan: PlanId }) {
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(planId: PlanId) {
    setError(null);
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nie udało się rozpocząć płatności.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {UPGRADE_PLANS.map((id) => {
          const plan = PLANS[id];
          const isCurrent = currentPlan === id;
          return (
            <div
              key={id}
              className={`rounded-lg border p-4 ${
                isCurrent ? "border-neutral-900" : "border-neutral-200"
              }`}
            >
              <div className="text-sm font-medium text-neutral-500">
                {plan.name}
              </div>
              <div className="mt-1 text-xl font-semibold text-neutral-900">
                {plan.priceMonthlyPln} zł
                <span className="text-sm font-normal text-neutral-400">
                  {" "}
                  / mies.
                </span>
              </div>
              <ul className="mt-2 space-y-0.5 text-xs text-neutral-500">
                <li>do {plan.maxLocations} lokalizacji</li>
                <li>do {plan.maxUsers} kont</li>
                <li>{plan.reportsExport ? "eksport raportów" : "bez eksportu"}</li>
              </ul>
              <button
                type="button"
                disabled={isCurrent || loadingPlan !== null}
                onClick={() => choose(id)}
                className="mt-3 w-full rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40"
              >
                {isCurrent
                  ? "Bieżący plan"
                  : loadingPlan === id
                    ? "Przekierowanie…"
                    : "Wybierz"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
