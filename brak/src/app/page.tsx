import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold text-neutral-900">BRAK</span>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/zaloguj" className="text-neutral-600 hover:text-neutral-900">
              Zaloguj się
            </Link>
            <Link
              href="/rejestracja"
              className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white hover:bg-neutral-700"
            >
              Załóż konto
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto flex max-w-3xl flex-1 flex-col justify-center px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
          Rejestr utraconej sprzedaży
        </h1>
        <p className="mt-4 text-lg text-neutral-600">
          Klient pyta o produkt, którego nie macie. Pracownik odpowiada
          &bdquo;nie&rdquo;, klient wychodzi — i informacja o popycie znika.
          BRAK zapisuje ją w kilka sekund i pokazuje, ile sprzedaży tracisz
          każdego miesiąca.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/rejestracja"
            className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Zacznij za darmo
          </Link>
          <Link
            href="/zaloguj"
            className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Mam już konto
          </Link>
        </div>
      </section>

      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto grid max-w-4xl gap-8 px-6 py-16 sm:grid-cols-3">
          <Feature
            title="1. Zgłoś"
            text={
              '„Wiertarka Makita DDF484” — pracownik wpisuje to, co powiedział klient. AI zamienia to na produkt, kategorię i ilość.'
            }
          />
          <Feature
            title="2. Zobacz popyt"
            text="Dashboard pokazuje, o co pytają klienci najczęściej, a czego nie macie na stanie."
          />
          <Feature
            title="3. Policz stratę"
            text="Szacowana utracona sprzedaż w złotówkach — konkretna liczba, nie przeczucie."
          />
        </div>
      </section>

      <section className="border-t border-neutral-200">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-center text-xl font-semibold text-neutral-900">
            Cennik
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            <PricingCard name="Free" price="0 zł" desc="50 zgłoszeń / mies." />
            <PricingCard name="1 punkt" price="29 zł" desc="1 lokalizacja" />
            <PricingCard
              name="Kilka stanowisk"
              price="69 zł"
              desc="więcej pracowników"
            />
            <PricingCard
              name="Kilka lokalizacji"
              price="149 zł"
              desc="+ raporty"
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-400">
        BRAK — rejestr utraconej sprzedaży
      </footer>
    </main>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="font-semibold text-neutral-900">{title}</h3>
      <p className="mt-2 text-sm text-neutral-600">{text}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  desc,
}: {
  name: string;
  price: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 text-center">
      <div className="text-sm font-medium text-neutral-500">{name}</div>
      <div className="mt-1 text-2xl font-bold text-neutral-900">{price}</div>
      <div className="mt-1 text-xs text-neutral-500">{desc}</div>
    </div>
  );
}
