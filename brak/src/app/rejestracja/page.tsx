"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type RegisterState } from "./actions";

const initialState: RegisterState = {};

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    initialState
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900">
        Załóż konto BRAK
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Rejestr utraconej sprzedaży dla Twojego sklepu lub hurtowni.
      </p>

      <form action={formAction} className="mt-8 flex flex-col gap-4">
        <Field
          label="Nazwa firmy"
          name="organizationName"
          required
          placeholder="Hurtownia Elektryczna Nowak"
        />
        <Field
          label="Branża (opcjonalnie)"
          name="industry"
          placeholder="hurtownia elektryczna"
        />
        <Field
          label="Nazwa pierwszej lokalizacji"
          name="locationName"
          required
          defaultValue="Sklep główny"
        />
        <Field
          label="Imię i nazwisko"
          name="ownerName"
          required
          placeholder="Jan Kowalski"
        />
        <Field
          label="E-mail"
          name="email"
          type="email"
          required
          placeholder="jan@firma.pl"
        />
        <Field
          label="Hasło"
          name="password"
          type="password"
          required
          placeholder="min. 8 znaków"
        />

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? "Tworzenie konta…" : "Załóż konto"}
        </button>
      </form>

      <p className="mt-6 text-sm text-neutral-500">
        Masz już konto?{" "}
        <Link href="/zaloguj" className="font-medium text-neutral-900 underline">
          Zaloguj się
        </Link>
      </p>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
      />
    </label>
  );
}
