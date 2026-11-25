import { EventEmitter } from 'node:events';
import { currentScope } from './tenancy.js';

/**
 * Szyna zdarzeń domenowych. Zdarzenia nie zawierają danych medycznych —
 * tylko typ i referencję zasobu; klient po otrzymaniu zdarzenia odświeża dane przez API
 * (z pełną kontrolą dostępu i wpisem w dzienniku).
 */
export type DomainEventType =
  | 'appointment.changed'
  | 'slot.changed'
  | 'report.changed'
  | 'document.changed'
  | 'message.changed'
  | 'notification.created'
  | 'observation.changed'
  | 'questionnaire.changed'
  | 'consent.changed'
  | 'patient.changed'
  | 'outbox.changed'
  | 'grant.changed'
  | 'intake.changed'
  | 'scribe.changed'
  | 'tele.changed'
  | 'incident.changed';

export interface DomainEvent {
  type: DomainEventType;
  /** Pacjent, którego dotyczy zdarzenie — dostarczane do jego sesji. */
  patientRef?: string;
  /** Konkretny użytkownik (np. powiadomienie). */
  userId?: string;
  resourceRef?: string;
  /** false = nie dostarczać do sesji personelu. */
  staff?: boolean;
  /** Organizacje, których personel może otrzymać zdarzenie (brak = wszystkie — zdarzenia systemowe). */
  orgIds?: string[];
  at: string;
}

class EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  publish(event: Omit<DomainEvent, 'at'>): void {
    const scope = currentScope();
    const orgIds = event.orgIds ?? (scope?.orgId ? [scope.orgId] : scope?.patientOrgIds);
    this.emitter.emit('event', { ...event, orgIds, at: new Date().toISOString() } satisfies DomainEvent);
  }

  subscribe(handler: (event: DomainEvent) => void): () => void {
    this.emitter.on('event', handler);
    return () => this.emitter.off('event', handler);
  }
}

export const bus = new EventBus();
