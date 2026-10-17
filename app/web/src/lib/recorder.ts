import { useCallback, useEffect, useRef, useState } from 'react';

/** Nagrywanie dźwięku w przeglądarce (MediaRecorder) — mikrofon komputera albo telefonu. */
export function useRecorder() {
  const [state, setState] = useState<'idle' | 'recording' | 'paused' | 'stopped' | 'denied' | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices ? 'idle' : 'unsupported',
  );
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stream = useRef<MediaStream | null>(null);

  const stopTracks = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  };

  const start = useCallback(async () => {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setState('denied');
      return;
    }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m));
    const r = new MediaRecorder(stream.current, type ? { mimeType: type, audioBitsPerSecond: 32_000 } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      setBlob(new Blob(chunks.current, { type: r.mimeType || 'audio/webm' }));
      stopTracks();
    };
    r.start(1000);
    rec.current = r;
    setSeconds(0);
    setBlob(null);
    setState('recording');
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);

  const pause = useCallback(() => {
    if (rec.current?.state === 'recording') {
      rec.current.pause();
      setState('paused');
      if (timer.current) clearInterval(timer.current);
    } else if (rec.current?.state === 'paused') {
      rec.current.resume();
      setState('recording');
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
  }, []);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    rec.current?.stop();
    setState('stopped');
  }, []);

  const reset = useCallback(() => {
    setBlob(null);
    setSeconds(0);
    setState('idle');
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
      stopTracks();
    },
    [],
  );

  return { state, seconds, blob, start, pause, stop, reset };
}

export function clock(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
