import { aiMode } from '../ai/gateway.js';
import { ocrConfigured } from '../ai/ocr.js';
import { PROMPTS } from '../ai/prompts.js';
import { sttMode } from '../ai/stt.js';
import { config } from '../config.js';
import { getDb } from '../db.js';

/**
 * Tryb degradacji przy awarii (A18.8) i karta modelu dla użytkownika (A18.2).
 *
 * Status liczymy z zapisów, które i tak prowadzimy (rejestr wywołań AI, kolejka wiadomości) — bez dodatkowego
 * monitoringu: co najmniej 3 błędy w ostatnich 15 minutach i żadnego sukcesu po ostatnim błędzie = „ograniczone
 * działanie”. Każdy składnik ma opisany tryb zastępczy, który aplikacja pokazuje użytkownikowi zamiast błędu.
 */

export type ComponentStatus = 'ok' | 'degraded' | 'off';

export interface StatusItem {
  id: 'ai' | 'ocr' | 'stt' | 'email' | 'sms' | 'push';
  label: string;
  status: ComponentStatus;
  fallback: string;
}

const WINDOW_MIN = 15;
const MIN_FAILURES = 3;

const FALLBACK: Record<StatusItem['id'], { label: string; fallback: string }> = {
  ai: { label: 'Szkic notatki i porządkowanie dokumentów (AI)', fallback: 'Notatkę lekarz pisze ręcznie; dokumenty sprawdzasz w oryginale. Nic nie ginie — możesz wrócić do tego później.' },
  ocr: { label: 'Odczyt zdjęć i skanów dokumentów', fallback: 'Plik zapisuje się bez odczytu — wyniki możesz wpisać ręcznie albo poczekać na ponowny odczyt.' },
  stt: { label: 'Transkrypcja nagrania wizyty', fallback: 'Nagranie zostaje zapisane, transkrypcja wykona się później; notatkę można napisać ręcznie.' },
  email: { label: 'Wiadomości e-mail', fallback: 'Wiadomości czekają w kolejce i wyjdą, gdy usługa wróci. Powiadomienia w aplikacji działają.' },
  sms: { label: 'Wiadomości SMS', fallback: 'SMS-y czekają w kolejce; przypomnienia widać w aplikacji i w e-mailu.' },
  push: { label: 'Powiadomienia push', fallback: 'Powiadomienia są widoczne po otwarciu aplikacji.' },
};

function failing(rows: { ok: number; ts: string }[]): boolean {
  const failures = rows.filter((r) => !r.ok);
  if (failures.length < MIN_FAILURES) return false;
  const lastFail = failures.reduce((m, r) => (r.ts > m ? r.ts : m), '');
  return !rows.some((r) => r.ok && r.ts > lastFail);
}

export function systemStatus(now: Date = new Date()): StatusItem[] {
  const since = new Date(now.getTime() - WINDOW_MIN * 60_000).toISOString();
  const db = getDb();
  const ai = db.prepare("SELECT (outcome = 'ok') AS ok, ts FROM ai_call WHERE ts >= ? AND provider <> 'demo'").all(since) as { ok: number; ts: string }[];
  const channel = (ch: string) =>
    db
      .prepare("SELECT (status = 'sent') AS ok, COALESCE(sent_at, created_at) AS ts FROM outbox WHERE channel = ? AND COALESCE(sent_at, created_at) >= ? AND (status = 'sent' OR attempts > 0) AND status <> 'skipped'")
      .all(ch, since) as { ok: number; ts: string }[];
  const item = (id: StatusItem['id'], status: ComponentStatus): StatusItem => ({ id, status, ...FALLBACK[id] });
  return [
    item('ai', aiMode() === 'off' ? 'off' : failing(ai) ? 'degraded' : 'ok'),
    item('ocr', ocrConfigured() || aiMode() !== 'off' ? 'ok' : 'off'),
    item('stt', sttMode() === 'off' ? 'off' : 'ok'),
    item('email', failing(channel('email')) ? 'degraded' : 'ok'),
    item('sms', failing(channel('sms')) ? 'degraded' : 'ok'),
    item('push', failing(channel('push')) ? 'degraded' : 'ok'),
  ];
}

// --- karta modelu dla użytkownika (A18.2) ------------------------------------------------------------------------

export const AI_CARD_VERSION = 'karta-modelu/2026-10-1';

