# Eternal — aplikacja mobilna pacjenta (Expo)

Aplikacja iOS i Android (MVP, moduły P1–P14) na **Expo SDK 57** (React Native, Expo Router). Korzysta z tego samego
API co aplikacja w przeglądarce (`app/server`), z sesją w nagłówku `Authorization: Bearer` zamiast ciasteczka.

| Funkcja (plik 12.8) | Ekran / moduł |
|---|---|
| F1.1, F1.7 logowanie e-mailem i hasłem, kod TOTP | `src/app/login.tsx` |
| F1.2 odblokowanie biometrią, F1.5 PIN zapasowy (6 cyfr, limit 5 prób) | `src/app/lock.tsx`, `src/app/pin-setup.tsx`, `src/lib/secure.ts` |
| F1.18 schowek systemu (Keychain / Keystore, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) | `src/lib/secure.ts` (`expo-secure-store`) |
| F1.13 lista urządzeń, wylogowanie zdalne (najwyżej 5) | `src/app/devices.tsx` |
| P3 dokumenty: zdjęcie aparatem, galeria, PDF → odczyt → potwierdzenie pól | `src/app/(tabs)/documents.tsx`, `src/app/intake/[id].tsx` |
| D5 karty „Po wizycie” | `src/app/(tabs)/cards.tsx`, `src/app/card/[id].tsx` |
| P2 udostępnienia z wycofaniem, „kto oglądał” | `src/app/(tabs)/sharing.tsx` |
| P8 powiadomienia push (Expo Notifications → `/api/push/expo`) | `src/lib/push.ts` |
| P14 SOS, numery pomocowe (zawsze dostępne, także bez logowania i internetu) | `src/app/sos.tsx`, `src/app/crisis.tsx` |
| A18.3 „Do czego służy aplikacja”, A18.12 usunięcie danych z potwierdzeniem | `src/app/about.tsx`, `src/app/delete-data.tsx` |
| A18.7 kontrolowana dystrybucja: najniższa obsługiwana wersja z serwera, kanały EAS Update | `src/lib/session.tsx`, `eas.json` |

Na telefonie nie są zapisywane dane medyczne — tylko token sesji, skrót PIN-u i ustawienia blokady (w schowku systemu).
Po 60 s w tle aplikacja wymaga biometrii albo PIN-u. Treść powiadomień push nie zawiera danych o zdrowiu.

## Uruchomienie

```bash
cd app/mobile
npm install
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000 npx expo start   # adres serwera widoczny z telefonu
```

Biometria, schowek systemu z biometrią i powiadomienia push wymagają **development build** (nie Expo Go):
`npx expo run:android` / `npx expo run:ios` albo `npx eas-cli@latest build --profile development`.

## Wydanie

1. Uzupełnij `extra.eas.projectId` w `app.json` (`npx eas-cli@latest init`) i adresy API w `eas.json`.
2. `npm run build:preview` — wersja testowa (dystrybucja wewnętrzna).
3. Produkcja: `npx eas-cli@latest build --profile production` + `eas submit`.
4. Aktualizacje JS bez sklepu: `npm run update:staged` (kanał `production`, wdrożenie 10% — potem zwiększ).
5. Wymuszenie aktualizacji ze sklepu: `MOBILE_MIN_VERSION` na serwerze (ekran „Wymagana aktualizacja”).

## Sprawdzenie

```bash
npm run typecheck                         # TypeScript
npx expo export --platform android        # pełny pakiet JS (Metro) — wykrywa błędy importów
```

Teksty interfejsu przez `t()`; tłumaczenie EN w `src/i18n-en.ts` — kompletność sprawdza test `tests/unit/i18n.test.ts` w `app/`.
