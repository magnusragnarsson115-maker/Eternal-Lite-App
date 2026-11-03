import { config } from '../config.js';
import { fhir } from '../fhir/index.js';
import { emailConfigured, smsConfigured, verifyEmailTransport } from './channels.js';
import { nfzHealth } from './nfz.js';
import { medicinalProductCount } from './rpl.js';
import { pharmacyCount, refundCount } from './registries.js';
import { importedIcd10Count } from '../services/diagnoses.js';
import { rpmProviders } from './rpm.js';
import { icd11Configured, searchLoinc } from './terminology.js';
import { withingsConfigured } from './withings.js';
import { validicConfigured } from './validic.js';
import { docplannerConfigured } from './docplanner.js';
import { infermedicaConfigured, regulatoryAck } from './infermedica.js';
import { ocrConfigured } from '../ai/ocr.js';

export type IntegrationStatus = 'active' | 'not-configured' | 'disabled' | 'requires-agreement' | 'requires-certification';
export type IntegrationCost = 'free' | 'free-registration' | 'paid' | 'partner';

export interface IntegrationInfo {
  id: string;
  name: string;
  category: 'fhir' | 'public-data' | 'terminology' | 'devices' | 'communication' | 'telemedicine' | 'security' | 'national';
  cost: IntegrationCost;
  status: IntegrationStatus;
  purpose: string;
  config: string;
  docs: string;
  health?: { ok: boolean; detail: string; checkedAt: string };
}

