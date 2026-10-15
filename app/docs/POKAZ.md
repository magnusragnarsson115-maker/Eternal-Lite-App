# Jak zobaczyć Eternal i pokazać go inwestorom

Wszystkie dane w trybie pokazowym są **fikcyjne** (baner „DANE FIKCYJNE”). Funkcje AI, SMS i wideo działają
w trybie demonstracyjnym — patrz [`BRAKI_I_WDROZENIE.md`](BRAKI_I_WDROZENIE.md).

## 1. Najszybciej — wideo i zrzuty (bez instalowania)

- **Wideo 90 s** z pełnym obiegiem: [`demo/eternal-pilotaz-pokaz.mp4`](demo/eternal-pilotaz-pokaz.mp4)
  (rejestracja → pacjentka pod linkiem → raport faktów → Scribe → karta „Po wizycie” → „kto oglądał”).
- **Zrzuty ekranu**: [`screenshots/`](screenshots/) — spis w [`MODULES.md`](MODULES.md#zrzuty-ekranu-dane-fikcyjne).

## 2. Na własnym komputerze (ok. 10 minut)

Wymagania: Node.js 22.13 lub nowszy.

```bash
git clone <adres repozytorium> && cd Eternal-Lite-App/app
npm install
npm run seed:demo        # dane fikcyjne
npm run build && npm start
```

Otwórz **http://localhost:3000** (pacjent) i **http://localhost:3000/panel** (klinika). Na ekranie logowania w trybie
demo są przyciski **„Lekarz (interna)”, „Rejestracja”, „Administrator”, „Pacjentka Anna Kowalska”** — jedno kliknięcie;
na ekranie drugiego składnika przycisk **„Wpisz kod”** (bez aplikacji uwierzytelniającej).

Polecenie `npm run cli -- check` pokazuje, co działa naprawdę, a co w trybie demo.

## 3. Instancja pokazowa w internecie (link dla inwestorów)

Najprościej: mały serwer w UE (np. 2 vCPU, 4 GB RAM) z Dockerem i domena (rekord A na adres serwera).

```bash
git clone <adres repozytorium> && cd Eternal-Lite-App/app
cp .env.example .env
ETERNAL_DOMAIN=demo.twoja-domena.pl docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
```

- Certyfikat HTTPS wystawi Caddy automatycznie; dane fikcyjne utworzą się przy pierwszym starcie (`DEMO_SEED_ON_START`).
- Reset danych po pokazie: `docker compose -f docker-compose.yml -f docker-compose.demo.yml down -v` i ponownie `up -d`.
- Link przekazuj tylko zaproszonym osobom i wyłącz instancję po pokazach. Nigdy nie wpisuj tam prawdziwych danych.
- Obraz Docker nie był budowany w środowisku, w którym powstał kod (blokada sieci) — po pierwszym `up` sprawdź
  `docker compose logs eternal` i panel *Organizacja kliniki → Gotowość do pracy* (pozycja „Raporty PDF”).

## 4. Aplikacja mobilna na telefonie

| Sposób | Dla kogo | Co działa |
|---|---|---|
| **Android — plik APK z EAS** (`npx eas-cli@latest build --profile preview --platform android`, bezpłatne konto Expo) | pokaz na telefonach z Androidem; link do pobrania albo kod QR | wszystko, w tym biometria i PIN |
| **iPhone — TestFlight** | wymaga konta Apple Developer (99 USD/rok) | wszystko |
| **Expo Go** (`cd mobile && npx expo start`, zeskanuj kod QR) | szybki podgląd w sieci lokalnej | ekrany i dane; push i część zabezpieczeń wymagają buildu |

Adres serwera ustawiasz w `mobile/eas.json` (`EXPO_PUBLIC_API_URL`) albo przy starcie: `EXPO_PUBLIC_API_URL=https://demo.twoja-domena.pl npx expo start`.

## 5. Scenariusz pokazu (10 minut)

| Min | Kto | Co pokazać | Co powiedzieć |
|---|---|---|---|
| 0–1 | — | wideo 90 s albo pulpit | Problem: lekarz dostaje materiały w ostatniej chwili, dokumentacja zabiera czas wizyty |
| 1–3 | Rejestracja | *Skrzynka materiałów* → „Zaproś” → kod QR | Komplet materiałów przed wizytą, bez instalowania aplikacji przez pacjenta |
| 3–5 | Pacjentka (telefon) | link → zgoda → PDF wyniku → „Potwierdź wszystkie pewne” → „Gotowe” | Polski parser wyników, każda wartość z wierszem źródłowym; zgoda na czas |
| 5–6 | Lekarz | *Raport faktów* | Wszystko na jednej stronie, ze źródłem; aplikacja niczego nie ocenia (granica wyrobu medycznego) |
| 6–8 | Lekarz | *Scribe i karta* → nagranie → szkic → zatwierdzenie → karta | Przewaga: Scribe w jednym obiegu z materiałami, raportem i kartą dla pacjenta |
| 8–9 | Pacjentka | karta „Po wizycie”, „Kto oglądał moje dane”, numery pomocowe | Zaufanie: pacjent widzi każdy odczyt i wycofuje dostęp jednym ruchem |
| 9–10 | Administrator | *Mierniki pilotażu*, *Gotowość do pracy* | Mierzalny czas dokumentacji przed i po; co dzieli nas od produkcji |

**Uczciwie wobec inwestorów:** dane są fikcyjne; szkic Scribe i transkrypcja w pokazie działają na regułach
i przykładowej rozmowie — prawdziwy model i transkrypcja po podłączeniu dostawców i testach D48/D51.
Aplikacja nie diagnozuje i nie ocenia wyników — nie obiecuj tego na pokazie.

## 6. Liczby z pliku 12.8 do rozmowy

- Koszt Scribe: ok. 0,3–0,5 zł za 15-minutową wizytę (mowa + model, A3/A8).
- Odczyt dokumentu: ok. 0,016 zł za stronę; SMS: ok. 0,17 zł netto.
- Konkurencja w notatkach AI (A5): Noa Notes (ZnanyLekarz), Medfile, Cora AI, PulsNote, Nabla, Tandem, Heidi —
  przewaga Eternal to obieg materiały → raport → Scribe → karta pacjenta, nie sam notatnik.
- Mierniki pilotażu: czas dokumentacji w tygodniu bez i z Eternal, kompletność materiałów, odsetek poprawionych zdań.
