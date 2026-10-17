# Rejestr dostawców (R8, K16)

Każdy dostawca, do którego mogą trafić dane, z rolą, zakresem danych, regionem, sposobem usuwania i planem wyjścia.
Wpis do rejestru jest warunkiem włączenia dostawcy w produkcji (A3: „usuwanie u wszystkich dostawców — warunek
wpisu”). Kolumny „Umowa powierzenia” i „Region” uzupełnia operator po podpisaniu umowy — **stan umów nie wynika
z kodu**; poniżej podano wymagania, które kod zakłada.

| Dostawca | Rola w Eternal | Zmienna | Dane, które otrzymuje | Wymagany region | Umowa powierzenia (art. 28 RODO) | Usuwanie danych | Plan wyjścia |
|---|---|---|---|---|---|---|---|
| Medplum (opcjonalnie) | repozytorium FHIR | `FHIR_BACKEND=medplum` | pełne dane kliniczne | UE (instancja własna w AWS Frankfurt — A7 poz. 3–4) | wymagana | `expunge` przy usunięciu danych pacjenta (`deleteMyData`) | eksport FHIR Bundle; `FHIR_BACKEND=local` albo inny serwer FHIR R4 |
| Amazon Bedrock (Claude) | model językowy: szkic notatki, karta „Po wizycie”, odczyt dokumentu | `AI_PROVIDER=bedrock` | tekst transkrypcji / dokumentu po usunięciu PESEL, e-maili i telefonów | UE (`AWS_REGION=eu-central-1`, profil UE) | wymagana (umowa AWS) | bez przechowywania treści po stronie modelu — potwierdzić w umowie | `AI_PROVIDER=anthropic` albo zapas Mistral (`AI_SECONDARY_PROVIDER`) |
| Anthropic API (alternatywa) | jw. | `AI_PROVIDER=anthropic` | jw. | potwierdzić rezydencję danych przed użyciem z danymi pacjentów | wymagana | jw. | Bedrock |
| Mistral AI | zapasowy model językowy, OCR | `MISTRAL_API_KEY`, `OCR_PROVIDER=mistral` | jw. / obraz dokumentu | UE | wymagana | potwierdzić w umowie | Google Document AI / sam pdf.js |
| Google Cloud Document AI | OCR (D51) | `OCR_PROVIDER=google` | obraz lub PDF dokumentu | UE (`GOOGLE_DOCAI_LOCATION=eu`) | wymagana | potwierdzić w umowie | Mistral OCR |
| ElevenLabs | mowa na tekst (D48) | `STT_PROVIDER=elevenlabs` | nagranie wizyty | UE (`ELEVENLABS_BASE_URL` z rezydencją UE) | wymagana | potwierdzić brak retencji | Azure / OpenAI (zmienna) |
| Microsoft Azure AI Speech | mowa na tekst (D48) | `STT_PROVIDER=azure` | nagranie wizyty | UE (`AZURE_SPEECH_REGION=westeurope`) | wymagana | jw. | jw. |
| OpenAI (rezydencja UE) | mowa na tekst (D48) | `STT_PROVIDER=openai` | nagranie wizyty | UE (`OPENAI_BASE_URL=https://eu.api.openai.com/v1`) — tylko jeśli rezydencja obejmuje transkrypcję | wymagana | jw. | jw. |
| Whereby | wideo (D52) | `VIDEO_PROVIDER=whereby` | strumień audio-wideo wizyty (bez nagrywania) | UE (`WHEREBY_REGION=eu-central-1`) | wymagana | pokoje z czasem wygaśnięcia | Jitsi u nas |
| SMSAPI.pl | SMS | `SMS_PROVIDER=smsapi` | numer telefonu, treść bez danych o zdrowiu | PL | wymagana | wg polityki operatora SMS | własna bramka (`SMS_PROVIDER=webhook`) |
| Dostawca SMTP (np. Amazon SES) | e-mail | `SMTP_URL` | adres e-mail, treść bez danych o zdrowiu | UE | wymagana | jw. | inny SMTP |
| Expo (push) / Apple / Google | powiadomienia push w aplikacji mobilnej | — | token urządzenia, tytuł i treść bez danych o zdrowiu | — (usługi globalne) | warunki Expo; treść neutralna | token usuwany przy usunięciu konta | e-mail / SMS (fallback serwera) |
| Sentry (opcjonalnie) | błędy serwera | `SENTRY_DSN` | typ błędu, kod, wzorzec trasy — bez treści, identyfikatorów i danych żądań | UE (`*.de.sentry.io`; inne odrzucane, chyba że `SENTRY_ALLOW_NON_EU=true`) | zalecana | wg planu Sentry | wyłączenie zmiennej |
| Have I Been Pwned | sprawdzanie haseł | `HIBP_ENABLED` | 5 znaków skrótu SHA-1 hasła | — | nie dotyczy (brak danych osobowych) | — | wyłączenie zmiennej |
| Withings, platformy RPM | pomiary z urządzeń | `WITHINGS_*`, `RPM_WEBHOOK_SECRETS` | token OAuth pacjenta / dane przychodzące | potwierdzić | wymagana (Withings jako odrębny administrator — weryfikacja) | odłączenie konta | wpisy ręczne |

Przegląd rejestru: przy każdym nowym dostawcy, zmianie regionu lub umowy i co najmniej raz w roku.
Usuwanie danych pacjenta (`server/services/deletion.ts`) obejmuje repozytorium FHIR, pliki, udostępnienia, linki
i konto; dostawcy przetwarzający dane wyłącznie w locie (modele, OCR, mowa, SMS) nie przechowują danych zgodnie
z umową — to warunek wpisu.
