import { useSyncExternalStore } from 'react';
import { setApiProfile } from './api';
import { queryClient } from './query';
import type { FamilyProfile } from './types';

/**
 * Profil, w którym działa opiekun (A24.1/A24.2): dziecko albo osoba pod opieką. Wybór żyje tylko w pamięci aplikacji —
 * po zablokowaniu i wylogowaniu wraca własny profil.
 */

let active: FamilyProfile | undefined;
const listeners = new Set<() => void>();

export function setActiveProfile(p: FamilyProfile | undefined): void {
  const changed = (p && !p.self ? p.id : undefined) !== active?.id;
  active = p && !p.self ? p : undefined;
  setApiProfile(active?.id);
  // dane poprzedniego profilu nie mogą mignąć w nowym
  if (changed) queryClient.removeQueries({ predicate: (q) => String(q.queryKey[0]) !== 'family' });
  for (const l of listeners) l();
}

export function useActiveProfile(): FamilyProfile | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => active,
  );
}
