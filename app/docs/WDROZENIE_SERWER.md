# Eternal na serwerze — prototyp w 15 minut

Jedna paczka i jedno polecenie. Instalator zakłada Dockera, tworzy plik `.env` z sekretami, uruchamia aplikację za
Caddy z automatycznym certyfikatem HTTPS i ustawia codzienne kopie zapasowe.

| Tryb | Dla kogo | Co dostajesz |
|---|---|---|
| **pokaz** (domyślny) | inwestorzy, kliniki na prezentacji | dane fikcyjne, konta pokazowe z logowaniem jednym kliknięciem, baner „DANE FIKCYJNE”, reset jednym poleceniem |
| **pilotaz** | pierwsza placówka na prawdziwych kontach | pusta baza, nazwa placówki, konto administratora z losowym hasłem i obowiązkowym drugim składnikiem |

**Przed pierwszymi prawdziwymi danymi pacjentów** wykonaj punkt [7](#7-przed-prawdziwymi-danymi-pacjentów). Tryb
pokazowy służy wyłącznie do danych fikcyjnych.

## 1. Co jest potrzebne

- **Serwer w UE** (VPS): 2 vCPU, 4 GB RAM (przy 2 GB dodaj swap — budowa obrazu potrzebuje ok. 2 GB), 40 GB dysku,
  Ubuntu 24.04 LTS albo Debian 12, dostęp SSH jako root. Porty 80 i 443 otwarte.
- **Domena** z rekordem DNS typu A wskazującym adres serwera, np. `demo.twoja-firma.pl`.
  Bez domeny instalator użyje bezpłatnego adresu `<adres-ip-z-myślnikami>.sslip.io` (też z certyfikatem HTTPS) —
  wygodne na pokaz, na pilotaż lepiej własna domena.
- Paczka `eternal-serwer-<wersja>.tar.gz` (z czatu, z artefaktu „eternal-serwer” w GitHub Actions albo
  `npm run package:server` w katalogu `app/`), albo klon repozytorium.

## 2. Instalacja

```bash
# na swoim komputerze: wyślij paczkę na serwer
scp eternal-serwer-*.tar.gz root@ADRES_SERWERA:/opt/

# na serwerze
ssh root@ADRES_SERWERA
cd /opt && tar xzf eternal-serwer-*.tar.gz && cd eternal
./deploy/eternal.sh install
```

Z repozytorium zamiast paczki: `git clone <adres repozytorium> && cd Eternal-Lite-App/app && ./deploy/eternal.sh install`
(wtedy `update` pobiera nowe wersje przez `git pull`).

Instalator zapyta o **domenę** (albo `ip`) i **tryb** (`pokaz` / `pilotaz`). Bez pytań:

```bash
./deploy/eternal.sh install --domain demo.twoja-firma.pl --mode pokaz --yes
./deploy/eternal.sh install --domain pilot.twoja-placowka.pl --mode pilotaz \
  --clinic "Przychodnia Przykładowa" --admin-email admin@twoja-placowka.pl --admin-name "Imię Nazwisko" \
  --smtp-url 'smtps://login:haslo@smtp.dostawca.pl:465' --yes
```

Pierwsza budowa obrazu trwa kilka minut. Na końcu instalator pokazuje adresy:

- aplikacja pacjenta: `https://<domena>` (działa też jako aplikacja na ekranie telefonu — „Dodaj do ekranu głównego”),
- panel placówki: `https://<domena>/panel`,
- w trybie pokazowym — konta (hasło `Eternal-Demo-2026`, na ekranie logowania przyciski jednego kliknięcia,
  przy kodzie MFA przycisk „Wpisz kod”); w pilotażu — jednorazowo pokazane hasło administratora.

Certyfikat HTTPS Caddy pobiera przy pierwszym wejściu na adres. Jeśli przeglądarka pokazuje błąd certyfikatu,
sprawdź rekord DNS i porty 80/443 (punkt [8](#8-gdy-coś-nie-działa)).

## 3. Co działa od razu, bez żadnych kluczy

| Funkcja | Stan po instalacji |
|---|---|
| Aplikacja pacjenta, panel placówki, kalendarz, kartoteka, udostępnianie, dziennik dostępu | działa |
| Zaproszenia z rejestracji z kodem QR i linkiem, materiały od pacjenta, odczyt PDF z warstwą tekstu, raport faktów | działa |
| Raporty PDF (Chromium w obrazie), eksport CSV i FHIR | działa |
| Logowanie: hasło, drugi składnik TOTP, klucze dostępu (WebAuthn), kody odzyskiwania | działa |
| Powiadomienia push w przeglądarce (klucze VAPID tworzone automatycznie) | działa |
| Synchronizacja na żywo panel ↔ pacjent | działa |
| Rejestry publiczne bez klucza: NFZ (terminy), NLM, GIOŚ (powietrze), IMGW (pogoda), Open Food Facts | działa, jeśli serwer ma dostęp do internetu |
| Wideo | publiczny `meet.jit.si` — tylko do testów, bez danych pacjentów |
| Scribe, szkic notatki, karta „Po wizycie” | tryb pokazowy: przykładowa rozmowa i reguły zamiast modelu |
| E-mail i SMS | trafiają do kolejki wysyłek w panelu („Wysyłka powiadomień”), nikt ich nie dostaje |

Stan w każdej chwili: `./deploy/eternal.sh check` (to samo w panelu: *Organizacja kliniki → Gotowość do pracy*).

## 4. Podłączanie dostawców

Każdego dostawcę podłączasz tak samo: wpisz wartości w pliku `.env` na serwerze (`nano /opt/eternal/.env`), potem

```bash
./deploy/eternal.sh restart
./deploy/eternal.sh check --live     # test połączenia z każdym podłączonym dostawcą
```

Klucze zostają tylko na serwerze (plik `.env` z prawami 600) — nie wpisuj ich do repozytorium ani do czatu.

| Funkcja | Zmienne w `.env` | Skąd klucz | Koszt orientacyjny (plik 12.8) |
|---|---|---|---|
| **E-mail** (potwierdzenie adresu, reset hasła, przypomnienia) | `SMTP_URL`, `MAIL_FROM` | dowolny serwer SMTP w UE, np. Amazon SES (Frankfurt) albo skrzynka firmowa | od 0 zł przy małym ruchu |
| **SMS** (zaproszenia, przypomnienia) | `SMS_PROVIDER=smsapi`, `SMSAPI_TOKEN`, `SMS_SENDER` | konto SMSAPI.pl, token OAuth, zarejestrowana nazwa nadawcy | ok. 0,17 zł netto za SMS |
| **Model językowy** (szkic notatki Scribe, karta, odczyt) | `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` albo `AI_PROVIDER=bedrock` + `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=eu-central-1` | Anthropic Console albo AWS (Bedrock w regionie UE) | razem z mową ok. 0,3–0,5 zł za 15-minutową wizytę |
| **Mowa na tekst** (Scribe) | `STT_PROVIDER=elevenlabs` + `ELEVENLABS_API_KEY` (rezydencja UE) | konto ElevenLabs | jak wyżej |
| **Odczyt zdjęć i skanów** | `OCR_PROVIDER=mistral` + `MISTRAL_API_KEY` albo `textract` + klucze AWS albo `google` + `GOOGLE_DOCAI_*` | Mistral, AWS, Google Cloud | ok. 0,016 zł za stronę |
| **Wideo** | `VIDEO_PROVIDER=whereby` + `WHEREBY_API_KEY` albo własny Jitsi: `JITSI_DOMAIN`, `JITSI_APP_ID`, `JITSI_APP_SECRET` | Whereby Embedded (umowa powierzenia, UE) | Whereby od 10,99 USD/mies. |
| Urządzenia pacjenta | `WITHINGS_*`, `VALIDIC_*` | konta deweloperskie Withings / Validic | — |
| Rezerwacje z ZnanyLekarz | `DOCPLANNER_CLIENT_ID`, `DOCPLANNER_CLIENT_SECRET` | panel Docplanner (dla klientów Docplanner) | — |
| Logowanie firmowe | `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Keycloak, Entra, Cognito | — |
| Zgłaszanie błędów | `SENTRY_DSN` (projekt w regionie UE) | Sentry | — |

W trybie pokazowym możesz podłączyć prawdziwy model i mowę na tekst — dane nadal są fikcyjne, a Scribe zacznie
działać na prawdziwym nagraniu. Pełny opis zmiennych: [`.env.example`](../.env.example), dostawcy i regiony:
[`VENDORS.md`](VENDORS.md), szczegóły integracji: [`INTEGRATIONS.md`](INTEGRATIONS.md).

## 5. Aplikacja mobilna na ten serwer

W `mobile/eas.json` (profil `preview`) ustaw `EXPO_PUBLIC_API_URL` na `https://<domena>` i zbuduj plik APK na
bezpłatnym koncie Expo:

```bash
cd mobile && npx eas-cli@latest build --profile preview --platform android
```

Szybki podgląd bez budowania: `EXPO_PUBLIC_API_URL=https://<domena> npx expo start` i Expo Go na telefonie.
iPhone: TestFlight (konto Apple Developer). Szczegóły: [`POKAZ.md`](POKAZ.md#4-aplikacja-mobilna-na-telefonie).

## 6. Obsługa na co dzień

| Polecenie | Co robi |
|---|---|
| `./deploy/eternal.sh status` | stan kontenerów, adres, tryb |
| `./deploy/eternal.sh check [--live]` | co działa, co w trybie demo, czego brakuje |
| `./deploy/eternal.sh restart` | zastosowanie zmian w `.env` |
| `./deploy/eternal.sh logs` | logi na żywo (`logs caddy` — certyfikaty) |
| `./deploy/eternal.sh backup` | kopia do `backups/` (szyfrowana, gdy w `.env` jest `BACKUP_PASSPHRASE`); instalator ustawia ją codziennie o 3:17 |
| `./deploy/eternal.sh restore <plik>` | odtworzenie danych z kopii |
| `./deploy/eternal.sh reset-demo` | dane pokazowe od nowa (tylko tryb pokazowy; certyfikaty zostają) |
| `./deploy/eternal.sh create-admin <email> "Imię"` | kolejne konto administratora z losowym hasłem |
| `./deploy/eternal.sh update` | kopia, nowa wersja kodu (`git pull` albo rozpakowana nowa paczka), przebudowa |

Kopie zawierają dane osobowe: ustaw `BACKUP_PASSPHRASE`, przenoś je poza serwer (np. `scp` albo magazyn w UE)
i raz w kwartale sprawdź odtworzenie (`restore`). Rotacja: `BACKUP_RETENTION_DAYS` (domyślnie 35 dni).

## 7. Przed prawdziwymi danymi pacjentów

Prototyp działa technicznie jak wersja produkcyjna, ale prawdziwe dane wymagają jeszcze kroków poza kodem
(szczegóły: [`BRAKI_I_WDROZENIE.md`](BRAKI_I_WDROZENIE.md), [`COMPLIANCE.md`](COMPLIANCE.md)):

1. tryb `pilotaz` (nigdy dane pacjentów w trybie pokazowym),
2. ocena skutków dla ochrony danych (DPIA) i rejestr czynności przetwarzania,
3. umowy powierzenia: dostawca serwera i każdy podłączony dostawca API (e-mail, SMS, model, mowa, OCR, wideo),
4. własny serwer wideo albo Whereby z umową — nie publiczny `meet.jit.si`,
5. SMTP podłączony (potwierdzanie adresów, reset hasła),
6. kopie szyfrowane poza serwerem i próba odtworzenia,
7. zatwierdzenie treści przez lekarza: objaśnienia badań (`approve-explanations`), programy profilaktyczne
   (`approve-preventive`), wzory zgód w profilu estetycznym,
8. przegląd bezpieczeństwa (OWASP ASVS poziom 1), a przed sprzedażą test penetracyjny,
9. kwalifikacja MDR i AI Act udokumentowana — aplikacja nie ocenia wyników ani nie stawia diagnoz.

## 8. Gdy coś nie działa

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| Błąd certyfikatu w przeglądarce | rekord A domeny nie wskazuje serwera albo porty 80/443 zamknięte (zapora dostawcy VPS); `./deploy/eternal.sh logs caddy` |
| Budowa obrazu przerywa się (`killed`, brak pamięci) | dodaj swap: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile` i powtórz `install` |
| „Aplikacja nie odpowiada” | `./deploy/eternal.sh logs eternal` — najczęściej błędna wartość w `.env` |
| Nowy pacjent nie może się zalogować po rejestracji | pilotaż bez SMTP — podłącz e-mail (punkt 4) |
| Zmiana w `.env` nie działa | po każdej zmianie `./deploy/eternal.sh restart` |
| Raport PDF zwraca `pdf_unavailable` | w `.env` nie ustawiaj pustego `CHROMIUM_PATH=` (obraz ma własną ścieżkę) |

## 9. Jak to jest sprawdzane

Workflow `ci` w GitHub Actions przy każdej zmianie w `app/` buduje obraz z `app/Dockerfile` (Debian + Chromium),
instaluje go z paczki serwerowej tym samym instalatorem (tryb pokazowy, HTTPS na `localhost`), sprawdza zdrowie,
gotowość, wygenerowanie PDF w kontenerze i kopię zapasową, a potem uruchamia testy e2e na działającym kontenerze.
Paczka z każdego przebiegu jest do pobrania jako artefakt „eternal-serwer”.

Testy e2e można też puścić na własnej instancji pokazowej (dane z testów zostaną — potem `reset-demo`):

```bash
cd app && E2E_BASE_URL=https://demo.twoja-firma.pl npx playwright test
```
