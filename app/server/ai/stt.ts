import { config } from '../config.js';
import { fetchWithTimeout } from '../lib/util.js';
import { AiError } from './types.js';

/**
 * Mowa na tekst dla Eternal Scribe (moduł R5, D5).
 * Dostawca wybierany testem 20 nagrań (decyzja D48): ElevenLabs Scribe (rezydencja UE), Azure Speech (region UE)
 * albo OpenAI z rezydencją danych w UE. Wynik to ponumerowane fragmenty S1…Sn — szkic notatki odsyła do nich.
 */

export interface TranscriptSegment {
  id: string;
  start?: number;
  end?: number;
  speaker?: string;
  text: string;
}

export interface Transcript {
  provider: 'elevenlabs' | 'azure' | 'openai' | 'demo';
  model?: string;
  segments: TranscriptSegment[];
  durationSec?: number;
}

export function sttMode(): 'service' | 'demo' | 'off' {
  const s = config.stt;
  if (s.provider === 'elevenlabs' && s.elevenlabs.apiKey) return 'service';
  if (s.provider === 'azure' && s.azure.key) return 'service';
  if (s.provider === 'openai' && s.openai.apiKey) return 'service';
  return config.demoMode ? 'demo' : 'off';
}

function numbered(parts: Omit<TranscriptSegment, 'id'>[]): TranscriptSegment[] {
  return parts.filter((p) => p.text.trim()).map((p, i) => ({ ...p, text: p.text.trim(), id: `S${i + 1}` }));
}

/** Dzieli długi tekst bez znaczników czasu na zdania (OpenAI w formacie json). */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ0-9])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

function audioFile(data: Buffer, contentType: string): Blob {
  return new Blob([new Uint8Array(data)], { type: contentType });
}

function extFor(contentType: string): string {
  if (contentType.includes('webm')) return 'webm';
  if (contentType.includes('ogg')) return 'ogg';
  if (contentType.includes('mp4') || contentType.includes('m4a') || contentType.includes('aac')) return 'm4a';
  if (contentType.includes('wav')) return 'wav';
  if (contentType.includes('mpeg')) return 'mp3';
  return 'bin';
}

async function check(res: Response, name: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 401 || res.status === 403) throw new AiError('auth', `${name} ${res.status}`);
  if (res.status === 429) throw new AiError('rate_limited', `${name} 429`);
  if (res.status === 400 || res.status === 413 || res.status === 422) throw new AiError('bad_request', `${name} ${res.status}`);
  throw new AiError('provider_error', `${name} ${res.status}`);
}

async function elevenlabs(data: Buffer, contentType: string): Promise<Transcript> {
  const s = config.stt.elevenlabs;
  const form = new FormData();
  form.set('model_id', s.model);
  form.set('language_code', 'pol');
  form.set('diarize', 'true');
  form.set('num_speakers', '2');
  form.set('tag_audio_events', 'false');
  form.set('timestamps_granularity', 'word');
  form.set('file', audioFile(data, contentType), `wizyta.${extFor(contentType)}`);
  const res = await fetchWithTimeout(`${s.baseUrl.replace(/\/$/, '')}/v1/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': s.apiKey }, body: form }, 600_000).catch(
    (err: Error) => {
      throw new AiError('provider_unreachable', err.message);
    },
  );
  await check(res, 'ElevenLabs');
  const json = (await res.json()) as { text?: string; words?: { text: string; start?: number; end?: number; type?: string; speaker_id?: string }[] };
  // słowa → wypowiedzi: nowy fragment przy zmianie mówiącego albo po końcu zdania
  const parts: Omit<TranscriptSegment, 'id'>[] = [];
  let cur: Omit<TranscriptSegment, 'id'> | undefined;
  for (const w of json.words ?? []) {
    if (w.type === 'audio_event') continue;
    if (!cur || (w.type === 'word' && w.speaker_id !== cur.speaker)) {
      if (cur) parts.push(cur);
      cur = { start: w.start, end: w.end, speaker: w.speaker_id, text: '' };
    }
    cur.text += w.text;
    cur.end = w.end ?? cur.end;
    if (w.type === 'word' && /[.!?]$/.test(w.text) && cur.text.length > 160) {
      parts.push(cur);
      cur = undefined;
    }
  }
  if (cur) parts.push(cur);
  const segments = parts.length ? numbered(parts) : numbered(splitSentences(json.text ?? '').map((text) => ({ text })));
  const last = json.words?.at(-1)?.end;
  return { provider: 'elevenlabs', model: s.model, segments, durationSec: last };
}

async function azure(data: Buffer, contentType: string): Promise<Transcript> {
  const s = config.stt.azure;
  const form = new FormData();
  form.set('audio', audioFile(data, contentType), `wizyta.${extFor(contentType)}`);
  form.set('definition', JSON.stringify({ locales: ['pl-PL'], diarization: { enabled: true, maxSpeakers: 2 }, profanityFilterMode: 'None' }));
  const url = `https://${s.region}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15`;
  const res = await fetchWithTimeout(url, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': s.key }, body: form }, 600_000).catch((err: Error) => {
    throw new AiError('provider_unreachable', err.message);
  });
  await check(res, 'Azure Speech');
  const json = (await res.json()) as {
    durationMilliseconds?: number;
    phrases?: { offsetMilliseconds?: number; durationMilliseconds?: number; text: string; speaker?: number }[];
  };
  const segments = numbered(
    (json.phrases ?? []).map((p) => ({
      start: p.offsetMilliseconds !== undefined ? p.offsetMilliseconds / 1000 : undefined,
      end: p.offsetMilliseconds !== undefined && p.durationMilliseconds !== undefined ? (p.offsetMilliseconds + p.durationMilliseconds) / 1000 : undefined,
      speaker: p.speaker !== undefined ? `speaker_${p.speaker}` : undefined,
      text: p.text,
    })),
  );
  return { provider: 'azure', model: 'fast-transcription/2024-11-15', segments, durationSec: json.durationMilliseconds ? json.durationMilliseconds / 1000 : undefined };
}