function base(): IntegrationInfo[] {
  return [
    {
      id: 'fhir-store',
      name: config.fhir.backend === 'medplum' ? 'Medplum (FHIR R4)' : config.fhir.backend === 'fhir' ? 'Serwer FHIR R4' : 'Lokalny magazyn FHIR R4',
      category: 'fhir',
      cost: config.fhir.backend === 'medplum' ? 'free-registration' : 'free',
      status: 'active',
      purpose: 'Repozytorium danych klinicznych (Patient, Appointment, Slot, DiagnosticReport, Observation, Consent…). Walidacja względem specyfikacji HL7 FHIR R4.',
      config: 'FHIR_BACKEND=local|medplum|fhir; MEDPLUM_CLIENT_ID/SECRET; FHIR_BASE_URL',
      docs: 'https://www.medplum.com/docs/auth/client-credentials',
    },
    {
      id: 'nfz-itl',
      name: 'NFZ — Terminy Leczenia',
      category: 'public-data',
      cost: 'free',
      status: config.publicApis.nfz ? 'active' : 'disabled',
      purpose: 'Wyszukiwarka pierwszych wolnych terminów i kolejek u świadczeniodawców z umową NFZ.',
      config: 'NFZ_API_ENABLED',
      docs: 'https://api.nfz.gov.pl/app-itl-api/',
    },
    {
      id: 'rpl',
      name: 'Rejestr Produktów Leczniczych (CeZ)',
      category: 'public-data',
      cost: 'free',
      status: 'active',
      purpose: 'Słownik leków dopuszczonych do obrotu w Polsce (lista leków pacjenta). Import oficjalnego eksportu XML.',
      config: 'npm run cli -- import-rpl [plik|URL]',
      docs: 'https://rejestrymedyczne.ezdrowie.gov.pl/rpl/search/public',
    },
    {
      id: 'rejestr-aptek',
      name: 'Rejestr Aptek (CeZ)',
      category: 'public-data',
      cost: 'free',
      status: pharmacyCount().total ? 'active' : 'not-configured',
      purpose: 'Wyszukiwarka aptek i punktów aptecznych z trasą w mapie (F7.1, F7.2, F7.4). Import eksportu CSV; zapytania pacjentów nie wychodzą poza serwer.',
      config: 'npm run cli -- import-pharmacies <plik.csv>',
      docs: 'https://rejestrymedyczne.ezdrowie.gov.pl/ra/search/public',
    },
    {
      id: 'obwieszczenie-refundacyjne',
      name: 'Wykaz leków refundowanych (obwieszczenie Ministra Zdrowia)',
      category: 'public-data',
      cost: 'free',
      status: refundCount() ? 'active' : 'not-configured',
      purpose: 'Informacja o refundacji: grupa limitowa, poziom odpłatności, dopłata, zakres wskazań (F7.7). Arkusz z obwieszczenia zapisany jako CSV.',
      config: 'npm run cli -- import-refund <plik.csv> --list A1 --title "…" --valid-from RRRR-MM-DD',
      docs: 'https://www.gov.pl/web/zdrowie/obwieszczenia-ministra-zdrowia-lista-lekow-refundowanych',
    },
    {
      id: 'icd10-pl',
      name: 'Klasyfikacja ICD-10 (wydanie polskie)',
      category: 'terminology',
      cost: 'free',
      status: importedIcd10Count() ? 'active' : 'not-configured',
      purpose: 'Słownik rozpoznań do wyboru przez lekarza (A12.6). Bez importu — lista najczęstszych kodów wbudowana w aplikację.',
      config: 'npm run cli -- import-icd10 <plik.csv>',
      docs: 'https://www.cez.gov.pl/',
    },
    {
      id: 'open-food-facts',
      name: 'Open Food Facts',
      category: 'public-data',
      cost: 'free',
      status: config.publicApis.openFoodFacts ? 'active' : 'disabled',
      purpose: 'Skład i wartości odżywcze produktów po kodzie kreskowym lub nazwie (F11.3). Wysyłany jest tylko kod albo nazwa produktu.',
      config: 'OFF_API_ENABLED',
      docs: 'https://openfoodfacts.github.io/openfoodfacts-server/api/',
    },
    {
      id: 'gios-air',
      name: 'GIOŚ — jakość powietrza',
      category: 'public-data',
      cost: 'free',
      status: config.publicApis.gios ? 'active' : 'disabled',
      purpose: 'Indeks jakości powietrza z najbliższej stacji (F5.1, A3.6). Wysyłany jest tylko numer stacji, bez położenia pacjenta.',
      config: 'GIOS_API_ENABLED',
      docs: 'https://powietrze.gios.gov.pl/pjp/content/api',
    },
    {
      id: 'imgw-weather',
      name: 'IMGW-PIB — dane synoptyczne',
      category: 'public-data',
      cost: 'free',
      status: config.publicApis.imgw ? 'active' : 'disabled',
      purpose: 'Temperatura, wilgotność, ciśnienie i wiatr ze stacji synoptycznej (F5.2). Tylko informacja, bez porad.',
      config: 'IMGW_API_ENABLED',
      docs: 'https://danepubliczne.imgw.pl/',
    },
    {
      id: 'nlm-clinical-tables',
      name: 'NLM Clinical Tables (LOINC, ICD-10-CM)',
      category: 'terminology',
      cost: 'free',
      status: config.publicApis.nlm ? 'active' : 'disabled',
      purpose: 'Kodowanie badań (LOINC) i rozpoznań; lokalny słownik PL działa bez sieci.',
      config: 'NLM_API_ENABLED',
      docs: 'https://clinicaltables.nlm.nih.gov/',
    },
    {
      id: 'who-icd11',
      name: 'WHO ICD-11 API',
      category: 'terminology',
      cost: 'free-registration',
      status: icd11Configured() ? 'active' : 'not-configured',
      purpose: 'Wyszukiwanie kodów ICD-11 (MMS).',
      config: 'ICD11_CLIENT_ID, ICD11_CLIENT_SECRET, ICD11_RELEASE',
      docs: 'https://icd.who.int/icdapi',
    },
    {
      id: 'hibp',
      name: 'Have I Been Pwned — Pwned Passwords',
      category: 'security',
      cost: 'free',
      status: config.publicApis.hibp ? 'active' : 'disabled',
      purpose: 'Odrzucanie haseł z wycieków (k-anonimowość: wysyłane 5 znaków skrótu SHA-1).',
      config: 'HIBP_ENABLED',
      docs: 'https://haveibeenpwned.com/API/v3#PwnedPasswords',
    },
    {
      id: 'web-bluetooth',
      name: 'Urządzenia Bluetooth LE (GATT)',
      category: 'devices',
      cost: 'free',
      status: 'active',
      purpose: 'Odczyt z ciśnieniomierzy, wag, termometrów, pulsoksymetrów i pulsometrów zgodnych ze standardowymi profilami Bluetooth SIG (Chrome/Edge, Android, Windows, macOS).',
      config: '—',
      docs: 'https://www.bluetooth.com/specifications/specs/',
    },
    {
      id: 'withings',
      name: 'Withings Health API',
      category: 'devices',
      cost: 'free-registration',
      status: withingsConfigured() ? 'active' : 'not-configured',
      purpose: 'Import pomiarów z urządzeń Withings (OAuth 2.0 pacjenta).',
      config: 'WITHINGS_CLIENT_ID, WITHINGS_CLIENT_SECRET',
      docs: 'https://developer.withings.com/',
    },
    {
      id: 'rpm-vitalera',
      name: 'Vitalera i inne platformy RPM (webhook FHIR)',
      category: 'devices',
      cost: 'partner',
      status: rpmProviders().length ? 'active' : 'requires-agreement',
      purpose: 'Odbiór pomiarów zdalnego monitorowania jako FHIR Observation, podpis HMAC. Vitalera udostępnia API po umowie partnerskiej.',
      config: `RPM_WEBHOOK_SECRETS="vitalera:…" (aktywni dostawcy: ${rpmProviders().join(', ') || 'brak'})`,
      docs: 'https://vitalera.io',
    },
    {
      id: 'validic-inform',
      name: 'Validic Inform (REST API v2)',
      category: 'devices',
      cost: 'partner',
      status: validicConfigured() ? 'active' : 'requires-agreement',
      purpose: 'Jeden dostęp do setek urządzeń i aplikacji zdrowotnych: pacjent łączy konta na stronie Validic Marketplace, aplikacja pobiera pomiary, sen i kroki przez API (bez widżetów). Identyfikator u Validic bez danych osobowych.',
      config: 'VALIDIC_ORG_ID, VALIDIC_TOKEN (wersja próbna dla deweloperów, potem umowa)',
      docs: 'https://helpdocs.validic.com/docs/inform-rest-api',
    },
    {
      id: 'docplanner',
      name: 'Docplanner / ZnanyLekarz — Integrations API v3',
      category: 'telemedicine',
      cost: 'partner',
      status: docplannerConfigured() ? 'active' : 'requires-agreement',
      purpose: 'Dwukierunkowa synchronizacja: wolne terminy z kalendarza Eternal do ZnanyLekarz, rezerwacje i odwołania z ZnanyLekarz jako wizyty. Zamiast widżetu rezerwacji na stronie.',
      config: 'DOCPLANNER_CLIENT_ID, DOCPLANNER_CLIENT_SECRET (DOCPLANNER_DOMAIN, domyślnie znanylekarz.pl); mapowanie w panelu administratora',
      docs: 'https://integrations.docplanner.com/docs/',
    },
    {
      id: 'infermedica',
      name: 'Infermedica Engine API v3 (wywiad objawowy, triaż)',
      category: 'telemedicine',
      cost: 'paid',
      status: !infermedicaConfigured() ? 'not-configured' : regulatoryAck() ? 'active' : 'requires-certification',
      purpose: 'Dynamicznie dobierane pytania i triaż. Wyrób medyczny klasy IIb (MDR) dostawcy — jego certyfikat nie obejmuje produktu integrującego, dlatego silnik działa dopiero po wpisaniu oceny zgodności MDR produktu.',
      config: 'INFERMEDICA_APP_ID, INFERMEDICA_APP_KEY (próba: 2000 wywołań), INFERMEDICA_MODEL (opcjonalnie); referencja oceny zgodności w panelu',
      docs: 'https://developer.infermedica.com/docs/v3/quickstart',
    },
    {
      id: 'elevenlabs-scribe',
      name: 'ElevenLabs Scribe v2 Medical (mowa na tekst)',
      category: 'telemedicine',
      cost: 'paid',
      status: config.stt.provider === 'elevenlabs' && config.stt.elevenlabs.apiKey ? 'active' : 'not-configured',
      purpose: 'Transkrypcja wizyty z rozpoznawaniem mówców i znacznikami czasu, model medyczny; słownik terminów (leki, badania) opcjonalnie; rezydencja danych w UE, tryb zerowej retencji w planach firmowych.',
      config: 'STT_PROVIDER=elevenlabs, ELEVENLABS_API_KEY, ELEVENLABS_STT_MODEL=scribe_v2_medical, ELEVENLABS_KEYTERMS=on|off, ELEVENLABS_ZERO_RETENTION=on|off',
      docs: 'https://elevenlabs.io/docs/capabilities/speech-to-text',
    },
    {
      id: 'aws-textract',
      name: 'Amazon Textract (odczyt zdjęć i skanów)',
      category: 'public-data',
      cost: 'paid',
      status: config.ocr.provider === 'textract' && ocrConfigured() ? 'active' : 'not-configured',
      purpose: 'OCR zdjęć wyników i jednostronicowych skanów (DetectDocumentText) w regionie Frankfurt; linie z położeniem do podświetlenia w oryginale. Darmowy pakiet AWS: 1000 stron miesięcznie przez 3 miesiące.',
      config: 'OCR_PROVIDER=textract, AWS_REGION=eu-central-1, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY',
      docs: 'https://aws.amazon.com/textract/pricing/',
    },
    {
      id: 'imaging-viewer',
      name: 'Przeglądarka 3D badań obrazowych (licencja placówki)',
      category: 'telemedicine',
      cost: 'partner',
      status: config.imagingViewer.url ? 'active' : 'not-configured',
      purpose: 'Uruchomienie z karty pacjenta licencjonowanej przeglądarki anatomii 3D z CT/MR (wyrób medyczny, np. z integracją z systemem szpitalnym). Link z identyfikatorem rekordu, bez PESEL.',
      config: 'IMAGING_VIEWER_URL (z {patientId} albo {eternalId}), IMAGING_VIEWER_NAME',
      docs: 'https://www.avatarmedical.ai',
    },
    {
      id: 'jitsi',
      name: 'Jitsi Meet (teleporady)',
      category: 'telemedicine',
      cost: 'free',
      status: 'active',
      purpose: 'Wideo-teleporady w przeglądarce. Produkcyjnie: własna instancja w EOG z JWT.',
      config: `JITSI_DOMAIN=${config.jitsi.domain}${config.jitsi.appId ? ' (JWT włączony)' : ' (bez JWT)'}`,
      docs: 'https://jitsi.github.io/handbook/',
    },
    {
      id: 'web-push',
      name: 'Web Push (VAPID)',
      category: 'communication',
      cost: 'free',
      status: 'active',
      purpose: 'Powiadomienia push w przeglądarce i na telefonie (PWA). Klucze VAPID generowane automatycznie.',
      config: 'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (opcjonalnie)',
      docs: 'https://www.rfc-editor.org/rfc/rfc8292',
    },
    {
      id: 'smtp',
      name: 'E-mail (SMTP)',
      category: 'communication',
      cost: 'free',
      status: emailConfigured() ? 'active' : 'not-configured',
      purpose: 'Przypomnienia, weryfikacja adresu, reset hasła.',
      config: 'SMTP_URL, MAIL_FROM',
      docs: 'https://nodemailer.com/smtp/',
    },
    {
      id: 'sms',
      name: 'SMS (SMSAPI.pl lub własna bramka)',
      category: 'communication',
      cost: 'paid',
      status: smsConfigured() ? 'active' : 'not-configured',
      purpose: 'Przypomnienia SMS za zgodą pacjenta.',
      config: 'SMS_PROVIDER=smsapi|webhook, SMSAPI_TOKEN, SMS_WEBHOOK_URL',
      docs: 'https://www.smsapi.pl/docs',
    },
    {
      id: 'p1-cer',
      name: 'Platforma P1: Centralna e-Rejestracja, EDM, e-skierowanie',
      category: 'national',
      cost: 'partner',
      status: 'requires-certification',
      purpose:
        'Obowiązkowe dla placówek z umową NFZ w zakresie objętym CeR (od 1.07.2026: kardiologia, mammografia, cytologia). Wymaga certyfikatu placówki z CeZ i testów integracyjnych — poza zakresem tej wersji.',
      config: '—',
      docs: 'https://cez.gov.pl/',
    },
    {
      id: 'login-gov',
      name: 'Węzeł Krajowy (login.gov.pl)',
      category: 'national',
      cost: 'partner',
      status: 'requires-agreement',
      purpose: 'Potwierdzanie tożsamości pacjenta (Profil Zaufany, e-dowód, bankowość). Wymaga porozumienia z KPRM/MC.',
      config: '—',
      docs: 'https://www.gov.pl/web/login',
    },
  ];
}

const healthChecks: Record<string, () => Promise<{ ok: boolean; detail: string }>> = {
  'fhir-store': () => fhir().health(),
  'nfz-itl': () => nfzHealth(),
  'nlm-clinical-tables': async () => {
    const r = await searchLoinc('glucose');
    return r.remoteError ? { ok: false, detail: r.remoteError } : { ok: true, detail: `${r.hits.length} wyników` };
  },
  rpl: async () => {
    const n = medicinalProductCount();
    return n > 0 ? { ok: true, detail: `${n} produktów w lokalnym indeksie` } : { ok: false, detail: 'Brak importu — uruchom npm run cli -- import-rpl' };
  },
  smtp: () => verifyEmailTransport(),
};

export async function listIntegrations(withHealth: boolean): Promise<IntegrationInfo[]> {
  const items = base();
  if (!withHealth) return items;
  await Promise.all(
    items.map(async (i) => {
      const check = healthChecks[i.id];
      if (!check || i.status === 'disabled' || i.status === 'not-configured') return;
      try {
        i.health = { ...(await check()), checkedAt: new Date().toISOString() };
      } catch (err) {
        i.health = { ok: false, detail: (err as Error).message, checkedAt: new Date().toISOString() };
      }
    }),
  );
  return items;
}
