import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Odtwarzanie przykładowej rozmowy Scribe w trybie pokazowym. Pokazowa sesja nie ma prawdziwego nagrania
 * (transkrypcja pochodzi z gotowej rozmowy), więc zamiast pliku audio czytamy zdania syntezą mowy przeglądarki
 * (Web Speech API, polski głos systemu) i podświetlamy zdanie, które właśnie brzmi. Nic nie wychodzi z urządzenia.
 */

export interface SpokenSegment {
  id: string;
  text: string;
  speaker?: string;
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

function polishVoices(): SpeechSynthesisVoice[] {
  try {
    return window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('pl'));
  } catch {
    return [];
  }
}

/**
 * Jeden polski głos systemu dla wszystkich (systemy mają zwykle jeden, nie zawsze tej samej płci co mówca);
 * pacjenta odróżnia wyższy ton.
 */
function voiceFor(speaker: string | undefined, voices: SpeechSynthesisVoice[]): { voice?: SpeechSynthesisVoice; pitch: number } {
  const patient = !!speaker && /pacjent|patient|opiekun|caregiver/i.test(speaker);
  return { voice: voices[0], pitch: patient ? 1.2 : 0.95 };
}

export function useDemoSpeech(onSegment: (id: string | null) => void) {
  const [playing, setPlaying] = useState(false);
  const run = useRef(0);
  const notify = useRef(onSegment);
  notify.current = onSegment;

  const stop = useCallback(() => {
    run.current += 1;
    if (speechSupported()) window.speechSynthesis.cancel();
    setPlaying(false);
    notify.current(null);
  }, []);

  /** Czyta zdania po kolei; `only` — jedno zdanie (kliknięcie w transkrypcji). */
  const play = useCallback((segments: SpokenSegment[], fromId?: string, only = false) => {
    if (!speechSupported() || !segments.length) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const id = ++run.current;
    const start = Math.max(0, fromId ? segments.findIndex((s) => s.id === fromId) : 0);
    const queue = only ? segments.slice(start, start + 1) : segments.slice(start);
    const voices = polishVoices();
    setPlaying(true);
    queue.forEach((seg, i) => {
      const u = new window.SpeechSynthesisUtterance(seg.text);
      const v = voiceFor(seg.speaker, voices);
      u.lang = v.voice?.lang ?? 'pl-PL';
      if (v.voice) u.voice = v.voice;
      u.pitch = v.pitch;
      u.rate = 1;
      u.onstart = () => {
        if (run.current === id) notify.current(seg.id);
      };
      const done = () => {
        if (run.current !== id || i !== queue.length - 1) return;
        setPlaying(false);
        notify.current(null);
      };
      u.onend = done;
      u.onerror = done;
      synth.speak(u);
    });
  }, []);

  // lista głosów ładuje się w tle (Chrome) — zaczynamy wcześniej; wyjście z ekranu przerywa czytanie
  useEffect(() => {
    if (speechSupported()) window.speechSynthesis.getVoices();
    return () => {
      run.current += 1;
      if (speechSupported()) window.speechSynthesis.cancel();
    };
  }, []);

  return { playing, play, stop, supported: speechSupported() };
}
