import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Footprints, Link2, Moon, RefreshCw } from 'lucide-react';
import { get, post } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { Button, Card, QueryError, useToast } from '../ui';

/**
 * Aktywność i sen z urządzeń (F2.1, F2.2, F9.1, F9.3, F12.1, F2.19): dzienne podsumowania z Apple Health,
 * Health Connect i Withings — liczby z urządzenia, bez ocen i bez „wyniku snu”.
 */

interface ActivityDay {
  date: string;
  source: 'healthkit' | 'health-connect' | 'withings' | 'validic' | 'manual';
  device?: string;
  steps?: number;
  sleep?: { minutes: number; deep?: number; light?: number; rem?: number; awake?: number };
}

const SOURCE: Record<ActivityDay['source'], string> = { healthkit: 'Apple Health', 'health-connect': 'Health Connect', withings: 'Withings', validic: 'Validic', manual: 'wpis ręczny' };

/**
 * Validic Inform (runda 5): połączenie setek urządzeń i aplikacji jednym kontem. Pacjent otwiera stronę Validic
 * Marketplace (logowanie u producenta urządzenia), a aplikacja pobiera dane przez API — bez widżetu w aplikacji.
 */
export function ValidicCard() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['validic'], queryFn: () => get<{ configured: boolean; connected: boolean; lastSyncAt?: string; lastResult?: { measurements: number; days: number } }>('/api/me/validic'), retry: false });
  const connect = useMutation({
    mutationFn: () => post<{ marketplaceUrl: string }>('/api/me/validic/connect'),
    onSuccess: (r) => {
      window.open(r.marketplaceUrl, '_blank', 'noopener,noreferrer');
      void qc.invalidateQueries({ queryKey: ['validic'] });
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const sync = useMutation({
    mutationFn: () => post<{ measurements: number; days: number }>('/api/me/validic/sync'),
    onSuccess: (r) => {
      toast(t('Pobrano: pomiary {m}, dni aktywności i snu {d}.', { m: r.measurements, d: r.days }));
      void qc.invalidateQueries({ queryKey: ['validic'] });
      void qc.invalidateQueries({ queryKey: ['activity'] });
      void qc.invalidateQueries({ queryKey: ['measurements'] });
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  if (!q.data?.configured) return null;
  return (
    <Card title={<h3>{t('Inne urządzenia (Validic)')}</h3>}>
      <p className="small muted">{t('Wagi, ciśnieniomierze, glukometry i zegarki wielu producentów — połącz konto u producenta na stronie Validic, a pomiary pojawią się tutaj.')}</p>
      <div className="btn-row">
        <Button size="sm" variant="secondary" icon={<Link2 size={14} />} loading={connect.isPending} onClick={() => connect.mutate()}>
          {q.data.connected ? t('Zarządzaj połączonymi urządzeniami') : t('Połącz urządzenia')}
        </Button>
        {q.data.connected && (
          <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} loading={sync.isPending} onClick={() => sync.mutate()}>
            {t('Pobierz dane teraz')}
          </Button>
        )}
      </div>
      {q.data.lastSyncAt && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          {t('Ostatnio: {d}', { d: fmt.dateTime(q.data.lastSyncAt) })}
          {q.data.lastResult ? ` · ${t('pomiary {m}, dni {d}', { m: q.data.lastResult.measurements, d: q.data.lastResult.days })}` : ''}
        </p>
      )}
    </Card>
  );
}

export function ActivityCard() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['activity'], queryFn: () => get<{ items: ActivityDay[] }>('/api/me/activity?days=30') });
  const hm = (m?: number) => (m === undefined ? '—' : t('{h} h {m} min', { h: Math.floor(m / 60), m: Math.round(m % 60) }));
  return (
    <Card title={<h3>{t('Aktywność i sen z urządzeń')}</h3>}>
      {q.isError && <QueryError error={q.error} />}
      {q.data && !q.data.items.length && (
        <p className="small muted" style={{ margin: 0 }}>
          {t('Brak danych. Kroki i sen z Apple Health albo Health Connect przesyła aplikacja Eternal na telefonie (po Twojej zgodzie w telefonie); sen z Withings — po połączeniu konta Withings.')}
        </p>
      )}
      {!!q.data?.items.length && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Dzień')}</th>
                <th>{t('Kroki')}</th>
                <th>{t('Sen')}</th>
                <th>{t('Fazy snu (głęboki / płytki / REM / czuwanie)')}</th>
                <th>{t('Źródło')}</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.slice(0, 30).map((d) => (
                <tr key={`${d.date}-${d.source}`}>
                  <td>{fmt.date(d.date)}</td>
                  <td>
                    {d.steps !== undefined ? (
                      <>
                        <Footprints size={14} aria-hidden /> {fmt.number(d.steps)}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {d.sleep ? (
                      <>
                        <Moon size={14} aria-hidden /> {hm(d.sleep.minutes)}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="small">{d.sleep ? [d.sleep.deep, d.sleep.light, d.sleep.rem, d.sleep.awake].map((x) => (x === undefined ? '—' : `${x} min`)).join(' / ') : '—'}</td>
                  <td className="small muted">{t(SOURCE[d.source])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted" style={{ marginBottom: 0 }}>{t('Liczby pochodzą z urządzenia i jego algorytmów (np. podział na fazy snu). Aplikacja ich nie ocenia.')}</p>
    </Card>
  );
}
