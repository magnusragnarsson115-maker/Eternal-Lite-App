import { Download, Mic, Pause, Square, Upload } from 'lucide-react';
import { useI18n } from '../i18n';
import { clock, useRecorder } from '../lib/recorder';
import type { AccessEntry, CardView } from '../mvp-types';
import { Button, Card, Empty, Notice } from '../ui';

/** Elementy wspólne dla stron pod linkiem, aplikacji pacjenta i panelu: dziennik „kto oglądał”, karta „Po wizycie”, nagrywanie. */

export function AccessLogList({ items }: { items: AccessEntry[] }) {
  const { t, fmt } = useI18n();
  if (!items.length) return <Empty title={t('Nikt jeszcze nie oglądał Twoich danych')} />;
  return (
    <ul className="list">
      {items.map((e, i) => (
        <li key={i} className="list-item">
          <span className="grow">
            <span className="list-title" style={{ display: 'block' }}>
              {e.who === 'Ty' ? t('Ty') : e.who}
              {e.org && <span className="muted"> · {e.org}</span>}
            </span>
            <span className="list-sub">{t(SUBTYPE_PL[e.subtype] ?? 'Dostęp do danych')}</span>
          </span>
          <span className="small muted nowrap">{fmt.dateTime(e.at)}</span>
        </li>
      ))}
    </ul>
  );
}

export const SUBTYPE_PL: Record<string, string> = {
  'intake-read': 'Odczyt przesłanego dokumentu',
  'intake-file-read': 'Otwarcie pliku dokumentu',
  'intake-list': 'Przegląd przesłanych materiałów',
  'facts-report': 'Raport faktów przed wizytą',
  'facts-report-pdf': 'Pobranie raportu faktów (PDF)',
  'visit-prep': 'Przygotowanie wizyty',
  'intake-clinician-confirm': 'Potwierdzenie odczytu przez lekarza',
  'patient-clinical-read': 'Odczyt dokumentacji',
  'record-read': 'Odczyt wyniku lub dokumentu',
  'file-download': 'Pobranie pliku',
  'patient-read': 'Odczyt danych pacjenta',
  'emergency-access': 'Dostęp ratunkowy (karta SOS)',
  'card-open': 'Otwarcie karty „Po wizycie”',
  'scribe-read': 'Notatka z wizyty',
  'shared-patients-list': 'Lista udostępnień',
  'scribe-start': 'Zgoda na nagranie i rozpoczęcie notatki z wizyty',
  'scribe-audio': 'Nagranie wizyty',
  'scribe-edit': 'Edycja notatki z wizyty',
  'scribe-manual': 'Notatka z wizyty bez nagrania',
  'scribe-approve': 'Zatwierdzenie notatki z wizyty',
  'scribe-amend': 'Poprawka notatki z wizyty',
  'card-draft': 'Szkic karty „Po wizycie”',
  'card-edit': 'Edycja karty „Po wizycie”',
  'card-send': 'Wysłanie karty „Po wizycie”',
  'card-read': 'Odczyt karty „Po wizycie”',
  'card-share': 'Udostępnienie karty osobie bliskiej',
  'card-share-authorized': 'Przekazanie karty osobie upoważnionej',
  'invite-create': 'Zaproszenie do przesłania dokumentów',
  'link-open': 'Otwarcie linku z zaproszenia',
  'grant-create': 'Udostępnienie danych',
  'grant-revoke': 'Wycofanie udostępnienia',
  'consent-grant': 'Zgoda',
  'consent-withdraw': 'Wycofanie zgody',
  'intake-upload': 'Przesłanie dokumentu',
  'intake-review': 'Potwierdzenie odczytu',
  'intake-submit': 'Zapis dokumentu w rekordzie',
  'record-share': 'Udostępnienie wyniku przez placówkę',
  'report-create': 'Dodanie wyniku przez placówkę',
  'document-create': 'Dodanie dokumentu przez placówkę',
  'appointment-book-staff': 'Rezerwacja wizyty przez placówkę',
  'appointment-book-online': 'Rezerwacja wizyty online',
  'message-send': 'Wiadomość',
  'patient-create': 'Założenie kartoteki',
  'measurement-manual': 'Pomiar wpisany ręcznie',
  'measurement-bluetooth': 'Pomiar z urządzenia',
  'emergency-contact-add': 'Dodanie osoby bliskiej',
  'emergency-info-update': 'Zmiana karty ratunkowej',
  'med-schedule-create': 'Przypomnienie o leku',
  'medication-add': 'Dodanie leku',
  'measurement-import': 'Pomiary zaimportowane z pliku',
  'patient-export-csv': 'Eksport danych (CSV)',
};

