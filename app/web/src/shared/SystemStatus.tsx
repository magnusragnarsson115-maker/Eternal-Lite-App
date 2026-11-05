import { useQuery } from '@tanstack/react-query';
import { Cpu } from 'lucide-react';
import { get } from '../api';
import { useI18n } from '../i18n';
import { Badge, Card, Notice, PageHead, Skeleton } from '../ui';

/**
 * Tryb degradacji (A18.8): gdy usługa działa ograniczenie, aplikacja mówi wprost, co robi zamiast niej.
 * Karta modelu (A18.2): co robi AI w aplikacji, czego nie robi i kto sprawdza wynik.
 */

interface StatusItem {
  id: string;
  label: string;
  status: 'ok' | 'degraded' | 'off';
  fallback: string;
}

export function StatusBanner() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['system-status'], queryFn: () => get<{ items: StatusItem[]; degraded: boolean }>('/api/public/status'), refetchInterval: 120_000, retry: false });
  const bad = q.data?.items.filter((i) => i.status === 'degraded') ?? [];
  if (!bad.length) return null;
  return (
    <div style={{ maxWidth: 1080, margin: '12px auto 0', padding: '0 16px', width: '100%' }}>
      <Notice kind="warn" title={t('Część usług działa teraz w ograniczonym zakresie')}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {bad.map((i) => (
            <li key={i.id}>
              <strong>{t(i.label)}:</strong> {t(i.fallback)}
            </li>
          ))}
        </ul>
      </Notice>
    </div>
  );
}

interface AiCard {
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

const STATUS_LABEL: Record<AiCard['status'], string> = { model: 'działa', demo: 'tryb demonstracyjny', off: 'wyłączone', rules: 'bez AI' };

export function AiCardsPage() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['ai-cards'], queryFn: () => get<{ version: string; items: AiCard[] }>('/api/public/ai-cards') });
  return (
    <div className="stack-lg">
      <PageHead title={t('Jak działa AI w aplikacji')} sub={t('Karty zastosowań sztucznej inteligencji: co robi, czego nie robi, kto sprawdza wynik i jakie dane trafiają do modelu.')} />
      {q.isLoading && <Skeleton count={3} />}
      {q.data?.items.map((c) => (
        <Card key={c.id} title={t(c.name)} action={<Badge kind={c.status === 'model' ? 'ok' : c.status === 'rules' ? 'info' : 'warn'}>{t(STATUS_LABEL[c.status])}</Badge>}>
          <dl className="kv">
            <dt>{t('Do czego służy')}</dt>
            <dd>{t(c.purpose)}</dd>
            <dt>{t('Czego nie robi')}</dt>
            <dd>{t(c.doesNot)}</dd>
            <dt>{t('Kto sprawdza wynik')}</dt>
            <dd>{t(c.oversight)}</dd>
            <dt>{t('Jakie dane')}</dt>
            <dd>{t(c.data)}</dd>
            <dt>{t('Dostawca')}</dt>
            <dd>{c.provider}</dd>
            {c.promptVersion && (
              <>
                <dt>{t('Wersja polecenia')}</dt>
                <dd>{c.promptVersion}</dd>
              </>
            )}
          </dl>
        </Card>
      ))}
      {q.data && (
        <p className="small muted">
          <Cpu size={14} aria-hidden /> {t('Wersja kart: {v}', { v: q.data.version })}
        </p>
      )}
    </div>
  );
}
