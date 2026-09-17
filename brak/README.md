# BRAK — rejestr utraconej sprzedaży

Klient pyta o produkt, którego nie ma na stanie. Pracownik mówi „nie”, klient
wychodzi — i informacja o popycie znika. BRAK zapisuje takie zapytania
w kilka sekund i pokazuje, ile sprzedaży to realnie kosztuje.

Aplikacja webowa (multi-tenant SaaS) dla hurtowni i sklepów specjalistycznych:
elektrycznych, hydraulicznych, budowlanych, motoryzacyjnych, części maszyn.

## Stack

- **Next.js 16** (App Router, Turbopack, TypeScript, React 19)
- **Prisma 6** + SQLite lokalnie (schemat bez natywnych enumów — przenośny
  na PostgreSQL do produkcji, wystarczy zmienić `provider` i `DATABASE_URL`
  w `prisma/schema.prisma`)
- **Autoryzacja własna** — sesje w DB + ciasteczko httpOnly (bez zewnętrznej
  biblioteki auth; prościej i pewniej niż next-auth beta na Next.js 16)
- **Claude API** (`@anthropic-ai/sdk`) — zamienia swobodny tekst pracownika
  („wiertarka Makita DDF484”) na produkt / kategorię / ilość. Bez klucza API
  zgłoszenie i tak się zapisuje (fallback: surowy tekst jako nazwa produktu)
- **Stripe** — subskrypcje (Checkout + Billing Portal + webhook)
- **Recharts** — wykresy na dashboardzie (paleta i specyfikacja marków wg
  wewnętrznego skill-a `dataviz`)

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env   # uzupełnij SESSION_SECRET; reszta opcjonalna do startu
npx prisma migrate dev
npm run db:seed        # opcjonalnie: konto demo demo@brak.app / demo12345
npm run dev
```

Aplikacja wystartuje na `http://localhost:3000`.

## Zmienne środowiskowe (`.env`)

| Zmienna | Wymagana | Opis |
|---|---|---|
| `DATABASE_URL` | tak | connection string Prisma (domyślnie plik SQLite) |
| `SESSION_SECRET` | tak (produkcyjnie) | obecnie nieużywana do podpisu (sesje trzymane w DB) — zarezerwowana pod przyszłe podpisywanie ciasteczek |
| `ANTHROPIC_API_KEY` | nie | bez niej zgłoszenia zapisują się bez kategoryzacji AI |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | nie | bez nich działa tylko plan Free |
| `STRIPE_PRICE_SOLO` / `_TEAM` / `_MULTI` | nie | ID cen Stripe (Price, tryb subscription) dla odpowiednich planów |
| `APP_URL` | tak (do Stripe redirect) | bazowy URL aplikacji |

## Model danych (skrót)

`Organization` (firma) → `Location` (punkty sprzedaży) → `User` (właściciel/
pracownik) → `LostSaleReport` (zgłoszenie: tekst pracownika, produkt/kategoria
sparsowane przez AI, ilość, cena zaakceptowana przez klienta, powód braku,
opcjonalny kontakt). Jedna `Subscription` na organizację.

## Plany

| Plan | Cena | Limity |
|---|---|---|
| Free | 0 zł | 50 zgłoszeń / mies., 1 lokalizacja, 1 konto |
| 1 punkt | 29 zł | 1 lokalizacja, do 3 kont |
| Kilka stanowisk | 69 zł | 1 lokalizacja, do 10 kont |
| Kilka lokalizacji + raporty | 149 zł | do 10 lokalizacji, do 50 kont, eksport raportów |

Limity zdefiniowane w `src/lib/plans.ts`.

## Struktura

```
prisma/schema.prisma      schemat DB
prisma/seed.ts             dane demo
src/lib/                   auth, prisma client, AI parsing, plany, quota, stripe
src/app/                   strona główna, rejestracja, logowanie
src/app/app/                panel po zalogowaniu (zgłoszenie, dashboard, ustawienia)
src/app/api/stripe/         checkout, billing portal, webhook
```

## Co jest uproszczone (znane ograniczenia MVP)

- Brak wysyłki e-maili (zaproszenia pracowników = właściciel nadaje im hasło
  bezpośrednio w Ustawieniach, bez resetu hasła przez e-mail).
- `SESSION_SECRET` zarezerwowany na przyszłość — obecny model sesji nie
  wymaga podpisu (token = losowy sekret w DB), ale warto go ustawić już teraz.
- Brak testów automatycznych — zweryfikowano manualnie (`npm run build`,
  `npm run lint`, przejście ścieżki: rejestracja → zgłoszenie → dashboard →
  ustawienia) oraz w przeglądarce.
- Brak trybu ciemnego w interfejsie.
