# BRAK AI — Revenue Recovery OS dla branży budowlanej

Pokazuje firmie instalacyjnej / remontowej, gdzie traci pieniądze (zapytania bez
odpowiedzi, oferty bez follow-upu, przegrane oferty, faktury po terminie, zaległe
przeglądy), przelicza to na złotówki i prowadzi listę rzeczy do odzyskania.
Bez AI — reguły, które da się wytłumaczyć właścicielowi firmy.

## Uruchomienie

```bash
npm install
npm test          # testy silnika reguł i importu CSV
npm run dev       # http://localhost:3000 — podgląd na danych przykładowych
```

## Plan budowy

| Krok | Zakres | Stan |
|---|---|---|
| 1 | Szkielet projektu: Next.js 15 + TypeScript + Vitest | ✅ |
| 2 | Silnik reguł strat (`src/lib/straty`) — 4 moduły + rekompensata B2B | ✅ |
| 3 | Import faktur z CSV z mapowaniem kolumn (`src/lib/import`) | ✅ |
| 4 | Model danych Supabase + RLS (`supabase/migrations`) | ✅ |
| 5 | Podgląd dashboardu na danych przykładowych (`src/app/page.tsx`) | ✅ |
| 6 | Konto Supabase, logowanie, rejestracja firmy (`utworz_firme`) | ⏳ wymaga Twojego konta |
| 7 | Ekran importu CSV: wgranie pliku → wybór kolumn → zapis faktur | |
| 8 | Skrzynka zapytań: publiczny formularz dla strony firmy | |
| 9 | Oferty: lista, zmiana statusu, obowiązkowa przyczyna przegranej | |
| 10 | Codzienne przeliczenie strat (cron) i zapis do tabeli `straty` | |
| 11 | Lista do odzyskania + zadania z terminami + oznaczanie odzysku | |
| 12 | Dashboard na prawdziwych danych: utracone vs odzyskane zł | |
| 13 | Cotygodniowy alert e-mail | |
| 14 | Płatności Stripe (abonament) | |
| 15 | Wdrożenie na Vercel, umowa powierzenia RODO, polityka prywatności | |

## Reguły strat (domyślne progi w `src/lib/straty/typy.ts`)

| Strata | Kiedy | Wartość |
|---|---|---|
| Zapytanie bez odpowiedzi | brak kontaktu > 24 h | średnia oferta × wskaźnik wygranej |
| Oferta bez follow-upu | wysłana, brak kontaktu > 7 dni | wartość oferty × wskaźnik wygranej |
| Oferta przegrana | status „przegrana” (przyczyna obowiązkowa) | pełna wartość oferty |
| Faktura po terminie | nieopłacona po terminie płatności | kwota brutto |
| Zaległy przegląd | > 12 mies. od realizacji/przeglądu | cena przeglądu |

Wskaźnik wygranej liczony jest z historii firmy (od 10 rozstrzygniętych ofert),
wcześniej przyjmowane jest 25%. Kwoty przechowywane są w groszach.
