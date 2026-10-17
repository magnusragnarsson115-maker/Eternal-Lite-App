import { useQuery } from '@tanstack/react-query';
import { Footprints, Moon } from 'lucide-react';
import { get } from '../api';
import { useI18n } from '../i18n';
import { Card, QueryError } from '../ui';

/**
 * Aktywność i sen z urządzeń (F2.1, F2.2, F9.1, F9.3, F12.1, F2.19): dzienne podsumowania z Apple Health,
 * Health Connect i Withings — liczby z urządzenia, bez ocen i bez „wyniku snu”.
 */

interface ActivityDay {
  date: string;
  source: 'healthkit' | 'health-connect' | 'withings' | 'manual';
  device?: string;
  steps?: number;
  sleep?: { minutes: number; deep?: number; light?: number; rem?: number; awake?: number };
}

const SOURCE: Record<ActivityDay['source'], string> = { healthkit: 'Apple Health', 'health-connect': 'Health Connect', withings: 'Withings', manual: 'wpis ręczny' };

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
