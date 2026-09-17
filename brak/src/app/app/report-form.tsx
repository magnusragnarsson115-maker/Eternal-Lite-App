"use client";

import { useActionState, useState } from "react";
import { submitReportAction, type SubmitReportState } from "./actions";
import { REASONS } from "@/lib/reasons";

const initialState: SubmitReportState = {};

export function ReportForm({
  locations,
}: {
  locations: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    submitReportAction,
    initialState
  );
  const [resetKey, setResetKey] = useState(0);
  const [showOptional, setShowOptional] = useState(false);
  const [lastSuccess, setLastSuccess] = useState(state.success);

  if (state.success !== lastSuccess) {
    setLastSuccess(state.success);
    if (state.success) {
      setResetKey((k) => k + 1);
      setShowOptional(false);
    }
  }

  return (
    <div>
      {state.success && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Zapisano: <strong>{state.success.productName}</strong>
          {state.success.category ? ` → ${state.success.category}` : ""} ×{" "}
          {state.success.quantity} szt.
        </div>
      )}
      {state.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <form key={resetKey} action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-700">
            Klient pytał o…
          </span>
          <input
            name="rawText"
            required
            autoFocus
            placeholder="np. wiertarka Makita DDF484"
            className="rounded-md border border-neutral-300 px-4 py-3 text-base text-neutral-900 outline-none focus:border-neutral-900"
          />
        </label>

        {locations.length > 1 ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-neutral-700">
              Lokalizacja
            </span>
            <select
              name="locationId"
              required
              defaultValue={locations[0]?.id}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input
            type="hidden"
            name="locationId"
            value={locations[0]?.id ?? ""}
          />
        )}

        <button
          type="button"
          onClick={() => setShowOptional((v) => !v)}
          className="self-start text-sm font-medium text-neutral-600 underline"
        >
          {showOptional ? "Ukryj szczegóły" : "+ Dodaj szczegóły (opcjonalnie)"}
        </button>

        {showOptional && (
          <div className="grid gap-4 rounded-md border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-700">
                Liczba sztuk
              </span>
              <input
                name="quantity"
                type="number"
                min={1}
                placeholder="1"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-700">
                Cena zaakceptowana przez klienta
              </span>
              <input
                name="acceptedPrice"
                type="number"
                min={0}
                step="0.01"
                placeholder="np. 499.00"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-700">
                Powód braku
              </span>
              <select
                name="reason"
                defaultValue=""
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
              >
                <option value="">— nie podano —</option>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-700">
                Kontakt do klienta (za zgodą)
              </span>
              <input
                name="customerContact"
                placeholder="telefon lub e-mail"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
              />
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 self-start rounded-md bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? "Zapisywanie…" : "Zapisz zgłoszenie"}
        </button>
      </form>
    </div>
  );
}
