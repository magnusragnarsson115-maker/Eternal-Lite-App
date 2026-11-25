import { useMutation } from '@tanstack/react-query';
import { CloudOff, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiProfile, get } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { clearOffline, offlineStale, readOffline, saveOffline, type OfflinePack } from '../lib/offline';
import { useSession } from '../session';
import { BrandMark, Button, Card, Notice, useToast } from '../ui';
import { CrisisNumbers } from './MvpPages';

/**
 * Tryb offline (A5.12, A24.6, S4.4): kopia karty ratunkowej, leków z godzinami, najbliższych wizyt i kontaktu do
 * placówki. Zapis na urządzeniu tylko po decyzji pacjenta; numery alarmowe są w aplikacji zawsze.
 */

const DAY: Record<number, string> = { 1: 'pon.', 2: 'wt.', 3: 'śr.', 4: 'czw.', 5: 'pt.', 6: 'sob.', 7: 'niedz.' };

export function OfflinePackView({ pack, savedAt }: { pack: OfflinePack; savedAt: string }) {
  const { t, fmt } = useI18n();
  const c = pack.card;
  return (
    <div className="stack-lg">
      <Notice kind="info" title={t('Kopia z urządzenia')}>
        {t('Stan z {d}. Leki i wizyty mogły się od tego czasu zmienić.', { d: fmt.dateTime(savedAt) })}
      </Notice>
      <Card title={t('Karta ratunkowa')}>
        <dl className="kv">
          <dt>{t('Imię i nazwisko')}</dt>
          <dd>{c.name || '—'}</dd>
          {c.birthDate && (
            <>
              <dt>{t('Data urodzenia')}</dt>
              <dd>{fmt.date(c.birthDate)}</dd>
            </>
          )}
          {c.notes && (
            <>
              <dt>{t('Ważne informacje')}</dt>
              <dd>{c.notes}</dd>
            </>
          )}
          {c.medications.length > 0 && (
            <>
              <dt>{t('Leki')}</dt>
              <dd>{c.medications.join('; ')}</dd>
            </>
          )}
          {c.directives.length > 0 && (
            <>
              <dt>{t('Dyspozycje')}</dt>
              <dd>{c.directives.join('; ')}</dd>
            </>
          )}
        </dl>
        {c.contacts.length > 0 && (
          <ul className="list" style={{ marginTop: 12 }}>
            {c.contacts.map((p) => (
              <li key={`${p.name}-${p.phone}`} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    {p.name}
                    {p.relation ? ` · ${p.relation}` : ''}
                  </span>
                  <span className="list-sub mono">{p.phone}</span>
                </span>
                <a className="btn secondary sm" href={`tel:${p.phone.replace(/\s/g, '')}`}>
                  {t('Zadzwoń')}
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="small muted" style={{ margin: '10px 0 0' }}>{t(c.disclaimer)}</p>
      </Card>
      <Card title={t('Leki i godziny przypomnień')}>
        {!pack.medications.length && !pack.reminders.length ? (
          <p className="muted" style={{ margin: 0 }}>{t('Brak zapisanych leków.')}</p>
        ) : (
          <ul className="list">
            {pack.medications.map((m) => (
              <li key={m.name} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>{m.name}</span>
                  {m.dosage && <span className="list-sub">{m.dosage}</span>}
                </span>
              </li>
            ))}
            {pack.reminders.map((r) => (
              <li key={`${r.label}-${r.times.join()}`} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>{r.label}</span>
                  <span className="list-sub">
                    {r.times.join(', ')}
                    {r.days.length && r.days.length < 7 ? ` · ${r.days.map((d) => t(DAY[d] ?? String(d))).join(', ')}` : ` · ${t('codziennie')}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t('Najbliższe wizyty')}>
        {!pack.appointments.length ? (
          <p className="muted" style={{ margin: 0 }}>{t('Brak zaplanowanych wizyt w ciągu 60 dni.')}</p>
        ) : (
          <ul className="list">
            {pack.appointments.map((a) => (
              <li key={a.start} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    {fmt.dateTime(a.start)} · {a.service ?? t('Wizyta')}
                  </span>
                  <span className="list-sub">{[a.practitioner, a.tele ? t('wizyta wideo') : a.place].filter(Boolean).join(' · ')}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={pack.clinic.name}>
        <dl className="kv">
          {pack.clinic.phone && (
            <>
              <dt>{t('Telefon')}</dt>
              <dd>
                <a href={`tel:${pack.clinic.phone.replace(/\s/g, '')}`}>{pack.clinic.phone}</a>
              </dd>
            </>
          )}
          {pack.clinic.address && (
            <>
              <dt>{t('Adres')}</dt>
              <dd>{pack.clinic.address}</dd>
            </>
          )}
        </dl>
      </Card>
    </div>
  );
}

/** Ekran, gdy aplikacja nie łączy się z serwerem: kopia z urządzenia (jeśli jest) i zawsze numery alarmowe. */
export function OfflinePage() {
  const { t } = useI18n();
  const stored = readOffline();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="p-header">
        <div className="p-header-inner">
          <span className="brand">
            <BrandMark />
            <span className="brand-name">eternal</span>
          </span>
          <span className="grow" />
          <Button size="sm" variant="secondary" icon={<RefreshCw size={16} />} onClick={() => window.location.reload()}>
            {t('Spróbuj ponownie')}
          </Button>
        </div>
      </header>
      <main id="main" style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 64px' }} className="stack-lg">
        <div className="page-head">
          <h1>
            <WifiOff size={26} aria-hidden /> {t('Brak połączenia')}
          </h1>
          <p className="muted">{t('Aplikacja nie może połączyć się z serwerem. Numery alarmowe działają zawsze.')}</p>
        </div>
        <Card title={t('Numery alarmowe')}>
          <CrisisNumbers />
        </Card>
        {stored ? <OfflinePackView pack={stored.pack} savedAt={stored.savedAt} /> : <Notice kind="info">{t('Na tym urządzeniu nie ma kopii danych. Możesz ją zapisać w zakładce „SOS i karta ratunkowa”, gdy będzie internet.')}</Notice>}
      </main>
    </div>
  );
}

/** Odświeżanie zapisanej kopii po cichu, gdy aplikacja ma połączenie (raz na pół doby). */
export function useOfflineRefresh() {
  const { me } = useSession();
  useEffect(() => {
    const s = readOffline();
    if (!me?.authenticated || !me.user || !s || s.userId !== me.user.id || !offlineStale(s)) return;
    get<OfflinePack>('/api/me/offline-pack')
      .then((pack) => saveOffline(me.user!.id, pack, s.label))
      .catch(() => undefined);
  }, [me?.authenticated, me?.user]);
}

/** Pasek, gdy przeglądarka zgłasza brak internetu — z odnośnikiem do kopii. */
export function OfflineBanner() {
  const { t } = useI18n();
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  const stored = readOffline();
  return (
    <div className="stack" style={{ padding: '0 16px' }}>
      <Notice kind="warn" title={t('Brak internetu')}>
        {stored ? t('Możesz zajrzeć do kopii z urządzenia.') : t('Na tym urządzeniu nie ma kopii danych.')}{' '}
        {stored && (
          <button type="button" className="link-btn" onClick={() => setShow((x) => !x)}>
            {show ? t('Ukryj kopię') : t('Pokaż kopię')}
          </button>
        )}
      </Notice>
      {show && stored && <OfflinePackView pack={stored.pack} savedAt={stored.savedAt} />}
    </div>
  );
}

/** Karta w „SOS i karta ratunkowa”: zapis, odświeżenie i usunięcie kopii na tym urządzeniu. */
export function OfflineCopyCard() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const { me, profile } = useSession();
  const [stored, setStored] = useState(readOffline);
  const mine = stored && me?.user && stored.userId === me.user.id ? stored : undefined;
  const save = useMutation({
    mutationFn: () => get<OfflinePack>('/api/me/offline-pack'),
    onSuccess: (pack) => {
      if (!me?.user) return;
      if (!saveOffline(me.user.id, pack, apiProfile() ? profile?.name : undefined)) {
        toast(t('Ta przeglądarka nie pozwala zapisać danych (np. tryb prywatny).'));
        return;
      }
      setStored(readOffline());
      toast(t('Zapisano kopię na tym urządzeniu.'));
    },
  });
  return (
    <Card title={t('Kopia na wypadek braku internetu')}>
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>
          {t('Karta ratunkowa, leki z godzinami, najbliższe wizyty i telefon do placówki — na tym urządzeniu, także bez internetu. Zapisuj tylko na własnym telefonie lub komputerze. Kopia znika po wylogowaniu.')}
        </p>
        {mine ? (
          <Notice kind="ok">
            {t('Kopia zapisana {d}', { d: fmt.dateTime(mine.savedAt) })}
            {mine.label ? ` · ${mine.label}` : ''}
          </Notice>
        ) : (
          <Notice kind="info">{t('Na tym urządzeniu nie ma kopii.')}</Notice>
        )}
        {save.isError && <Notice kind="danger">{errorMessage(save.error, t)}</Notice>}
        <div className="btn-row">
          <Button icon={mine ? <RefreshCw size={16} /> : <CloudOff size={16} />} loading={save.isPending} onClick={() => save.mutate()}>
            {mine ? t('Odśwież kopię') : t('Zapisz kopię na tym urządzeniu')}
          </Button>
          {mine && (
            <Button
              variant="ghost"
              icon={<Trash2 size={16} />}
              onClick={() => {
                clearOffline();
                setStored(undefined);
                toast(t('Usunięto kopię z tego urządzenia.'));
              }}
            >
              {t('Usuń kopię')}
            </Button>
          )}
        </div>
        {mine && (
          <details>
            <summary>{t('Pokaż kopię')}</summary>
            <div style={{ marginTop: 12 }}>
              <OfflinePackView pack={mine.pack} savedAt={mine.savedAt} />
            </div>
          </details>
        )}
      </div>
    </Card>
  );
}