export function CardContent({ card, pdfUrl }: { card: CardView; pdfUrl: string }) {
  const { t, fmt } = useI18n();
  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <Card title={title}>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {items.map((x, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              {x}
            </li>
          ))}
        </ul>
      </Card>
    );
  return (
    <div className="stack-lg">
      <div className="page-head">
        <h1>{t('Karta „Po wizycie”')}</h1>
        <p className="muted">
          {card.clinic} · {card.doctor} · {fmt.dateTime(card.date)}
        </p>
      </div>
      <Notice kind="info">{t('Przygotowane przez AI, zatwierdzone przez lekarza.')}</Notice>
      {list(t('Co zrobiono na wizycie'), card.card.whatWasDone)}
      {list(t('Co robić dalej'), card.card.nextSteps)}
      {card.card.whenToReturn && (
        <Card title={t('Kiedy wrócić')}>
          <p style={{ margin: 0 }}>{card.card.whenToReturn}</p>
        </Card>
      )}
      {list(t('Kiedy zgłosić się wcześniej'), card.card.warningSigns)}
      {card.card.erecipeCode && (
        <Card title={t('Kod e-recepty')}>
          <p className="mono" style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            {card.card.erecipeCode}
          </p>
          <p className="small muted">{t('W aptece podaj kod i PESEL.')}</p>
        </Card>
      )}
      <a className="btn secondary" href={pdfUrl}>
        <Download size={18} /> {t('Pobierz PDF')}
      </a>
    </div>
  );
}

export function RecorderControls({ rec, sending, onSend }: { rec: ReturnType<typeof useRecorder>; sending: boolean; onSend: (b: Blob) => void }) {
  const { t } = useI18n();
  if (rec.state === 'unsupported') return <Notice kind="warn">{t('Ta przeglądarka nie obsługuje nagrywania dźwięku.')}</Notice>;
  if (rec.state === 'denied') return <Notice kind="danger">{t('Brak dostępu do mikrofonu. Zezwól na mikrofon w ustawieniach przeglądarki.')}</Notice>;
  return (
    <div className="stack center">
      <div className="tabular" style={{ fontSize: '2.4rem', fontWeight: 700 }} aria-live="polite">
        {rec.state === 'recording' && <span style={{ color: 'var(--danger)' }}>● </span>}
        {clock(rec.seconds)}
      </div>
      <div className="btn-row" style={{ justifyContent: 'center' }}>
        {rec.state === 'idle' && (
          <Button icon={<Mic size={18} />} onClick={() => void rec.start()}>
            {t('Nagrywaj')}
          </Button>
        )}
        {(rec.state === 'recording' || rec.state === 'paused') && (
          <>
            <Button variant="secondary" icon={<Pause size={18} />} onClick={rec.pause}>
              {rec.state === 'paused' ? t('Wznów') : t('Pauza')}
            </Button>
            <Button variant="danger" icon={<Square size={18} />} onClick={rec.stop}>
              {t('Zakończ')}
            </Button>
          </>
        )}
        {rec.state === 'stopped' && rec.blob && (
          <>
            <Button icon={<Upload size={18} />} loading={sending} onClick={() => onSend(rec.blob!)}>
              {t('Wyślij do szkicu notatki')}
            </Button>
            <Button variant="ghost" onClick={rec.reset}>
              {t('Nagraj ponownie')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
