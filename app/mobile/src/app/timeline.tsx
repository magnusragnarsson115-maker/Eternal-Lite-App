import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, Card, Empty, Loading, P, Row, Screen } from '../components/ui';
import { get } from '../lib/api';
import { useI18n } from '../lib/i18n';

interface TimelineRow {
  id: string;
  name: string;
  loinc?: string;
  date: string;
  value: string;
  unit?: string;
  range?: string;
  labFlag?: string;
  trust?: string;
  version?: string;
  source: 'patient' | 'clinic';
}

interface Explanations {
  version: string;
  approval?: { by: string; at: string };
  visible: boolean;
  draft: boolean;
  tests: Record<string, { text: string }>;
  units: Record<string, string>;
}

/** Normalizacja jednostki jak na serwerze (server/labs/explanations.ts). */
function unitKey(unit: string): string {
  const k = unit.trim().toLowerCase().replace(/µ|μ/g, 'u').replace(/[[\]{}\s]/g, '').replace(/\^/g, '*').replace(/x10/g, '10');
  const aliases: Record<string, string> = { 'tys/ul': '10*3/ul', 'mln/ul': '10*6/ul', 'g/100ml': 'g/dl', 'mg/100ml': 'mg/dl', 'mm/godz': 'mm/h', sek: 's', 'miu/l': 'uiu/ml', 'j/l': 'u/l', 'iu/l': 'u/l' };
  return aliases[k] ?? k;
}

interface Version {
  version?: string;
  at?: string;
  status: string;
  value: string;
  unit?: string;
  reason?: string;
}

const TRUST_PL: Record<string, string> = {
  'patient-confirmed': 'potwierdzone przez Ciebie',
  'clinician-confirmed': 'potwierdzone przez lekarza',
  'machine-unconfirmed': 'odczyt maszynowy, niepotwierdzony',
  manual: 'wpis ręczny',
  clinic: 'od placówki',
};

/** Oś czasu wyników (P3: A2.5) — przy każdej wartości pochodzenie i historia wersji. Zakres i oznaczenie wyłącznie z dokumentu laboratorium. */
export default function TimelineScreen() {
  const { t, date, dateTime } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['timeline'], queryFn: () => get<{ items: TimelineRow[] }>('/api/me/timeline') });
  const v = useQuery({ queryKey: ['obs-versions', open], queryFn: () => get<{ versions: Version[] }>(`/api/me/observations/${open}/versions`), enabled: !!open });
  // objaśnienia ze słownika (A2.4): co mierzy badanie, bez oceny wartości
  const ex = useQuery({ queryKey: ['explanations'], queryFn: () => get<Explanations>('/api/public/explanations'), staleTime: 60 * 60_000 });
  const sel = q.data?.items.find((r) => r.id === open);
  const expl = sel?.loinc && ex.data?.visible ? ex.data.tests[sel.loinc] : undefined;
  return (
    <Screen>
      <P muted>{t('Zakres i oznaczenia pochodzą z dokumentu laboratorium. Aplikacja niczego nie ocenia.')}</P>
      {open ? (
        <Card title={t('Historia wersji wartości')}>
          {expl && ex.data ? (
            <>
              <P>{`${t('Co mierzy to badanie?')} ${ex.data.draft ? t('Projekt — czeka na zatwierdzenie przez lekarza.') + ' ' : ''}${expl.text}`}</P>
              {sel?.unit && ex.data.units[unitKey(sel.unit)] ? <P small muted>{`${t('Jednostka')} ${sel.unit}: ${ex.data.units[unitKey(sel.unit)]}`}</P> : null}
              <P small muted>
                {ex.data.approval
                  ? t('Opis ogólny ze słownika ({v}), zatwierdził(a): {by}. Nie dotyczy Twojego wyniku i go nie ocenia.', { v: ex.data.version, by: ex.data.approval.by })
                  : t('Projekt opisu ze słownika ({v}) — czeka na zatwierdzenie przez lekarza. Nie dotyczy Twojego wyniku i go nie ocenia.', { v: ex.data.version })}
              </P>
            </>
          ) : null}
          {v.isLoading ? (
            <Loading />
          ) : (
            v.data?.versions.map((x, i) => <Row key={i} title={`${x.value} ${x.unit ?? ''}`} sub={[dateTime(x.at), x.status === 'amended' ? t('poprawione') : '', x.reason ? t('powód: {r}', { r: x.reason }) : ''].filter(Boolean).join(' · ')} />)
          )}
          <Button title={t('Zamknij')} variant="ghost" onPress={() => setOpen(null)} />
        </Card>
      ) : null}
      <Card>
        {q.isLoading ? (
          <Loading />
        ) : !q.data?.items.length ? (
          <Empty title={t('Brak wyników')} />
        ) : (
          q.data.items.slice(0, 200).map((r) => (
            <Row
              key={r.id}
              title={`${r.name}: ${r.value} ${r.unit ?? ''}`}
              sub={[date(r.date), r.range ? t('zakres z dokumentu: {r}', { r: r.range }) : '', r.labFlag ? t('oznaczenie laboratorium: {f}', { f: r.labFlag }) : '', t(TRUST_PL[r.trust ?? ''] ?? '')].filter(Boolean).join(' · ')}
              right={r.version && r.version !== '1' ? <Badge>{t('wersje')}</Badge> : undefined}
              onPress={() => setOpen(r.id)}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