async function openai(data: Buffer, contentType: string): Promise<Transcript> {
  const s = config.stt.openai;
  const form = new FormData();
  form.set('model', s.model);
  form.set('language', 'pl');
  form.set('response_format', 'json');
  form.set('file', audioFile(data, contentType), `wizyta.${extFor(contentType)}`);
  const res = await fetchWithTimeout(`${s.baseUrl.replace(/\/$/, '')}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${s.apiKey}` }, body: form }, 600_000).catch(
    (err: Error) => {
      throw new AiError('provider_unreachable', err.message);
    },
  );
  await check(res, 'OpenAI STT');
  const json = (await res.json()) as { text?: string };
  return { provider: 'openai', model: s.model, segments: numbered(splitSentences(json.text ?? '').map((text) => ({ text }))) };
}

/**
 * Przykładowa rozmowa dla trybu demonstracyjnego (dane fikcyjne) — pozwala pokazać cały przebieg Scribe
 * bez usługi mowy na tekst. Nigdy nie jest używana poza DEMO_MODE.
 */
export function demoTranscript(): Transcript {
  const lines: [string, string][] = [
    ['lekarz', 'Dzień dobry, co panią dzisiaj sprowadza?'],
    ['pacjent', 'Od około dwóch tygodni mam bóle głowy, głównie rano, i czasem kręci mi się w głowie.'],
    ['lekarz', 'Czy mierzyła pani ciśnienie w domu?'],
    ['pacjent', 'Tak, przez ostatni tydzień rano miałam około 150 na 95.'],
    ['lekarz', 'Jakie leki pani obecnie przyjmuje?'],
    ['pacjent', 'Tylko witaminę D, dwa tysiące jednostek dziennie.'],
    ['lekarz', 'W gabinecie zmierzyłem ciśnienie: 148 na 92, tętno 78.'],
    ['lekarz', 'Wyniki z zeszłego tygodnia: cholesterol całkowity 212 miligramów na decylitr, glukoza 92.'],
    ['lekarz', 'Proszę przez dwa tygodnie mierzyć ciśnienie rano i wieczorem i zapisywać wyniki.'],
    ['lekarz', 'Zlecam badanie lipidogramu i kreatyniny. Wizyta kontrolna za dwa tygodnie z dzienniczkiem pomiarów.'],
    ['lekarz', 'Jeśli pojawi się silny ból w klatce piersiowej, duszność albo zaburzenia mowy, proszę dzwonić pod 112.'],
    ['pacjent', 'Dobrze, dziękuję.'],
  ];
  let t = 0;
  return {
    provider: 'demo',
    model: 'przykładowa rozmowa',
    segments: numbered(
      lines.map(([speaker, text]) => {
        const start = t;
        t += Math.max(3, Math.round(text.length / 14));
        return { speaker, text, start, end: t };
      }),
    ),
    durationSec: t,
  };
}

export async function transcribe(data: Buffer, contentType: string): Promise<Transcript> {
  const mode = sttMode();
  if (mode === 'off') throw new AiError('not_configured', 'STT provider not configured');
  if (mode === 'demo') return demoTranscript();
  switch (config.stt.provider) {
    case 'elevenlabs':
      return elevenlabs(data, contentType);
    case 'azure':
      return azure(data, contentType);
    case 'openai':
      return openai(data, contentType);
    default:
      throw new AiError('not_configured', 'STT provider not configured');
  }
}

export function transcriptText(t: Pick<Transcript, 'segments'>): string {
  return t.segments.map((s) => `${s.id}${s.speaker ? ` [${s.speaker}]` : ''}: ${s.text}`).join('\n');
}
