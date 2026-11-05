import type { HealthBridge } from './health-types';

/** Platforma bez magazynu zdrowia (np. web): moduł niedostępny. Wersje natywne: health.ios.ts, health.android.ts. */
export const health: HealthBridge = {
  label: '',
  available: async () => false,
  requestAccess: async () => false,
  readDays: async () => [],
};
