import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

/** Mapowanie zdarzeń domenowych na klucze zapytań do odświeżenia. */
const INVALIDATE: Record<string, string[]> = {
  'appointment.changed': ['appointments', 'appointment', 'dashboard', 'calendar', 'staff-dashboard', 'patient', 'free-slots', 'availability'],
  'slot.changed': ['availability', 'calendar', 'free-slots'],
  'report.changed': ['records', 'record', 'dashboard', 'patient-clinical'],
  'document.changed': ['records', 'record', 'dashboard', 'patient-clinical'],
  'message.changed': ['threads', 'thread', 'badges', 'dashboard', 'staff-dashboard'],
  'notification.created': ['notifications', 'badges', 'dashboard'],
  'observation.changed': ['measurements', 'medications', 'patient-clinical'],
  'questionnaire.changed': ['appointment', 'dashboard', 'patient-clinical'],
  'consent.changed': ['consents', 'patient', 'measurements'],
  'patient.changed': ['patient', 'profile', 'me', 'patients'],
  'outbox.changed': ['outbox'],
};

export interface LiveEvent {
  type: string;
  resourceRef?: string;
  at: string;
}

/**
 * Subskrypcja Server-Sent Events: zmiany wykonane po drugiej stronie (pacjent ↔ placówka)
 * odświeżają widoki natychmiast, bez przeładowania strony.
 */
export function useRealtime(enabled: boolean, onEvent?: (e: LiveEvent) => void): { connected: boolean } {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;
    let es: EventSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const connect = () => {
      es = new EventSource('/api/events', { withCredentials: true });
      es.onopen = () => setConnected(true);
      es.addEventListener('change', (msg) => {
        try {
          const e = JSON.parse((msg as MessageEvent).data) as LiveEvent;
          for (const key of INVALIDATE[e.type] ?? []) void qc.invalidateQueries({ queryKey: [key] });
          cb.current?.(e);
        } catch {
          /* pomijamy niepoprawne zdarzenie */
        }
      });
      es.onerror = () => {
        setConnected(false);
        es?.close();
        if (!closed) retry = setTimeout(connect, 4000);
      };
    };
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      es?.close();
      setConnected(false);
    };
  }, [enabled, qc]);

  return { connected };
}