export interface AiCard {
  id: string;
  name: string;
  purpose: string;
  doesNot: string;
  oversight: string;
  data: string;
  provider: string;
  promptVersion?: string;
  status: 'model' | 'demo' | 'off' | 'rules';
}

/**
 * Karty zastosowań AI pokazywane pacjentom i personelowi — co robi, czego nie robi, kto sprawdza wynik, jakie dane
 * trafiają do modelu, który dostawca i wersja polecenia. Zgodne z rejestrem zastosowań AI (A18.6) i z granicą MDR.
 */
export function aiCards(): AiCard[] {
  const mode = aiMode();
  const provider = mode === 'model' ? `${config.ai.provider}${config.ai.provider === 'bedrock' ? ` (${config.ai.awsRegion})` : ''}${config.ai.secondary ? `, zapasowo ${config.ai.secondary}` : ''}` : mode === 'demo' ? 'reguły demonstracyjne (bez modelu)' : 'wyłączone';
  const status = mode;
  return [
    {
      id: 'scribe-note',
      name: 'Szkic notatki z wizyty (Eternal Scribe)',
      purpose: 'Na podstawie nagrania i transkrypcji, nagranych za zgodą pacjenta, przygotowuje szkic notatki z odnośnikami do fragmentów rozmowy.',
      doesNot: 'Nie stawia diagnozy, nie proponuje leczenia, nie ocenia wyników. Szkic nie trafia do dokumentacji bez zatwierdzenia przez lekarza.',
      oversight: 'Lekarz czyta, poprawia i zatwierdza każdą notatkę; poprawki są liczone jako miernik jakości.',
      data: 'Transkrypcja wizyty bez danych identyfikujących w poleceniu; dostawca nie przechowuje treści.',
      provider,
      promptVersion: PROMPTS['scribe-note'].version,
      status,
    },
    {
      id: 'patient-summary',
      name: 'Karta „Po wizycie” prostym językiem',
      purpose: 'Przepisuje zatwierdzoną notatkę lekarza na krótkie podsumowanie dla pacjenta.',
      doesNot: 'Nie dodaje nowych informacji medycznych i nie zmienia zaleceń lekarza.',
      oversight: 'Lekarz zatwierdza kartę przed wysłaniem pacjentowi.',
      data: 'Zatwierdzona notatka z wizyty.',
      provider,
      promptVersion: PROMPTS['patient-summary'].version,
      status,
    },
    {
      id: 'lab-extract',
      name: 'Odczyt wyników z dokumentów',
      purpose: 'Odczytuje nazwy badań, wartości, jednostki i zakresy z wgranego PDF albo zdjęcia, z zaznaczeniem miejsca w oryginale.',
      doesNot: 'Nie ocenia wyników i nie dopisuje norm — zakres pochodzi wyłącznie z dokumentu laboratorium.',
      oversight: 'Pacjent albo personel potwierdza każde odczytane pole; niepotwierdzony odczyt nie jest faktem.',
      data: 'Wgrany dokument.',
      provider: `${provider}; odczyt tekstu: ${ocrConfigured() ? config.ocr.provider : 'warstwa tekstowa PDF'}`,
      promptVersion: PROMPTS['lab-extract'].version,
      status,
    },
    {
      id: 'transcription',
      name: 'Transkrypcja nagrania wizyty',
      purpose: 'Zamienia nagranie wizyty na tekst do szkicu notatki.',
      doesNot: 'Nie interpretuje treści rozmowy.',
      oversight: 'Lekarz widzi transkrypcję obok szkicu notatki.',
      data: 'Nagranie wizyty (za zgodą pacjenta), usuwane po przetworzeniu zgodnie z polityką placówki.',
      provider: sttMode() === 'service' ? config.stt.provider : sttMode() === 'demo' ? 'tryb demonstracyjny' : 'wyłączone',
      status: sttMode() === 'service' ? 'model' : sttMode() === 'demo' ? 'demo' : 'off',
    },
    {
      id: 'no-ai',
      name: 'Czego aplikacja nie robi z AI',
      purpose: 'Raporty, dzienniki, ankiety, kalendarz, przypomnienia i karty działają bez modelu AI — to proste zestawienia Twoich danych.',
      doesNot: 'Brak triażu, diagnozy, oceny ryzyka, dawkowania i porad terapeutycznych. To wymagałoby certyfikacji wyrobu medycznego.',
      oversight: 'Granica opisana w dokumentacji zgodności (COMPLIANCE §1).',
      data: '—',
      provider: '—',
      status: 'rules',
    },
  ];
}
